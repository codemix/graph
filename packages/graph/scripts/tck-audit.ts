#!/usr/bin/env tsx
/**
 * TCK Audit Script
 *
 * This script analyzes skipped TCK tests to determine which can be re-enabled.
 * It temporarily unskips each test, runs it, and categorizes the result.
 *
 * Usage: cd packages/graph && pnpm tsx scripts/tck-audit.ts
 *
 * Options:
 *   --dry-run     Parse and report without running tests
 *   --file=<path> Only analyze a specific file
 *   --apply       Actually modify files to unskip passing tests
 */

import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

const TCK_DIR = path.join(import.meta.dirname, "../src/test/tck");
const REPORT_PATH = path.join(import.meta.dirname, "../TCK_AUDIT_RESULTS.md");

// Design constraints that will never be fixed
const DESIGN_EXCLUSIONS = [
  "unlabeled node",
  "unlabeled nodes",
  "multi-label",
  "multi label",
  "multiple labels",
  "label removal",
  "REMOVE n:Label",
  "remove label",
];

// Patterns indicating features that now work (from gap analysis)
const NOW_WORKING_PATTERNS = [
  "count(*)",
  "count(\\*)",
  "parameters not supported",
  "parameter syntax",
  "$param",
  "RETURN-only",
  "return-only",
  "temporal",
  "date()",
  "time()",
  "datetime()",
  "duration()",
  "ORDER BY alias",
  "order by alias",
  "toBoolean",
  "startNode",
  "endNode",
  "id()",
  "elementId()",
  "type()",
  "labels()",
  "properties()",
  "keys()",
  "range()",
  "reverse()",
  "head()",
  "tail()",
  "last()",
  "coalesce()",
  "WITH...MATCH",
  "named path",
];

interface SkippedTest {
  file: string;
  testName: string;
  skipReason: string;
  lineNumber: number;
  category: "design" | "now_working" | "unknown";
}

interface TestResult {
  test: SkippedTest;
  passed: boolean;
  error?: string;
}

/**
 * Find all test files in the TCK directory
 */
function findTestFiles(dir: string): string[] {
  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findTestFiles(fullPath));
    } else if (entry.name.endsWith(".test.ts")) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Extract skipped tests from a file
 */
