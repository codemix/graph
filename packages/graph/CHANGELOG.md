# @codemix/graph

## 0.2.0

### Minor Changes

- e8213bf: Expand traversal parity across value and edge pipelines.

  `ValueTraversal` now supports `dedup()`, `skip()`, `limit()`, `range()`, `count()`, `property()`, and `properties()` so extracted values can keep flowing through the same shaping and projection steps as other traversal results.

  `EdgeTraversal` now supports direct `skip()`, `limit()`, `range()`, `count()`, `map()`, `property()`, `properties()`, and `order()` operations, making it possible to paginate, transform, project, and sort edges without first converting them to vertices or raw values.

## 0.1.0

### Minor Changes

- 848690d: Add support for `.map()` and `.filter()` on `ValueTraversal`, so value pipelines can transform and filter extracted values after steps like `values()` and `unfold()`.

## 0.0.2

### Patch Changes

- 7aff418: Add npm publishing metadata and automated release configuration for the monorepo packages.
- Updated dependencies [7aff418]
  - @codemix/text-search@0.0.2
