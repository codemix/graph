# @codemix/text-search

Fast, accurate text search with BM25-inspired scoring, English stemming, and phrase-aware ranking. Zero dependencies.

## Features

- **BM25-inspired scoring** — term frequency saturation and document length normalization
- **Porter stemmer** — matches "running" to "run", "connections" to "connect"
- **Stopword filtering** — ignores noise words like "the", "and", "is"
- **Phrase bonuses** — consecutive term matches score higher than scattered terms
- **Exact and prefix bonuses** — boosts documents containing the literal query string
- **Position-aware scoring** — terms appearing earlier in a document score slightly higher
- **Detailed results** — inspect each scoring component for debugging or tuning
- **Scores clamped to [0, 1]** — always safe to compare or threshold

## Installation

```bash
npm install @codemix/text-search
```

## Quick start

```typescript
import { createMatcher, rankDocuments } from "@codemix/text-search";

// Score a single document against a query
const match = createMatcher("quick brown fox");
match("The quick brown fox jumps over the lazy dog"); // ~0.85
match("A slow gray elephant"); // 0.0

// Rank an array of strings by relevance
const results = rankDocuments("database connection", [
  "How to connect to a database",
  "Database connection pooling best practices",
  "Unrelated article about cooking",
]);
// results[0].document === "Database connection pooling best practices"
// results[0].score    === 0.73 (example)
```

## API

### `createMatcher(query, options?): MatcherFn`

Prepares a query and returns a scoring function. Creating the matcher does the expensive tokenization work once; the returned function is cheap to call repeatedly.

```typescript
const match = createMatcher("error handling");

match("Always handle errors gracefully"); // > 0
match("Cooking recipes for beginners"); // 0
```

**Returns** `(text: string) => number` — a score in `[0, 1]`.

---

### `createDetailedMatcher(query, options?): (text: string) => MatchResult`

Same as `createMatcher` but returns a full breakdown of each scoring component. Useful for debugging or building custom ranking logic on top.

```typescript
const match = createDetailedMatcher("quick brown fox");
const result = match("The quick brown fox jumps");
// {
//   score: 0.87,
//   termScore: 0.52,        // BM25 term frequency contribution
//   exactBonus: 0.15,       // literal substring found in document
//   prefixBonus: 0.0,       // document did not start with query
//   consecutiveBonus: 0.1,  // "quick brown" and "brown fox" appeared in order
//   positionScore: 0.05,    // terms appeared near the start
//   matchedTerms: 3,        // all 3 query terms matched
//   totalTerms: 3,
// }
```

---

### `rankDocuments(query, documents, options?)`

Scores an array of strings and returns them sorted by relevance, highest first.

```typescript
const results = rankDocuments("react hooks", [
  "React hooks introduction and useState examples",
  "Understanding React component lifecycle methods",
  "Getting started with React Native development",
]);
// [
//   { document: "React hooks introduction...", score: 0.71 },
//   { document: "Getting started with React Native...", score: 0.28 },
//   { document: "Understanding React component...", score: 0.21 },
// ]
```

---

### `rankDocuments(query, config, documents, options?)`

Scores an array of objects by extracting text via a function, and returns a key from each object alongside its score.

```typescript
interface Article {
  slug: string;
  title: string;
  content: string;
}

const articles: Article[] = [
  { slug: "intro-react", title: "Introduction to React", content: "Learn React basics" },
  { slug: "vue-guide", title: "Vue.js Guide", content: "Getting started with Vue" },
];

const results = rankDocuments(
  "react",
  { key: "slug", text: (a) => `${a.title} ${a.content}` },
  articles,
);
// [
//   { key: "intro-react", score: 0.55 },
//   { key: "vue-guide",   score: 0.0  },
// ]
```

---

### `tokenize(text, options?): Token[]`

Splits text into tokens, optionally applying stemming and stopword removal. Each token carries its original form, stemmed form, and word-index position.

```typescript
import { tokenize } from "@codemix/text-search";

tokenize("The quick brown fox");
// [
//   { original: "quick", stemmed: "quick", position: 1 },
//   { original: "brown", stemmed: "brown", position: 2 },
//   { original: "fox",   stemmed: "fox",   position: 3 },
// ]

tokenize("running dogs", { stem: true });
// [
//   { original: "running", stemmed: "run", position: 0 },
//   { original: "dogs",    stemmed: "dog", position: 1 },
// ]
```

---

### `stem(word): string`

Applies the Porter stemming algorithm to a single lowercase word.

```typescript
import { stem } from "@codemix/text-search";

stem("running"); // "run"
stem("connections"); // "connect"
stem("happily"); // "happili"
```

---

### `extractTerms(text, options?): string[]`

Convenience wrapper around `tokenize` that returns just the stemmed term strings.

```typescript
import { extractTerms } from "@codemix/text-search";

extractTerms("Database connection pooling");
// ["databas", "connect", "pool"]
```

---

### `buildTermFrequency(tokens): Map<string, number>`

Builds a term → count map from a token array.

---

### `buildPositionMap(tokens): Map<string, number[]>`

Builds a term → positions map from a token array.

---

### `STOPWORDS`

A `Set<string>` of the English stopwords that are filtered by default.

## Options

All main functions accept a shared options object.

### Tokenization options (`TokenizeOptions`)