function extractSkippedTests(filePath: string): SkippedTest[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const skipped: SkippedTest[] = [];

  // Match test.skip("[...] description - reason", ...)
  const skipPattern = /test\.skip\s*\(\s*["'`](.+?)["'`]/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(skipPattern);

    if (match) {
      const fullTestName = match[1];
      // Extract reason after the last " - "
      const lastDashIndex = fullTestName.lastIndexOf(" - ");
      const skipReason = lastDashIndex > 0 ? fullTestName.slice(lastDashIndex + 3) : "";
      const testName = lastDashIndex > 0 ? fullTestName.slice(0, lastDashIndex) : fullTestName;

      // Categorize
      let category: "design" | "now_working" | "unknown" = "unknown";

      const reasonLower = skipReason.toLowerCase();
      if (DESIGN_EXCLUSIONS.some((d) => reasonLower.includes(d.toLowerCase()))) {
        category = "design";
      } else if (NOW_WORKING_PATTERNS.some((p) => reasonLower.includes(p.toLowerCase()))) {
        category = "now_working";
      }

      skipped.push({
        file: filePath,
        testName,
        skipReason,
        lineNumber: i + 1,
        category,
      });
    }
  }

  return skipped;
}

/**
 * Try to run a single test by temporarily unskipping it
 */
function tryRunTest(test: SkippedTest): TestResult {
  const content = fs.readFileSync(test.file, "utf-8");
  const lines = content.split("\n");

  // Find and modify the line
  const lineIndex = test.lineNumber - 1;
  const originalLine = lines[lineIndex];

  if (!originalLine.includes("test.skip")) {
    return {
      test,
      passed: false,
      error: "Could not find test.skip on expected line",
    };
  }

  // Replace test.skip with test
  const modifiedLine = originalLine.replace("test.skip", "test");
  lines[lineIndex] = modifiedLine;

  // Write modified file
  fs.writeFileSync(test.file, lines.join("\n"));

  try {
    // Run just this test file with a filter for this specific test
    const testPattern = test.testName.replace(/[[\]()]/g, "\\$&");
    const relativePath = path.relative(path.join(import.meta.dirname, ".."), test.file);

    const result = spawnSync(
      "npx",
      ["vitest", "run", relativePath, "-t", testPattern, "--reporter=basic"],
      {
        cwd: path.join(import.meta.dirname, ".."),
        encoding: "utf-8",
        timeout: 30000,
        env: { ...process.env, CI: "true" },
      },
    );

    const output = (result.stdout || "") + (result.stderr || "");
    const passed = result.status === 0 && !output.includes("FAIL");

    return {
      test,
      passed,
      error: passed ? undefined : output.slice(0, 500),
    };
  } catch (err) {
    return {
      test,
      passed: false,
      error: String(err),
    };
  } finally {
    // Restore original file
    fs.writeFileSync(test.file, content);
  }
}

/**
 * Apply changes to unskip passing tests
 */
function applyUnskips(results: TestResult[]): void {
  const passing = results.filter((r) => r.passed);

  // Group by file
  const byFile = new Map<string, TestResult[]>();
  for (const result of passing) {
    const existing = byFile.get(result.test.file) || [];
    existing.push(result);
    byFile.set(result.test.file, existing);
  }

  for (const [file, tests] of byFile) {
    let content = fs.readFileSync(file, "utf-8");

    // Sort by line number descending so replacements don't shift line numbers
    tests.sort((a, b) => b.test.lineNumber - a.test.lineNumber);

    const lines = content.split("\n");
    for (const test of tests) {
      const lineIndex = test.test.lineNumber - 1;
      lines[lineIndex] = lines[lineIndex].replace("test.skip", "test");
    }

    fs.writeFileSync(file, lines.join("\n"));
    console.log(`Updated ${file}: unskipped ${tests.length} tests`);
  }
}

/**
 * Generate markdown report
 */
function generateReport(skippedTests: SkippedTest[], results: TestResult[]): string {
  const lines: string[] = [];

  lines.push("# TCK Audit Results");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");

  // Summary
  const design = skippedTests.filter((t) => t.category === "design");
  const nowWorking = skippedTests.filter((t) => t.category === "now_working");
  const unknown = skippedTests.filter((t) => t.category === "unknown");

  const passed = results.filter((r) => r.passed);
  const failed = results.filter((r) => !r.passed);

  lines.push("## Summary");
  lines.push("");
  lines.push(`| Category | Count |`);
  lines.push(`|----------|-------|`);
  lines.push(`| Total Skipped | ${skippedTests.length} |`);
  lines.push(`| Design Exclusions (won't fix) | ${design.length} |`);
  lines.push(`| Citing "Now Working" Features | ${nowWorking.length} |`);
  lines.push(`| Unknown/Other Reasons | ${unknown.length} |`);
  lines.push("");

  if (results.length > 0) {
    lines.push("## Test Results");
    lines.push("");
    lines.push(`| Result | Count |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Passed (can unskip) | ${passed.length} |`);
    lines.push(`| Failed (real blocker) | ${failed.length} |`);
    lines.push("");
  }

  // Design exclusions
  lines.push("## Design Exclusions (Will Not Be Fixed)");
  lines.push("");
  lines.push("These tests require features that conflict with design decisions:");
  lines.push("");
  for (const test of design.slice(0, 20)) {
    const relPath = path.relative(TCK_DIR, test.file);
    lines.push(`- \`${relPath}:${test.lineNumber}\`: ${test.skipReason}`);
  }
  if (design.length > 20) {
    lines.push(`- ... and ${design.length - 20} more`);
  }
  lines.push("");

  // Now working candidates
  lines.push('## Candidates: Citing "Now Working" Features');
  lines.push("");
  lines.push("These tests cite features that are now implemented. They should be verified:");
  lines.push("");
  for (const test of nowWorking.slice(0, 30)) {
    const relPath = path.relative(TCK_DIR, test.file);
    lines.push(`- \`${relPath}:${test.lineNumber}\`: ${test.skipReason}`);
  }
  if (nowWorking.length > 30) {
    lines.push(`- ... and ${nowWorking.length - 30} more`);
  }
  lines.push("");

  // If we ran tests, show passing ones
  if (passed.length > 0) {
    lines.push("## Passing Tests (Can Be Unskipped)");
    lines.push("");
    for (const result of passed) {
      const relPath = path.relative(TCK_DIR, result.test.file);
      lines.push(`- \`${relPath}:${result.test.lineNumber}\`: ${result.test.testName}`);
    }
    lines.push("");
  }

  // Failed tests with reasons
  if (failed.length > 0) {
    lines.push("## Failed Tests (Need Investigation)");
    lines.push("");
    for (const result of failed.slice(0, 20)) {
      const relPath = path.relative(TCK_DIR, result.test.file);
      lines.push(`### ${relPath}:${result.test.lineNumber}`);
      lines.push(`Test: ${result.test.testName}`);
      lines.push(`Skip Reason: ${result.test.skipReason}`);
      if (result.error) {
        lines.push("```");
        lines.push(result.error.slice(0, 300));
        lines.push("```");
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

// Main execution
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const apply = args.includes("--apply");
  const fileArg = args.find((a) => a.startsWith("--file="));
  const specificFile = fileArg ? fileArg.slice(7) : null;

  console.log("TCK Audit Script");
  console.log("================");
  console.log("");

  // Find test files
  let testFiles: string[];
  if (specificFile) {
    testFiles = [path.resolve(specificFile)];
  } else {
    testFiles = findTestFiles(TCK_DIR);
  }
  console.log(`Found ${testFiles.length} test files`);

  // Extract all skipped tests
  const allSkipped: SkippedTest[] = [];
  for (const file of testFiles) {
    allSkipped.push(...extractSkippedTests(file));
  }
  console.log(`Found ${allSkipped.length} skipped tests`);
  console.log(`  - Design exclusions: ${allSkipped.filter((t) => t.category === "design").length}`);
  console.log(
    `  - Now working candidates: ${allSkipped.filter((t) => t.category === "now_working").length}`,
  );
  console.log(`  - Unknown: ${allSkipped.filter((t) => t.category === "unknown").length}`);
  console.log("");

  let results: TestResult[] = [];

  if (!dryRun) {
    // Filter to "now working" candidates for testing
    const candidates = allSkipped.filter((t) => t.category === "now_working");
    console.log(`Testing ${candidates.length} "now working" candidates...`);
    console.log("");

    for (let i = 0; i < candidates.length; i++) {
      const test = candidates[i];
      const relPath = path.relative(TCK_DIR, test.file);
      process.stdout.write(
        `[${i + 1}/${candidates.length}] ${relPath}: ${test.testName.slice(0, 40)}...`,
      );

      const result = tryRunTest(test);
      results.push(result);

      console.log(result.passed ? " PASS" : " FAIL");
    }
    console.log("");
  }

  // Generate report
  const report = generateReport(allSkipped, results);
  fs.writeFileSync(REPORT_PATH, report);
  console.log(`Report written to: ${REPORT_PATH}`);

  // Apply if requested
  if (apply && results.length > 0) {
    const passing = results.filter((r) => r.passed);
    if (passing.length > 0) {
      console.log(`Applying ${passing.length} unskips...`);
      applyUnskips(results);
    }
  }

  // Summary
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  if (results.length > 0) {
    console.log("");
    console.log(`Results: ${passed} passed, ${failed} failed`);
  }
}

main().catch(console.error);
