/**
 * Porter Stemmer implementation for English.
 * Based on the algorithm by Martin Porter (1980).
 *
 * This is a compact but complete implementation that handles
 * all major English word suffixes.
 */

// Consonant pattern: not a vowel
const consonant = "[^aeiou]";
// Vowel pattern
const vowel = "[aeiouy]";
// Consonant sequence
const C = `${consonant}[^aeiouy]*`;
// Vowel sequence
const V = `${vowel}[aeiou]*`;

// Patterns for measuring word structure
const mgr0 = new RegExp(`^(${C})?${V}${C}`);
const meq1 = new RegExp(`^(${C})?${V}${C}(${V})?$`);
const mgr1 = new RegExp(`^(${C})?${V}${C}${V}${C}`);
const hasVowel = new RegExp(`^(${C})?${vowel}`);

// Pattern for words ending in consonant + vowel + consonant (not w, x, or y)
const cvc = new RegExp(`${consonant}${vowel}[^aeiouwxy]$`);

/**
 * Check if the stem has measure > 0
 */
function hasMeasureGreaterThan0(stem: string): boolean {
  return mgr0.test(stem);
}

/**
 * Check if the stem has measure = 1
 */
function hasMeasureEqual1(stem: string): boolean {
  return meq1.test(stem);
}

/**
 * Check if the stem has measure > 1
 */
function hasMeasureGreaterThan1(stem: string): boolean {
  return mgr1.test(stem);
}

/**
 * Check if stem contains a vowel
 */
function containsVowel(stem: string): boolean {
  return hasVowel.test(stem);
}

/**
 * Check if stem ends with a double consonant
 */
function endsWithDoubleConsonant(stem: string): boolean {
  const len = stem.length;
  if (len < 2) return false;
  const last = stem[len - 1]!;
  const secondLast = stem[len - 2]!;
  return last === secondLast && !/[aeiou]/.test(last);
}

/**
 * Check if stem ends with consonant-vowel-consonant pattern
 * where the final consonant is not w, x, or y
 */
function endsWithCVC(stem: string): boolean {
  return cvc.test(stem);
}

/**
 * Step 1a: Handle plural forms and -ed/-ing endings
 */
function step1a(word: string): string {
  if (word.endsWith("sses")) {
    return word.slice(0, -2);
  }
  if (word.endsWith("ies")) {
    return word.slice(0, -2);
  }
  if (word.endsWith("ss")) {
    return word;
  }
  if (word.endsWith("s")) {
    return word.slice(0, -1);
  }
  return word;
}

/**
 * Step 1b: Handle -eed, -ed, -ing endings
 */
function step1b(word: string): string {
  if (word.endsWith("eed")) {
    const stem = word.slice(0, -3);
    if (hasMeasureGreaterThan0(stem)) {
      return word.slice(0, -1);
    }
    return word;
  }

  let stem = "";
  let suffix = "";

  if (word.endsWith("ed")) {
    stem = word.slice(0, -2);
    suffix = "ed";
  } else if (word.endsWith("ing")) {
    stem = word.slice(0, -3);
    suffix = "ing";
  }

  if (suffix && containsVowel(stem)) {
    word = stem;

    if (word.endsWith("at") || word.endsWith("bl") || word.endsWith("iz")) {
      return word + "e";
    }

    if (endsWithDoubleConsonant(word)) {
      const last = word[word.length - 1]!;
      if (last !== "l" && last !== "s" && last !== "z") {
        return word.slice(0, -1);
      }
    }

    if (hasMeasureEqual1(word) && endsWithCVC(word)) {
      return word + "e";
    }
  }

  return word;
}

/**
 * Step 1c: Handle -y endings
 */
function step1c(word: string): string {
  if (word.endsWith("y")) {
    const stem = word.slice(0, -1);
    if (containsVowel(stem)) {
      return stem + "i";
    }
  }
  return word;
}

