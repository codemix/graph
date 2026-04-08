# OpenCypher TCK Gap Analysis

Updated: 2026-01-24

This document provides a comprehensive analysis of TCK test coverage gaps, skip reasons, and future work recommendations for the graph package's Cypher implementation.

## Executive Summary

| Metric                          | Value         |
| ------------------------------- | ------------- |
| Total Tests                     | 5,060         |
| Passing                         | 3,922 (77.5%) |
| Skipped                         | 1,138 (22.5%) |
| Failed                          | 0             |
| Skipped due to design decisions | ~245          |
| Skipped due to missing features | ~850          |
| Skipped due to empty TCK files  | ~66           |

## Design Decisions (Will Not Be Changed)

The following limitations are **by design** and will not be changed:

1. **Unlabeled nodes** (221 tests) - Static schema requires all nodes to have labels
2. **Multi-label syntax** (18 tests) - Nodes have exactly one label by design

## Features That ARE Working (Contrary to Some Skip Reasons)

Recent investigation revealed several features that work but tests are still marked as skipped:

| Feature                           | Status     | Notes                                                  |
| --------------------------------- | ---------- | ------------------------------------------------------ |
| `count(*)`                        | ✅ WORKING | Fully supported in both RETURN and WITH clauses        |
| `id()`                            | ✅ WORKING | Returns element.id                                     |
| `elementId()`                     | ✅ WORKING | Returns String(element.id)                             |
| `type()`                          | ✅ WORKING | Returns relationship label                             |
| `labels()`                        | ✅ WORKING | Returns [node.label]                                   |
| `properties()`                    | ✅ WORKING | Returns element properties map                         |
| `keys()`                          | ✅ WORKING | Returns Object.keys() of properties                    |
| `range()`                         | ✅ WORKING | Generates integer arrays                               |
| `reverse()`                       | ✅ WORKING | Works for strings and lists                            |
| `head()`, `tail()`, `last()`      | ✅ WORKING | List functions fully implemented                       |
| `coalesce()`                      | ✅ WORKING | Variadic, returns first non-null                       |
| RETURN-only queries               | ✅ WORKING | `RETURN 1+2` parses and executes                       |
| WITH...MATCH chaining             | ✅ WORKING | Grammar supports via QuerySegment                      |
| Parameters ($param)               | ✅ WORKING | Full parameter support                                 |
| Undirected patterns               | ✅ WORKING | `(a)-[]-(b)` works                                     |
| OPTIONAL MATCH                    | ✅ PARTIAL | Basic cases work, complex cases may have issues        |
| ORDER BY alias                    | ✅ WORKING | Works in both RETURN and WITH clauses                  |
| Temporal functions                | ✅ WORKING | date(), time(), datetime(), duration() all implemented |
| `startNode()`/`endNode()`         | ✅ WORKING | Returns relationship endpoints                         |
| `toBoolean()`                     | ✅ WORKING | Converts strings/booleans to boolean                   |
| UNWIND clause                     | ✅ WORKING | Fully implemented, tests in unwind.test.ts             |
| List comprehension                | ✅ WORKING | Fully implemented, tests in listComprehension.test.ts  |
| Quantifiers (all/any/none/single) | ✅ WORKING | Work in RETURN and WHERE clauses                       |

## Categorized Skip Reasons (Actual Blockers)

The following table shows **actual remaining blockers** after accounting for working features:

| Category                            | Count | % of Skips | Priority  |
| ----------------------------------- | ----- | ---------- | --------- |
| Unlabeled nodes required            | 221   | 16.3%      | Won't Fix |
| Implicit grouping limitations       | ~100  | 7.4%       | Medium    |
| User-defined procedures (CALL)      | 71    | 5.2%       | Low       |
| Empty TCK feature files             | 66    | 4.9%       | N/A       |
| Variable prop access in CREATE      | ~50   | 3.7%       | High      |
| Pattern predicates in WHERE         | ~30   | 2.2%       | Medium    |
| Multi-label syntax                  | 18    | 1.3%       | Won't Fix |
| DISTINCT in aggregates              | ~12   | 0.9%       | Medium    |
| WHERE true/false (quantifiers)      | ~32   | 2.4%       | Low       |
| Map property in quantifier WHERE    | ~16   | 1.2%       | Medium    |
| Combined blockers (multiple issues) | ~650  | 47.8%      | Varies    |

## Tests That Can Be Re-Enabled

Many tests are skipped citing features that now work. These tests should be re-reviewed:

1. **Tests citing `count(*)` as blocker** - count(\*) now works; re-check if other blockers exist
2. **Tests citing graph introspection functions** - id(), type(), labels(), keys(), properties() all work
3. **Tests citing parameter syntax** - Parameters ($param) fully supported
4. **Tests citing RETURN-only queries** - Now supported
5. **Tests citing temporal types** - All temporal functions implemented

