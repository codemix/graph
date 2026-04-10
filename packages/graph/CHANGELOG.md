# @codemix/graph

## 0.1.0

### Minor Changes

- Improve path ergonomics with `TraversalPath.nodes()`, `relationships()`, `length()`, and `sum()`, and add runtime support for `ORDER BY` expressions that reference projected aliases before `RETURN`/`WITH`.
- 848690d: Add support for `.map()` and `.filter()` on `ValueTraversal`, so value pipelines can transform and filter extracted values after steps like `values()` and `unfold()`.

## 0.0.2

### Patch Changes

- 7aff418: Add npm publishing metadata and automated release configuration for the monorepo packages.
- Updated dependencies [7aff418]
  - @codemix/text-search@0.0.2
