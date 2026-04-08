# OpenCypher TCK Coverage Report

Updated: 2026-01-24

## Summary

| Metric           | Count         |
| ---------------- | ------------- |
| Total Test Files | 221           |
| Total Tests      | 2,508         |
| Passing          | 1,190 (47.4%) |
| Skipped          | 1,318 (52.6%) |

## Coverage by Category

### Clauses (95 files)

| Category        | Files  | Passing | Skipped | Total     | Pass Rate |
| --------------- | ------ | ------- | ------- | --------- | --------- |
| Match           | 9      | 18      | 133     | 151       | 11.9%     |
| MatchWhere      | 6      | 9       | 25      | 34        | 26.5%     |
| Create          | 6      | 29      | 63      | 92        | 31.5%     |
| Return          | 8      | 15      | 75      | 90        | 16.7%     |
| ReturnOrderBy   | 6      | 15      | 41      | 56        | 26.8%     |
| ReturnSkipLimit | 3      | 20      | 27      | 47        | 42.6%     |
| With            | 7      | 19      | 30      | 49        | 38.8%     |
| WithWhere       | 7      | 23      | 14      | 37        | 62.2%     |
| WithOrderBy     | 4      | 20      | 96      | 116       | 17.2%     |
| WithSkipLimit   | 3      | 20      | 9       | 29        | 69.0%     |
| Merge           | 9      | 42      | 64      | 106       | 39.6%     |
| Delete          | 6      | 16      | 40      | 56        | 28.6%     |
| Set             | 6      | 12      | 49      | 61        | 19.7%     |
| Remove          | 3      | 14      | 27      | 41        | 34.1%     |
| Union           | 3      | 8       | 10      | 18        | 44.4%     |
| Unwind          | 1      | 7       | 15      | 22        | 31.8%     |
| Call            | 6      | 0       | 52      | 52        | 0.0%      |
| **Subtotal**    | **93** | **287** | **770** | **1,057** | **27.2%** |

### Expressions (118 files)

| Category            | Files   | Passing | Skipped | Total     | Pass Rate |
| ------------------- | ------- | ------- | ------- | --------- | --------- |
| Boolean             | 5       | 21      | 36      | 57        | 36.8%     |
| Comparison          | 4       | 36      | 36      | 72        | 50.0%     |
| String              | 14      | 21      | 23      | 44        | 47.7%     |
| Mathematical        | 17      | 23      | 18      | 41        | 56.1%     |
| List                | 12      | 20      | 82      | 102       | 19.6%     |
| Map                 | 3       | 13      | 31      | 44        | 29.5%     |
| Aggregation         | 8       | 14      | 60      | 74        | 18.9%     |
| Null                | 3       | 20      | 16      | 36        | 55.6%     |
| Conditional         | 2       | 20      | 13      | 33        | 60.6%     |
| Literals            | 8       | 94      | 93      | 187       | 50.3%     |
| Graph               | 9       | 33      | 53      | 86        | 38.4%     |
| TypeConversion      | 6       | 43      | 43      | 86        | 50.0%     |
| Quantifier          | 12      | 101     | 84      | 185       | 54.6%     |
| Precedence          | 4       | 42      | 29      | 71        | 59.2%     |
| Path                | 3       | 15      | 7       | 22        | 68.2%     |
| Pattern             | 2       | 14      | 36      | 50        | 28.0%     |
| ExistentialSubquery | 3       | 23      | 10      | 33        | 69.7%     |
| Temporal            | 10      | 3       | 124     | 127       | 2.4%      |
| **Subtotal**        | **125** | **553** | **797** | **1,350** | **41.0%** |

### Use Cases (2 files)

| Category                | Files | Passing | Skipped | Total  | Pass Rate |
| ----------------------- | ----- | ------- | ------- | ------ | --------- |
| CountingSubgraphMatches | 1     | 10      | 11      | 21     | 47.6%     |
| TriadicSelection        | 1     | 10      | 19      | 29     | 34.5%     |
| **Subtotal**            | **2** | **20**  | **30**  | **50** | **40.0%** |

### Infrastructure (1 file)

| Category    | Files | Passing | Skipped | Total | Pass Rate |
| ----------- | ----- | ------- | ------- | ----- | --------- |
| tck.test.ts | 1     | 9       | 0       | 9     | 100.0%    |

## Supported Features

### Fully Supported

The following features have good test coverage and work correctly:

#### Clauses

- Basic MATCH with labels and properties
- CREATE nodes and relationships
- RETURN with aliases and ORDER BY
- SKIP and LIMIT
- WITH for variable forwarding and aggregation
- MERGE with ON CREATE/ON MATCH
- DELETE and DETACH DELETE
- SET for property updates
- REMOVE for property removal
- UNION and UNION ALL
- UNWIND with literal lists
- OPTIONAL MATCH (basic cases)
- WITH...MATCH chaining

#### Expressions

- Boolean operators (AND, OR, XOR, NOT) in WHERE and RETURN
- Comparison operators (=, <>, <, >, <=, >=)
- String operators (STARTS WITH, ENDS WITH, CONTAINS)
- IN operator for list membership
- IS NULL / IS NOT NULL
- CASE WHEN expressions
- coalesce() function
- Quantifier predicates (ALL, ANY, NONE, SINGLE)
- labels(), type(), id(), elementId() functions
- properties(), keys() functions
- Basic aggregates (count, sum, avg, min, max, collect)
- count(\*) syntax
- Type conversion (toInteger, toFloat, toString, toBoolean)
- head(), tail(), last(), range(), reverse() functions
- length(), nodes(), relationships() path functions
- startNode(), endNode() relationship functions

#### Literals

- Integers (decimal, hex, octal)
- Floats (standard and scientific notation)
- Strings (single and double quotes)
- Booleans (true, false)
- Parameters ($param)

### Partially Supported

- OPTIONAL MATCH (basic cases work, complex null propagation issues)
- Temporal types (functions implemented but many tests still skipped)

### Unsupported Features

The following Cypher features are not supported (by design or not yet implemented):

#### By Design (Won't Fix)

1. **Unlabeled nodes** - Static schema requires all nodes to have labels
2. **Multi-label syntax** - Single label per node by design
3. **Label removal** - Labels are immutable; REMOVE n:Label not supported

#### Not Yet Implemented

1. **User-defined procedures** - CALL tests require procedure registration API
2. **Pattern predicates in WHERE** - `WHERE (n)-[]->()` syntax
3. **DISTINCT in aggregates** - `count(DISTINCT x)` syntax
4. **Implicit grouping** - Aggregates with non-aggregated columns
5. **Variable property access in CREATE/MERGE** - `CREATE (n {prop: variable})`
6. **Parameters in SKIP/LIMIT** - `SKIP $n LIMIT $m`
7. **RETURN \*** - Wildcard return syntax
8. **WITH \*** - Wildcard forward syntax

## Recommendations for Future Work

### High Priority

1. Re-enable tests that cite now-working features as blockers
2. Add variable property access in CREATE/MERGE
3. Improve OPTIONAL MATCH null handling for edge cases

### Medium Priority

1. Support DISTINCT inside aggregate functions
2. Add pattern predicates in WHERE clause
3. Implement implicit grouping for aggregates
4. Add RETURN _ / WITH _ syntax

### Low Priority

1. User-defined procedures (CALL tests)
2. Complex temporal arithmetic
3. Parameters in SKIP/LIMIT