## Remaining Gaps to Address

### Priority 1: High Impact, Medium Complexity

1. **OPTIONAL MATCH edge cases**
   - Impact: ~50 tests
   - Complexity: Medium
   - Issue: Null propagation with bound variables from prior MATCH

2. **Undirected edge patterns**
   - Impact: ~30 tests
   - Complexity: Medium
   - Issue: `(a)--(b)` syntax not supported

3. **Variable-length paths with zero minimum**
   - Impact: ~20 tests
   - Complexity: Medium
   - Issue: `*0..N` paths not supported

### Priority 2: Medium Impact

4. **Pattern predicates in WHERE**
   - Impact: ~30 tests
   - Complexity: Medium
   - Issue: `WHERE (n)-[]->()` syntax

5. **DISTINCT in aggregate functions**
   - Impact: ~12 tests
   - Complexity: Medium
   - Issue: `count(DISTINCT x)` syntax

6. **Implicit grouping**
   - Impact: ~100 tests
   - Complexity: Medium
   - Issue: Aggregates with non-aggregated columns

7. **ORDER BY expression evaluation**
   - Impact: ~15 tests
   - Complexity: Medium
   - Issue: `ORDER BY a.num % 3` expressions not evaluated

### Priority 3: Low Priority (Deferred)

8. **User-defined procedures**
   - Impact: 71 tests
   - Complexity: High
   - Requires procedure registration API

9. **SKIP/LIMIT with parameters**
   - Impact: ~10 tests
   - Complexity: Low
   - Issue: Grammar only accepts integer literals

## Recommendations

### Immediate Actions

1. **Fix point() spatial test** - cypher-comparison.test.ts:1284 expects point() to throw but it doesn't
2. **Continue auditing skip reasons** - Many tests have multiple blockers; primary blocker is often unlabeled nodes

### Medium-term

3. Improve OPTIONAL MATCH null handling with bound variables
4. Add undirected edge pattern support
5. Support zero-length variable paths
6. Add pattern predicates in WHERE clause
7. Support DISTINCT inside aggregates

### Completed (January 2026 Audit)

- ✅ UNWIND clause - Fully working
- ✅ List comprehension - Fully working
- ✅ Parameters ($param) - Fully working in expressions
- ✅ Named paths (p = ...) - Fully working
- ✅ ORDER BY alias - Fully working
- ✅ Temporal functions - All implemented
- ✅ Graph introspection (id, type, labels, keys, properties) - All working
- ✅ ToXxxOrNull functions - Added toIntegerOrNull, toFloatOrNull, toBooleanOrNull, toStringOrNull

### Deferred

- Unlabeled nodes (by design - static schema)
- Multi-label nodes (by design - single label)
- Label removal (by design - labels immutable)
- User-defined procedures (low priority)

## Appendix: Skip Reason Patterns

The following patterns are used in test.skip() calls:

```
test.skip("[TCK test ID] Description - reason for skip", ...)
```

### Valid Skip Reasons (Design Decisions)

- `unlabeled nodes (by design)` - Static schema requires labels
- `multi-label (by design)` - Single label per node
- `label removal (by design)` - Labels are immutable

### Valid Skip Reasons (Implementation Gaps)

- `undirected edges not supported` - `(a)--(b)` patterns
- `variable-length *0 not supported` - Zero-length paths
- `user-defined procedures not supported` - CALL clause
- `DISTINCT in aggregates not supported` - count(DISTINCT x)
- `semantic validation not implemented` - Type/undefined variable errors
- `OPTIONAL MATCH with bound variables` - Null handling issues
- `ORDER BY expression evaluation` - Expressions as sort keys
- `SKIP/LIMIT only accept integer literals` - No parameter support
- `aggregation in ORDER BY not supported` - Aggregate expressions as sort keys

### Outdated Skip Reasons (Features Now Working)

These reasons are no longer valid - tests citing them should be re-audited:

- ~~`RETURN-only queries not supported`~~ - **NOW WORKING**
- ~~`named path syntax not supported`~~ - **NOW WORKING**
- ~~`parameters not supported`~~ - **NOW WORKING** (in expressions)
- ~~`temporal types not supported`~~ - **NOW WORKING**
- ~~`ORDER BY alias not supported`~~ - **NOW WORKING**
- ~~`count(*) not supported`~~ - **NOW WORKING**
- ~~`WITH...MATCH chaining not supported`~~ - **NOW WORKING**
- ~~`toBoolean() not implemented`~~ - **NOW WORKING**
- ~~`startNode()/endNode() not implemented`~~ - **NOW WORKING**
- ~~`UNWIND not supported`~~ - **NOW WORKING**
- ~~`list comprehension not supported`~~ - **NOW WORKING**
- ~~`id()/type()/labels()/keys()/properties() not supported`~~ - **NOW WORKING**