/**
 * Step 2: Handle various suffixes with measure > 0
 */
function step2(word: string): string {
  const suffixes: [string, string][] = [
    ["ational", "ate"],
    ["tional", "tion"],
    ["enci", "ence"],
    ["anci", "ance"],
    ["izer", "ize"],
    ["abli", "able"],
    ["alli", "al"],
    ["entli", "ent"],
    ["eli", "e"],
    ["ousli", "ous"],
    ["ization", "ize"],
    ["ation", "ate"],
    ["ator", "ate"],
    ["alism", "al"],
    ["iveness", "ive"],
    ["fulness", "ful"],
    ["ousness", "ous"],
    ["aliti", "al"],
    ["iviti", "ive"],
    ["biliti", "ble"],
    ["logi", "log"],
  ];

  for (const [suffix, replacement] of suffixes) {
    if (word.endsWith(suffix)) {
      const stem = word.slice(0, -suffix.length);
      if (hasMeasureGreaterThan0(stem)) {
        return stem + replacement;
      }
      return word;
    }
  }

  return word;
}

/**
 * Step 3: Handle various suffixes with measure > 0
 */
function step3(word: string): string {
  const suffixes: [string, string][] = [
    ["icate", "ic"],
    ["ative", ""],
    ["alize", "al"],
    ["iciti", "ic"],
    ["ical", "ic"],
    ["ful", ""],
    ["ness", ""],
  ];

  for (const [suffix, replacement] of suffixes) {
    if (word.endsWith(suffix)) {
      const stem = word.slice(0, -suffix.length);
      if (hasMeasureGreaterThan0(stem)) {
        return stem + replacement;
      }
      return word;
    }
  }

  return word;
}

/**
 * Step 4: Remove suffixes with measure > 1
 */
function step4(word: string): string {
  const suffixes = [
    "al",
    "ance",
    "ence",
    "er",
    "ic",
    "able",
    "ible",
    "ant",
    "ement",
    "ment",
    "ent",
    "ion",
    "ou",
    "ism",
    "ate",
    "iti",
    "ous",
    "ive",
    "ize",
  ];

  for (const suffix of suffixes) {
    if (word.endsWith(suffix)) {
      const stem = word.slice(0, -suffix.length);
      if (suffix === "ion") {
        if (
          hasMeasureGreaterThan1(stem) &&
          (stem.endsWith("s") || stem.endsWith("t"))
        ) {
          return stem;
        }
      } else if (hasMeasureGreaterThan1(stem)) {
        return stem;
      }
      return word;
    }
  }

  return word;
}

/**
 * Step 5a: Remove trailing 'e' if measure > 1,
 * or measure = 1 and not CVC
 */
function step5a(word: string): string {
  if (word.endsWith("e")) {
    const stem = word.slice(0, -1);
    if (hasMeasureGreaterThan1(stem)) {
      return stem;
    }
    if (hasMeasureEqual1(stem) && !endsWithCVC(stem)) {
      return stem;
    }
  }
  return word;
}

/**
 * Step 5b: Remove trailing 'll' if measure > 1
 */
function step5b(word: string): string {
  if (word.endsWith("ll") && hasMeasureGreaterThan1(word.slice(0, -1))) {
    return word.slice(0, -1);
  }
  return word;
}

/**
 * Stem a word using the Porter stemming algorithm.
 *
 * @param word - The word to stem (should be lowercase)
 * @returns The stemmed word
 *
 * @example
 * stem("running") // "run"
 * stem("happily") // "happili"
 * stem("connections") // "connect"
 */
export function stem(word: string): string {
  // Don't stem very short words
  if (word.length < 3) {
    return word;
  }

  // Apply all steps in sequence
  let result = word;
  result = step1a(result);
  result = step1b(result);
  result = step1c(result);
  result = step2(result);
  result = step3(result);
  result = step4(result);
  result = step5a(result);
  result = step5b(result);

  return result;
}
