---
"@codemix/graph": minor
---

Expand traversal parity across value and edge pipelines.

`ValueTraversal` now supports `dedup()`, `skip()`, `limit()`, `range()`, `count()`, `property()`, and `properties()` so extracted values can keep flowing through the same shaping and projection steps as other traversal results.

`EdgeTraversal` now supports direct `skip()`, `limit()`, `range()`, `count()`, `map()`, `property()`, `properties()`, and `order()` operations, making it possible to paginate, transform, project, and sort edges without first converting them to vertices or raw values.