| Option            | Type      | Default | Description                     |
| ----------------- | --------- | ------- | ------------------------------- |
| `stem`            | `boolean` | `true`  | Apply Porter stemming           |
| `removeStopwords` | `boolean` | `true`  | Filter common English stopwords |
| `minLength`       | `number`  | `1`     | Minimum token length to keep    |

### Matcher options (`MatcherOptions`)

Extends `TokenizeOptions` with BM25 tuning and bonus weights.

| Option             | Type     | Default | Description                                                       |
| ------------------ | -------- | ------- | ----------------------------------------------------------------- |
| `k1`               | `number` | `1.2`   | BM25 term-frequency saturation. Higher = more weight on frequency |
| `b`                | `number` | `0.75`  | BM25 length normalization. `0` = none, `1` = full                 |
| `exactMatchBonus`  | `number` | `0.15`  | Added when query appears as a literal substring                   |
| `prefixMatchBonus` | `number` | `0.1`   | Added when document starts with query                             |
| `consecutiveBonus` | `number` | `0.1`   | Added proportionally for consecutive term matches                 |
| `positionWeight`   | `number` | `0.05`  | Weight for position-based scoring                                 |

**Disabling all bonuses** gives you a pure BM25-style score capped at ~0.6:

```typescript
const match = createMatcher("error", {
  exactMatchBonus: 0,
  prefixMatchBonus: 0,
  consecutiveBonus: 0,
  positionWeight: 0,
});
```

## How scoring works

The final score is the sum of five components, clamped to `[0, 1]`:

```
score = termScore + exactBonus + prefixBonus + consecutiveBonus + positionScore
```

| Component          | Max contribution | Description                                                     |
| ------------------ | ---------------- | --------------------------------------------------------------- |
| `termScore`        | 0.60             | BM25-style term frequency + query term coverage                 |
| `exactBonus`       | 0.15             | Literal query string found in document                          |
| `prefixBonus`      | 0.10             | Document starts with query string                               |
| `consecutiveBonus` | 0.10             | Fraction of adjacent query term pairs that appear consecutively |
| `positionScore`    | 0.05             | Earlier term positions score higher                             |

### Term score detail

Because there is no corpus to compute IDF from, the library uses a simplified BM25 formula:

1. For each unique stemmed query term, compute the saturated term frequency in the document using the standard BM25 TF formula with the configured `k1`/`b` parameters and an assumed average document length of 50 words.
2. Normalize the total by the number of query terms.
3. Apply a coverage multiplier: matching 3/3 terms scores higher than matching 1/3.
4. Scale to a maximum of 0.6 to leave headroom for bonuses.

## Stemming

The library ships a complete [Porter stemmer](https://tartarus.org/martin/PorterStemmer/) (Martin Porter, 1980). It handles all five steps of the algorithm:

- **Step 1a/b/c** — plurals, `-ed`/`-ing` endings, `-y` → `-i`
- **Step 2** — suffix reductions with measure > 0 (`-ational` → `-ate`, etc.)
- **Step 3** — additional suffix reductions (`-icate` → `-ic`, etc.)
- **Step 4** — suffix removal with measure > 1
- **Step 5a/b** — trailing `-e` and `-ll` removal

Words shorter than 3 characters are returned unchanged.

Note: the Porter stemmer is a rule-based algorithm and does not handle irregular forms. `ran` will not stem to `run`.

## Performance

Benchmarks on 1000-word documents (Node.js, M-series Mac):

| Operation                                    | Time      |
| -------------------------------------------- | --------- |
| Tokenize 1 document × 100                    | < 500 ms  |
| Score 1 document × 100                       | < 500 ms  |
| Rank 100 × 1000-word documents               | < 1000 ms |
| 500 scoring operations (50 docs × 10 passes) | < 1000 ms |

The matcher compiles the query once — reuse the function returned by `createMatcher` when scoring many documents against the same query.

## Examples

### Search a documentation index

```typescript
const docs = [
  "How to connect to a PostgreSQL database using Node.js",
  "Database connection pooling best practices",
  "Introduction to NoSQL databases",
  "Setting up a web server with Express",
  "Understanding database transactions and ACID properties",
];

const results = rankDocuments("database connection", docs);
// results[0].document === "Database connection pooling best practices"
```

### Autocomplete / prefix search

```typescript
const faq = [
  "How do I reset my password?",
  "What payment methods are accepted?",
  "How to cancel my subscription",
];

const match = createMatcher("cancel subscription");
faq.filter((q) => match(q) > 0.3);
// ["How to cancel my subscription"]
```

### Search structured objects with a custom key

```typescript
const users = [
  { id: 1, name: "John Doe", bio: "Software engineer at TechCorp" },
  { id: 2, name: "Jane Smith", bio: "Product manager with engineering background" },
  { id: 3, name: "Bob Wilson", bio: "Marketing specialist" },
];

const results = rankDocuments(
  "software engineer",
  { key: "id", text: (u) => `${u.name} ${u.bio}` },
  users,
);
// results[0].key === 1  (John Doe)
```

### Debug scoring

```typescript
const match = createDetailedMatcher("machine learning");
const result = match("Introduction to machine learning algorithms");

console.log(`Score: ${result.score}`);
console.log(`Terms matched: ${result.matchedTerms}/${result.totalTerms}`);
console.log(`Consecutive bonus: ${result.consecutiveBonus}`);
```

### Disable stemming for exact keyword matching

```typescript
const match = createMatcher("engineering", { stem: false });
// Only matches the literal word "engineering", not "engineer" or "engineered"
```

## License

MIT
