// Graph Query Language Grammar
// Cypher-inspired query language for LLM-friendly graph traversal

{
  function buildBinaryCondition(head, tail, operator) {
    if (tail.length === 0) {
      return head;
    }
    const typeMap = {
      'AND': 'AndCondition',
      'OR': 'OrCondition',
      'XOR': 'XorCondition'
    };
    return tail.reduce((left, element) => {
      const [_, __, ___, right] = element;
      return {
        type: typeMap[operator],
        left: left,
        right: right
      };
    }, head);
  }

  // Helper to check if a LabelOr chain is just simple labels (no AND, NOT, wildcard)
  function isSimpleOrChain(expr) {
    if (expr.type === 'LabelName') return true;
    if (expr.type === 'LabelOr') {
      return isSimpleOrChain(expr.left) && isSimpleOrChain(expr.right);
    }
    return false;
  }

  // Flatten simple OR chain to array of label names
  function flattenSimpleOrChain(expr) {
    if (expr.type === 'LabelName') return [expr.name];
    if (expr.type === 'LabelOr') {
      return [...flattenSimpleOrChain(expr.left), ...flattenSimpleOrChain(expr.right)];
    }
    return [];
  }
}

// Top-level entry point - supports multiple semicolon-separated statements
// Each statement can be a CypherStatement (UNION query or single query)
MultiStatement
  = _ head:NonEmptyCypherStatement tail:(_ ";" _ NonEmptyCypherStatement)* _ ";"? _ {
      if (tail.length === 0) {
        return head;
      }
      const statements = [head];
      for (const [_1, _semi, _2, stmt] of tail) {
        statements.push(stmt);
      }
      return {
        type: 'MultiStatement',
        statements: statements
      };
    }

// A non-empty Cypher statement - must have at least one clause
NonEmptyCypherStatement
  = head:NonEmptyQuery tail:(_ UnionKeyword _ NonEmptyQuery)+ {
      const queries = [head];
      let isAll = tail[0][1].all;
      for (const [_1, unionKw, _2, query] of tail) {
        queries.push(query);
      }
      return {
        type: 'UnionQuery',
        queries: queries,
        all: isAll
      };
    }
  / NonEmptyQuery

// A non-empty query that must start with MATCH, OPTIONAL, WITH, UNWIND, CALL, FOREACH, MERGE, CREATE, SET, DELETE, REMOVE, or RETURN
NonEmptyQuery
  = _ &(MATCH / OPTIONAL / WITH / UNWIND / CALL / FOREACH / MERGE / CREATE / SET / DELETE / REMOVE / RETURN) query:Query { return query; }

// Entry point - either a single Query or multiple Queries combined with UNION
// UNION combines results from multiple queries (removes duplicates)
// UNION ALL combines results (keeps duplicates)
CypherStatement
  = head:Query tail:(_ UnionKeyword _ Query)+ {
      // Multiple queries combined with UNION
      const queries = [head];
      // Track if ALL was specified on any UNION - if not, duplicates are removed
      // In standard Cypher, all UNIONs in a sequence must be the same (all UNION or all UNION ALL)
      // We use the first UNION type for consistency
      let isAll = tail[0][1].all;
      for (const [_1, unionKw, _2, query] of tail) {
        queries.push(query);
      }
      return {
        type: 'UnionQuery',
        queries: queries,
        all: isAll
      };
    }
  / Query

UnionKeyword
  = UNION _ ALL { return { all: true }; }
  / UNION { return { all: false }; }

// Main Query
// MATCH is optional to support standalone CREATE/MERGE operations
// RETURN is optional for mutation-only queries (valid Cypher)
// CREATE and MERGE can be intermixed in any order (standard Cypher behavior)
// Supports flexible clause ordering with segments (MATCH...CREATE...WITH...MATCH...CREATE...)
// Also supports RETURN-only queries (e.g., RETURN 1+2, RETURN true AND false)
Query
  = _ segments:QuerySegment+
    ret:ReturnClause?
    groupBy:GroupByClause?
    orderBy:OrderByClause?
    skip:SkipClause?
    limit:LimitClause?
    _ {
      // Flatten all segments into a single query structure
      // but preserve segment boundaries for execution
      const allMatches = [];
      const allWithClauses = [];
      const allUnwindClauses = [];
      const allCallClauses = [];
      const allForeach = [];
      const allMutations = [];
      let set = null;
      let remove = null;
      let delete_ = null;

      for (const segment of segments) {
        if (segment.matches) allMatches.push(...segment.matches);
        if (segment.with) allWithClauses.push(...segment.with);
        if (segment.unwind) allUnwindClauses.push(...segment.unwind);
        if (segment.call) allCallClauses.push(...segment.call);
        if (segment.foreach) allForeach.push(...segment.foreach);
        if (segment.mutations) allMutations.push(...segment.mutations);
        if (segment.set) set = segment.set;
        if (segment.remove) remove = segment.remove;
        if (segment.delete) delete_ = segment.delete;
      }

      // Separate mutations into merge and create clauses
      const merge = allMutations.filter(m => m.type === 'MergeClause');
      const createClauses = allMutations.filter(m => m.type === 'CreateClause');
      // Flatten multiple CREATE clauses into a single create with all patterns
      const allCreatePatterns = createClauses.flatMap(c => c.patterns);
      const mergedCreate = allCreatePatterns.length > 0
        ? { type: 'CreateClause', patterns: allCreatePatterns }
        : null;
      return {
        type: 'Query',
        matches: allMatches,
        ...(allWithClauses.length > 0 && { with: allWithClauses }),
        ...(allUnwindClauses.length > 0 && { unwind: allUnwindClauses }),
        ...(allCallClauses.length > 0 && { call: allCallClauses }),
        ...(allForeach.length > 0 && { foreach: allForeach }),
        ...(merge.length > 0 && { merge: merge }),
        ...(mergedCreate && { create: mergedCreate }),
        // Preserve original mutation order for correct execution sequencing
        ...(allMutations.length > 0 && { mutations: allMutations }),
        ...(set && { set: set }),
        ...(remove && { remove: remove }),
        ...(delete_ && { delete: delete_ }),
        ...(ret && { return: ret }),
        ...(groupBy && { groupBy }),
        ...(orderBy && { orderBy }),
        ...(skip && { skip: skip.skip }),
        ...(limit && { limit: limit.limit }),
        // Store segments for proper execution ordering
        segments: segments
      };
    }
  // RETURN-only query: just a RETURN clause with optional ORDER BY/SKIP/LIMIT
  / _ ret:ReturnClause
    orderBy:OrderByClause?
    skip:SkipClause?
    limit:LimitClause?
    _ {
      return {
        type: 'Query',
        matches: [],
        return: ret,
        ...(orderBy && { orderBy }),
        ...(skip && { skip: skip.skip }),
        ...(limit && { limit: limit.limit }),
        segments: []
      };
    }

// A query segment is a sequence of clauses that may end with a WITH clause
// This allows patterns like: MATCH...CREATE...WITH...MATCH...CREATE...
// Must contain at least one clause to avoid infinite loops
QuerySegment
  = segment:NonEmptyQuerySegment { return segment; }

// A non-empty segment with at least one clause
NonEmptyQuerySegment
  = matches:MatchClauseWithWhere+
    unwindClauses:UnwindClause*
    callClauses:CallClause*
    foreach:ForeachClause*
    mutations:MutationClause*
    set:SetClause?
    remove:RemoveClause?
    delete_:DeleteClause?
    withClause:WithClause? {
      const segment = { matches };
      if (unwindClauses.length > 0) segment.unwind = unwindClauses;
      if (callClauses.length > 0) segment.call = callClauses;
      if (foreach.length > 0) segment.foreach = foreach;
      if (mutations.length > 0) segment.mutations = mutations;
      if (set) segment.set = set;
      if (remove) segment.remove = remove;
      if (delete_) segment.delete = delete_;
      if (withClause) segment.with = [withClause];
      return segment;
    }
  / unwindClauses:UnwindClause+
    callClauses:CallClause*
    foreach:ForeachClause*
    mutations:MutationClause*
    set:SetClause?
    remove:RemoveClause?
    delete_:DeleteClause?
    withClause:WithClause? {
      const segment = { unwind: unwindClauses };
      if (callClauses.length > 0) segment.call = callClauses;
      if (foreach.length > 0) segment.foreach = foreach;
      if (mutations.length > 0) segment.mutations = mutations;
      if (set) segment.set = set;
      if (remove) segment.remove = remove;
      if (delete_) segment.delete = delete_;
      if (withClause) segment.with = [withClause];
      return segment;
    }
  / callClauses:CallClause+
    foreach:ForeachClause*
    mutations:MutationClause*
    set:SetClause?
    remove:RemoveClause?
    delete_:DeleteClause?
    withClause:WithClause? {
      const segment = { call: callClauses };
      if (foreach.length > 0) segment.foreach = foreach;
      if (mutations.length > 0) segment.mutations = mutations;
      if (set) segment.set = set;
      if (remove) segment.remove = remove;
      if (delete_) segment.delete = delete_;
      if (withClause) segment.with = [withClause];
      return segment;
    }
  / foreach:ForeachClause+
    mutations:MutationClause*
    set:SetClause?
    remove:RemoveClause?
    delete_:DeleteClause?
    withClause:WithClause? {
      const segment = { foreach };
      if (mutations.length > 0) segment.mutations = mutations;
      if (set) segment.set = set;
      if (remove) segment.remove = remove;
      if (delete_) segment.delete = delete_;
      if (withClause) segment.with = [withClause];
      return segment;
    }
  / mutations:MutationClause+
    set:SetClause?
    remove:RemoveClause?
    delete_:DeleteClause?
    withClause:WithClause? {
      const segment = { mutations };
      if (set) segment.set = set;
      if (remove) segment.remove = remove;
      if (delete_) segment.delete = delete_;
      if (withClause) segment.with = [withClause];
      return segment;
    }
  / set:SetClause
    remove:RemoveClause?
    delete_:DeleteClause?
    withClause:WithClause? {
      const segment = { set };
      if (remove) segment.remove = remove;
      if (delete_) segment.delete = delete_;
      if (withClause) segment.with = [withClause];
      return segment;
    }
  / remove:RemoveClause
    delete_:DeleteClause?
    withClause:WithClause? {
      const segment = { remove };
      if (delete_) segment.delete = delete_;
      if (withClause) segment.with = [withClause];
      return segment;
    }
  / delete_:DeleteClause
    withClause:WithClause? {
      const segment = { delete: delete_ };
      if (withClause) segment.with = [withClause];
      return segment;
    }
  / withClause:WithClause {
      return { with: [withClause] };
    }

// Mutation clause - either MERGE or CREATE (can be intermixed)
MutationClause
  = MergeClause
  / CreateClause

// SET Clause (standalone, for mutations)
SetClause
  = SET _ assignments:SetAssignmentList _ {
      return {
        type: 'SetClause',
        assignments: assignments
      };
    }

// DELETE Clause
DeleteClause
  = DETACH _ DELETE _ variables:DeleteVariableList _ {
      return {
        type: 'DeleteClause',
        detach: true,
        variables: variables
      };
    }
  / DELETE _ variables:DeleteVariableList _ {
      return {
        type: 'DeleteClause',
        detach: false,
        variables: variables
      };
    }

DeleteVariableList
  = head:ExpressionIdentifier tail:(_ "," _ ExpressionIdentifier)* {
      return [head, ...tail.map(t => t[3])];
    }

// REMOVE Clause
RemoveClause
  = REMOVE _ items:RemoveItemList _ {
      return {
        type: 'RemoveClause',
        items: items
      };
    }

RemoveItemList
  = head:RemoveItem tail:(_ "," _ RemoveItem)* {
      return [head, ...tail.map(t => t[3])];
    }

RemoveItem
  = variable:ExpressionIdentifier "." property:PropertyIdentifier {
      return { type: 'RemoveProperty', variable: variable, property: property };
    }
  / variable:ExpressionIdentifier ":" label:LabelIdentifier {
      return { type: 'RemoveLabel', variable: variable, label: label };
    }

// MERGE Clause
MergeClause
  = MERGE _ pattern:MergePattern _ onCreate:OnCreateClause? _ onMatch:OnMatchClause? _ {
      return {
        type: 'MergeClause',
        pattern: pattern,
        ...(onCreate && { onCreate: onCreate }),
        ...(onMatch && { onMatch: onMatch })
      };
    }

MergePattern
  = "(" _ startVar:Identifier _ ")" _ edge:MergeEdgePattern _ "(" _ endVar:Identifier _ ")" {
      return {
        type: 'MergeRelationshipPattern',
        startVariable: startVar,
        edge: edge,
        endVariable: endVar
      };
    }
  / NodePattern

MergeEdgePattern
  = "-[" _ variable:Identifier? ":" _ label:LabelIdentifier _ props:PropertyMap? _ "]->" {
      return {
        type: 'MergeEdgePattern',
        variable: variable,
        label: label,
        direction: 'out',
        properties: props || {}
      };
    }
  / "<-[" _ variable:Identifier? ":" _ label:LabelIdentifier _ props:PropertyMap? _ "]-" {
      return {
        type: 'MergeEdgePattern',
        variable: variable,
        label: label,
        direction: 'in',
        properties: props || {}
      };
    }

OnCreateClause
  = ON _ CREATE _ SET _ assignments:SetAssignmentList {
      return { assignments: assignments };
    }

OnMatchClause
  = ON _ MATCH _ SET _ assignments:SetAssignmentList {
      return { assignments: assignments };
    }

// CREATE Clause
CreateClause
  = CREATE _ patterns:CreatePatternList _ {
      return {
        type: 'CreateClause',
        patterns: patterns
      };
    }

CreatePatternList
  = head:CreatePattern tail:(_ "," _ CreatePattern)* {
      return [head, ...tail.map(t => t[3])];
    }

CreatePattern
  = CreateChainPattern
  / CreateNodePattern

CreateNodePattern
  = "(" _ variable:Identifier? labels:NodeLabels? _ props:PropertyMap? _ ")" {
      return {
        type: 'CreateNodePattern',
        variable: variable || undefined,
        labels: labels?.simpleLabels || [],
        ...(props && Object.keys(props).length > 0 && { properties: props })
      };
    }

// Create chain pattern: supports chains like (a)-[:R1]->(b)-[:R2]->(c)
// Each node can be either a variable reference or a new node with labels
CreateChainPattern
  = head:CreateChainNode _ tail:CreateEdgeAndNode+ {
      // Build a chain of elements: [node, edge, node, edge, node, ...]
      const elements = [head];
      for (const [edge, node] of tail) {
        elements.push(edge);
        elements.push(node);
      }
      return {
        type: 'CreateChainPattern',
        elements: elements
      };
    }

CreateEdgeAndNode
  = edge:CreateEdgePattern _ node:CreateChainNode {
      return [edge, node];
    }

// A node in a CREATE chain - can be a reference, a new labeled node, or an unlabeled node
CreateChainNode
  = "(" _ variable:Identifier? labels:NodeLabels? _ props:PropertyMap? _ ")" {
      // Extract simple labels from NodeLabels result
      const simpleLabels = labels?.simpleLabels || [];
      // If labels are present, it's a new node to create
      if (simpleLabels.length > 0) {
        return {
          type: 'CreateNodePattern',
          variable: variable || undefined,
          labels: simpleLabels,
          ...(props && Object.keys(props).length > 0 && { properties: props })
        };
      }
      // If no labels but has a variable and no props, it's a reference to existing node
      if (variable && (!props || Object.keys(props).length === 0)) {
        return {
          type: 'CreateVariableRef',
          variable: variable
        };
      }
      // Otherwise it's an unlabeled node to create (with optional variable and properties)
      return {
        type: 'CreateNodePattern',
        variable: variable || undefined,
        labels: [],
        ...(props && Object.keys(props).length > 0 && { properties: props })
      };
    }

CreateEdgePattern
  = "-[" _ variable:Identifier? ":" _ label:LabelIdentifier _ props:PropertyMap? _ "]->" {
      return {
        type: 'CreateEdgePattern',
        variable: variable,
        label: label,
        direction: 'out',
        properties: props || {}
      };
    }
  / "<-[" _ variable:Identifier? ":" _ label:LabelIdentifier _ props:PropertyMap? _ "]-" {
      return {
        type: 'CreateEdgePattern',
        variable: variable,
        label: label,
        direction: 'in',
        properties: props || {}
      };
    }

MatchClauseWithWhere
  = match:MatchClause _ where:WhereClause? _ {
      return {
        ...match,
        ...(where && { where })
      };
    }

// FOREACH Clause
// Iterates over a list and executes operations for each element
// Syntax: FOREACH (variable IN expression | operations)
ForeachClause
  = FOREACH _ "(" _ variable:Identifier _ IN _ listExpr:ListExpression _ "|" _ operations:ForeachOperations _ ")" _ {
      return {
        type: 'ForeachClause',
        variable: variable,
        listExpression: listExpr,
        operations: operations
      };
    }

// List expression for FOREACH - supports property access, literals, variables, and function calls
ListExpression
  = variable:ExpressionIdentifier "." property:PropertyIdentifier {
      return {
        type: 'PropertyAccess',
        variable: variable,
        property: property
      };
    }
  / list:ListLiteral {
      return {
        type: 'ListLiteral',
        values: list
      };
    }
  / func:FunctionCallExpression {
      return func;
    }
  / variable:ExpressionIdentifier {
      return {
        type: 'VariableRef',
        variable: variable
      };
    }

ForeachOperations
  = head:ForeachOperation tail:(_ ForeachOperation)* {
      return [head, ...tail.map(t => t[1])];
    }

ForeachOperation
  = SetOperation
  / DeleteOperation
  / MatchClauseWithWhere

SetOperation
  = SET _ assignments:SetAssignmentList {
      return {
        type: 'SetOperation',
        assignments: assignments
      };
    }

// DELETE operation inside FOREACH
// Supports both DETACH DELETE and DELETE
DeleteOperation
  = DETACH _ DELETE _ variables:DeleteVariableList {
      return {
        type: 'DeleteOperation',
        detach: true,
        variables: variables
      };
    }
  / DELETE _ variables:DeleteVariableList {
      return {
        type: 'DeleteOperation',
        detach: false,
        variables: variables
      };
    }

// WITH Clause - intermediate projection for query composition
// Syntax: WITH [DISTINCT] items [ORDER BY ...] [SKIP n] [LIMIT n] [WHERE ...]
WithClause
  = WITH _ distinct:DISTINCT? _ items:WithItemList _ orderBy:OrderByClause? skip:SkipClause? limit:LimitClause? where:WhereClause? _ {
      return {
        type: 'WithClause',
        distinct: distinct !== null,
        items: items,
        ...(orderBy && { orderBy: orderBy }),
        ...(skip && { skip: skip.skip }),
        ...(limit && { limit: limit.limit }),
        ...(where && { where: where })
      };
    }

WithItemList
  = head:WithItem tail:(_ "," _ WithItem)* {
      return [head, ...tail.map(t => t[3])];
    }

WithItem
  = expr:WithExpression _ AS _ alias:AliasIdentifier {
      return {
        type: 'WithItem',
        expression: expr,
        alias: alias
      };
    }
  / variable:ExpressionIdentifier {
      // Shorthand: WITH x is equivalent to WITH x AS x
      return {
        type: 'WithItem',
        expression: { type: 'VariableRef', variable: variable },
        alias: variable
      };
    }

WithExpression
  = COUNT _ "(" _ "*" _ ")" {
      // count(*) counts all rows
      return {
        type: 'WithAggregate',
        function: 'COUNT',
        variable: '*'
      };
    }
  / COUNT _ "(" _ variable:ExpressionIdentifier _ ")" {
      return {
        type: 'WithAggregate',
        function: 'COUNT',
        variable: variable
      };
    }
  / SUM _ "(" _ variable:ExpressionIdentifier "." property:PropertyIdentifier _ ")" {
      return {
        type: 'WithAggregate',
        function: 'SUM',
        variable: variable,
        property: property
      };
    }
  / AVG _ "(" _ variable:ExpressionIdentifier "." property:PropertyIdentifier _ ")" {
      return {
        type: 'WithAggregate',
        function: 'AVG',
        variable: variable,
        property: property
      };
    }
  / MIN _ "(" _ variable:ExpressionIdentifier "." property:PropertyIdentifier _ ")" {
      return {
        type: 'WithAggregate',
        function: 'MIN',
        variable: variable,
        property: property
      };
    }
  / MAX _ "(" _ variable:ExpressionIdentifier "." property:PropertyIdentifier _ ")" {
      return {
        type: 'WithAggregate',
        function: 'MAX',
        variable: variable,
        property: property
      };
    }
  / COLLECT _ "(" _ variable:ExpressionIdentifier _ ")" {
      return {
        type: 'WithAggregate',
        function: 'COLLECT',
        variable: variable
      };
    }
  / func:FunctionCallExpression {
      return func;
    }
  / ListLiteralExpr
  / ArithmeticExpression

// UNWIND Clause - expands a list into individual rows
// Syntax: UNWIND expr AS variable
UnwindClause
  = UNWIND _ expr:UnwindExpression _ AS _ alias:AliasIdentifier _ {
      return {
        type: 'UnwindClause',
        expression: expr,
        alias: alias
      };
    }

// UnwindExpression can be a list literal, null, function call, property access, variable reference, parameter, or parenthesized expression
UnwindExpression
  = NullLiteral {
      return {
        type: 'NullLiteral',
        value: null
      };
    }
  / ListLiteralExpr
  / ParameterRef
  / FunctionCallExpression
  / "(" _ expr:ArithmeticExpression _ ")" {
      return expr;
    }
  / variable:ExpressionIdentifier "." property:PropertyIdentifier {
      return {
        type: 'PropertyAccess',
        variable: variable,
        property: property
      };
    }
  / variable:ExpressionIdentifier {
      return {
        type: 'VariableRef',
        variable: variable
      };
    }

// CALL Clause - invokes a procedure
// Syntax: CALL procedure.name(args) [YIELD column [AS alias], ...]
CallClause
  = CALL _ name:ProcedureName _ "(" _ args:CallArgumentList? _ ")" _ yield_:YieldClause? _ {
      return {
        type: 'CallClause',
        procedure: name,
        arguments: args || [],
        ...(yield_ && { yield: yield_ })
      };
    }

// Procedure name - can be a qualified name like db.labels or a simple name
// Uses ProcedureIdentifier instead of Identifier to allow keywords (e.g., labels, type)
ProcedureName
  = head:ProcedureIdentifier tail:("." ProcedureIdentifier)* {
      const parts = [head, ...tail.map(t => t[1])];
      return parts.join('.');
    }

// Procedure identifiers allow keywords as parts (e.g., db.labels, dbms.procedures)
ProcedureIdentifier
  = BacktickIdentifier
  / head:[a-zA-Z_] tail:[a-zA-Z0-9_]* {
      return head + tail.join('');
    }

// Arguments to a procedure call
CallArgumentList
  = head:ArithmeticExpression tail:(_ "," _ ArithmeticExpression)* {
      return [head, ...tail.map(t => t[3])];
    }

// YIELD clause for procedure calls
YieldClause
  = YIELD _ items:YieldItemList {
      return items;
    }

// List of YIELD items
YieldItemList
  = head:YieldItem tail:(_ "," _ YieldItem)* {
      return [head, ...tail.map(t => t[3])];
    }

// A single YIELD item: column [AS alias]
// Uses ProcedureIdentifier to allow keywords as yield column names (e.g., label, type)
YieldItem
  = name:ProcedureIdentifier _ AS _ alias:ProcedureIdentifier {
      return { name: name, alias: alias };
    }
  / name:ProcedureIdentifier {
      return { name: name };
    }

SetAssignmentList
  = head:SetAssignment tail:(_ "," _ SetAssignment)* {
      return [head, ...tail.map(t => t[3])];
    }

// SetAssignment supports three forms:
// 1. n.property = value (individual property assignment)
// 2. n = {props} or n = $param (replace all properties)
// 3. n += {props} or n += $param (add/merge properties)
SetAssignment
  = variable:ExpressionIdentifier _ "+=" _ props:SetMapValue {
      // Add/merge properties: n += {props}
      return {
        type: 'SetAddProperties',
        variable: variable,
        properties: props
      };
    }
  / variable:ExpressionIdentifier _ "=" _ props:SetMapValue {
      // Replace all properties: n = {props}
      return {
        type: 'SetAllProperties',
        variable: variable,
        properties: props
      };
    }
  / variable:ExpressionIdentifier "." property:PropertyIdentifier _ "=" _ value:SetValue {
      // Individual property assignment: n.prop = value
      return {
        variable: variable,
        property: property,
        value: value
      };
    }

// Value for map-based SET operations (n = {props} or n += {props})
// Can be a property map literal or a parameter reference
SetMapValue
  = PropertyMap
  / ParameterRef

SetValue
  = PropertyListLiteral
  / NestedPropertyMap
  / Literal
  / ParameterRef
  / variable:ExpressionIdentifier "." property:PropertyIdentifier {
      return {
        type: 'PropertyAccess',
        variable: variable,
        property: property
      };
    }
  / variable:ExpressionIdentifier {
      return {
        type: 'VariableRef',
        variable: variable
      };
    }

// Parameter reference for parameterized queries ($paramName)
// Note: Uses ParameterIdentifier which allows keywords as names (e.g., $end, $match)
ParameterRef
  = "$" name:ParameterIdentifier {
      return {
        type: 'ParameterRef',
        name: name
      };
    }

// Parameter name identifier - allows keywords since $ prefix makes it unambiguous
// Also supports backtick-quoted form for special characters
ParameterIdentifier
  = BacktickIdentifier
  / head:[a-zA-Z_] tail:[a-zA-Z0-9_]* {
      return head + tail.join('');
    }

// MATCH Clause - supports comma-separated patterns for cross-product matching
// e.g., MATCH (a:User), (b:Post) matches all combinations of Users and Posts
// OPTIONAL MATCH returns null bindings when no match is found
MatchClause
  = optional:(OPTIONAL _)? MATCH _ pathAssignment:PathAssignment {
      return {
        type: 'MatchClause',
        pattern: pathAssignment,
        optional: optional !== null
      };
    }
  / optional:(OPTIONAL _)? MATCH _ patterns:PatternList {
      // If single pattern, return as-is. If multiple, wrap in MultiPattern.
      if (patterns.length === 1) {
        return {
          type: 'MatchClause',
          pattern: patterns[0],
          optional: optional !== null
        };
      }
      return {
        type: 'MatchClause',
        pattern: {
          type: 'MultiPattern',
          patterns: patterns
        },
        optional: optional !== null
      };
    }

// Comma-separated list of patterns for MATCH clause
PatternList
  = head:Pattern tail:(_ "," _ Pattern)* {
      return [head, ...tail.map(t => t[3])];
    }

// Path Assignment for named paths (p = pattern) and shortestPath/allShortestPaths
PathAssignment
  = variable:Identifier _ "=" _ spPattern:ShortestPathFunction {
      return { ...spPattern, variable: variable };
    }
  / spPattern:ShortestPathFunction {
      return spPattern;
    }
  / variable:Identifier _ "=" _ pattern:Pattern {
      return { ...pattern, pathVariable: variable };
    }

// shortestPath and allShortestPaths functions
ShortestPathFunction
  = SHORTESTPATH _ "(" _ "(" _ source:NodePatternBody _ ")" _ edge:EdgePattern _ "(" _ target:NodePatternBody _ ")" _ ")" {
      return {
        type: 'ShortestPathPattern',
        source: {
          type: 'NodePattern',
          ...source
        },
        target: {
          type: 'NodePattern',
          ...target
        },
        edge: edge,
        all: false
      };
    }
  / ALLSHORTESTPATHS _ "(" _ "(" _ source:NodePatternBody _ ")" _ edge:EdgePattern _ "(" _ target:NodePatternBody _ ")" _ ")" {
      return {
        type: 'ShortestPathPattern',
        source: {
          type: 'NodePattern',
          ...source
        },
        target: {
          type: 'NodePattern',
          ...target
        },
        edge: edge,
        all: true
      };
    }

// Node pattern body (without parentheses)
NodePatternBody
  = variable:Identifier? labels:NodeLabels? _ props:PropertyMap? {
      const result = {
        variable: variable || undefined,
        labels: labels?.simpleLabels || [],
        ...(props && Object.keys(props).length > 0 && { properties: props })
      };
      if (labels?.labelExpression) {
        result.labelExpression = labels.labelExpression;
      }
      return result;
    }

// Pattern matching
Pattern
  = elements:PatternSequence {
      return {
        type: 'Pattern',
        elements: elements
      };
    }

PatternSequence
  = head:PatternElement _ tail:PatternElementTail* {
      const result = [head];
      for (const elem of tail) {
        if (Array.isArray(elem)) {
          // Edge and optional node from EdgeAndNodePattern
          const [edge, node] = elem;
          result.push(edge);
          if (node) result.push(node);
        } else {
          // ParenthesizedPathPattern
          result.push(elem);
        }
      }
      return result;
    }

PatternElementTail
  = EdgeAndNodePattern
  / _ p:ParenthesizedPathPattern { return p; }

EdgeAndNodePattern
  = edge:EdgePattern _ node:NodePattern? _ {
      return [edge, node];
    }

PatternElement
  = NodePattern
  / ParenthesizedPathPattern

// Parenthesized path pattern with optional inline WHERE condition
// Syntax: ((node_pattern)-[edge]->(node_pattern) WHERE condition)+
// The parentheses group a sub-pattern that can be quantified
ParenthesizedPathPattern
  = "(" _ "(" _ innerElements:ParenthesizedInnerPattern _ ")" _ where:(WHERE _ OrCondition)? _ ")" _ quantifier:Quantifier? {
      return {
        type: 'ParenthesizedPathPattern',
        pattern: {
          type: 'Pattern',
          elements: innerElements
        },
        ...(where && { where: where[2] }),
        ...(quantifier && { quantifier: quantifier })
      };
    }

// Inner pattern within parentheses - can be a full pattern sequence
ParenthesizedInnerPattern
  = head:NodePattern _ tail:EdgeAndNodePattern* {
      const result = [head];
      for (const [edge, node] of tail) {
        result.push(edge);
        if (node) result.push(node);
      }
      return result;
    }

NodePattern
  = "(" _ variable:Identifier? labels:NodeLabels? _ props:PropertyMap? _ ")" {
      // If we have a label expression, use that; otherwise use simple labels array
      const result = {
        type: 'NodePattern',
        variable: variable || undefined,
        labels: labels?.simpleLabels || [],
        ...(props && Object.keys(props).length > 0 && { properties: props })
      };
      if (labels?.labelExpression) {
        result.labelExpression = labels.labelExpression;
      }
      return result;
    }

// NodeLabels supports two forms:
// 1. Simple multi-label: :A:B:C (backwards compatible, colon-separated AND semantics)
// 2. Advanced expression: :A|B, :(A&B), :!A, :% (single colon with expression)
NodeLabels
  = ":" _ head:LabelIdentifier tail:(_ ":" _ LabelIdentifier)+ {
      // Multiple colon-separated labels (traditional syntax :A:B:C)
      // Return as simple labels array for backwards compatibility
      return { simpleLabels: [head, ...tail.map(t => t[3])] };
    }
  / ":" _ expr:LabelExpression {
      // Single label or advanced expression
      if (expr.type === 'LabelName') {
        return { simpleLabels: [expr.name] };
      }
      return { simpleLabels: [], labelExpression: expr };
    }

// Label expression precedence (lowest to highest): | (OR), & (AND), ! (NOT)
LabelExpression
  = LabelOrExpression

LabelOrExpression
  = head:LabelAndExpression tail:(_ "|" _ LabelAndExpression)* {
      return tail.reduce((left, [_1, _2, _3, right]) => ({
        type: 'LabelOr',
        left,
        right
      }), head);
    }

LabelAndExpression
  = head:LabelNotExpression tail:(_ "&" _ LabelNotExpression)* {
      return tail.reduce((left, [_1, _2, _3, right]) => ({
        type: 'LabelAnd',
        left,
        right
      }), head);
    }

LabelNotExpression
  = "!" _ expr:LabelNotExpression {
      return { type: 'LabelNot', expression: expr };
    }
  / LabelPrimaryExpression

LabelPrimaryExpression
  = "%" { return { type: 'LabelWildcard' }; }
  / "(" _ expr:LabelExpression _ ")" { return expr; }
  / name:LabelIdentifier { return { type: 'LabelName', name }; }

// Inline property map for node patterns, e.g., {name: 'Group', age: 25}
PropertyMap
  = "{" _ "}" { return {}; }
  / "{" _ head:PropertyEntry tail:(_ "," _ PropertyEntry)* _ "}" {
      const result = { [head.key]: head.value };
      for (const [_1, _2, _3, entry] of tail) {
        result[entry.key] = entry.value;
      }
      return result;
    }

// PropertyValue can be a literal value, a parameter reference, nested map, list, or variable expression
// This allows patterns like {name: $nameParam, age: 30, schema: {type: "string"}, items: [1, 2, 3]} in MERGE, CREATE, MATCH
PropertyValue
  = ParameterRef
  / NestedPropertyMap
  / PropertyListLiteral
  / variable:ExpressionIdentifier "." property:PropertyIdentifier {
      return { type: 'PropertyAccess', variable: variable, property: property };
    }
  / Literal
  / variable:ExpressionIdentifier !("(" / _ ".") {
      // VariableRef - but not if followed by ( which would be a function call
      // or by . which would be property access already captured above
      return { type: 'VariableRef', variable: variable };
    }

// List literal for property values - supports nested lists and mixed types
PropertyListLiteral
  = "[" _ "]" { return { type: 'ListLiteral', values: [] }; }
  / "[" _ head:PropertyListElement tail:(_ "," _ PropertyListElement)* _ "]" {
      return { type: 'ListLiteral', values: [head, ...tail.map(t => t[3])] };
    }

PropertyListElement
  = PropertyListLiteral
  / Literal

// Nested property map for object-valued properties
NestedPropertyMap
  = "{" _ "}" {
      return { type: 'NestedMap', value: {} };
    }
  / "{" _ head:PropertyEntry tail:(_ "," _ PropertyEntry)* _ "}" {
      const result = { [head.key]: head.value };
      for (const [_1, _2, _3, entry] of tail) {
        result[entry.key] = entry.value;
      }
      return { type: 'NestedMap', value: result };
    }

PropertyEntry
  = key:PropertyKey _ ":" _ value:PropertyValue {
      return { key, value };
    }

// PropertyKey allows identifiers and quoted strings for JSON-style syntax
// Examples: {type: "string"} or {"type": "string"}
PropertyKey
  = PropertyIdentifier
  / StringLiteral

EdgePattern
  = direction:EdgeDirection {
      return direction;
    }

EdgeDirection
  = "<-" labels:EdgeLabels? "-" {
      return {
        type: 'EdgePattern',
        variable: labels?.variable,
        labels: labels?.labels || [],
        direction: 'in',
        quantifier: labels?.quantifier,
        ...(labels?.properties && { properties: labels.properties })
      };
    }
  / "-" labels:EdgeLabels? "->" {
      return {
        type: 'EdgePattern',
        variable: labels?.variable,
        labels: labels?.labels || [],
        direction: 'out',
        quantifier: labels?.quantifier,
        ...(labels?.properties && { properties: labels.properties })
      };
    }
  / "-" labels:EdgeLabels? "-" {
      return {
        type: 'EdgePattern',
        variable: labels?.variable,
        labels: labels?.labels || [],
        direction: 'both',
        quantifier: labels?.quantifier,
        ...(labels?.properties && { properties: labels.properties })
      };
    }
  / "<-" {
      return {
        type: 'EdgePattern',
        variable: undefined,
        labels: [],
        direction: 'in',
        quantifier: undefined
      };
    }
  / "->" {
      return {
        type: 'EdgePattern',
        variable: undefined,
        labels: [],
        direction: 'out',
        quantifier: undefined
      };
    }
  / "-" {
      return {
        type: 'EdgePattern',
        variable: undefined,
        labels: [],
        direction: 'both',
        quantifier: undefined
      };
    }

EdgeLabels
  = "[" _ quantifier:Quantifier _ props:PropertyMap? _ "]" {
      // Just [*] or [*2] or [*1..3] without variable or label
      return {
        variable: undefined,
        labels: [],
        quantifier: quantifier,
        ...(props && Object.keys(props).length > 0 && { properties: props })
      };
    }
  / "[" _ variable:EdgeVariable _ quantifier:Quantifier? _ props:PropertyMap? _ "]" {
      return {
        variable: variable,
        labels: [],
        quantifier: quantifier,
        ...(props && Object.keys(props).length > 0 && { properties: props })
      };
    }
  / "[" _ variable:EdgeVariable? ":" _ "]" {
      // Empty label case: [r:] or [:]
      return {
        variable: variable,
        labels: [],
        quantifier: undefined
      };
    }
  / "[" _ variable:EdgeVariable? ":" _ expr:LabelExpression _ quantifier:Quantifier? _ props:PropertyMap? _ "]" {
      // Label expression for edges (simple OR chains or advanced expressions)
      const result = {
        variable: variable,
        labels: [],
        quantifier: quantifier,
        ...(props && Object.keys(props).length > 0 && { properties: props })
      };
      // For simple LabelName, use labels array for backwards compatibility
      if (expr.type === 'LabelName') {
        result.labels = [expr.name];
      } else if (expr.type === 'LabelOr' && isSimpleOrChain(expr)) {
        // For simple OR chains (A|B|C), flatten to labels array
        result.labels = flattenSimpleOrChain(expr);
      } else {
        result.labelExpression = expr;
      }
      return result;
    }

EdgeVariable
  = id:Identifier _ { return id; }

Quantifier
  // Curly brace syntax: {n}, {n,m}, {n,}, {,m}
  = "{" _ min:Integer _ "," _ max:Integer _ "}" {
      return {
        type: 'Quantifier',
        min: min,
        max: max
      };
    }
  / "{" _ min:Integer _ "," _ "}" {
      return {
        type: 'Quantifier',
        min: min,
        max: undefined
      };
    }
  / "{" _ "," _ max:Integer _ "}" {
      return {
        type: 'Quantifier',
        min: 0,
        max: max
      };
    }
  / "{" _ exact:Integer _ "}" {
      return {
        type: 'Quantifier',
        min: exact,
        max: exact
      };
    }
  // Plus quantifier: one or more
  / "+" {
      return {
        type: 'Quantifier',
        min: 1,
        max: undefined
      };
    }
  // Asterisk range syntax: *n..m, *n.., *..m, *n, *
  // Note: In Cypher, *..n defaults min to 1 (not 0), and bare * means 1+
  / "*" ".." max:Integer {
      return {
        type: 'Quantifier',
        min: 1,
        max: max
      };
    }
  / "*" min:Integer ".." max:Integer {
      return {
        type: 'Quantifier',
        min: min,
        max: max
      };
    }
  / "*" min:Integer ".." {
      return {
        type: 'Quantifier',
        min: min,
        max: undefined
      };
    }
  / "*" exact:Integer {
      return {
        type: 'Quantifier',
        min: exact,
        max: exact
      };
    }
  / "*" {
      return {
        type: 'Quantifier',
        min: 1,
        max: undefined
      };
    }

// WHERE Clause
WhereClause
  = WHERE _ condition:OrCondition _ {
      return {
        type: 'WhereClause',
        condition: condition
      };
    }

OrCondition
  = head:XorCondition tail:(_ OR _ XorCondition)* {
      return buildBinaryCondition(head, tail, 'OR');
    }

XorCondition
  = head:AndCondition tail:(_ XOR _ AndCondition)* {
      return buildBinaryCondition(head, tail, 'XOR');
    }

AndCondition
  = head:PrimaryCondition tail:(_ AND _ PrimaryCondition)* {
      return buildBinaryCondition(head, tail, 'AND');
    }

// Primary condition alternatives - ORDER MATTERS:
// 1. PatternExistsCondition MUST come before parenthesized conditions to prevent
//    patterns like (n)-[:REL]->(m) from being parsed as "( n )" where n is a variable
// 2. VariableAsCondition should come late to avoid matching keywords or expressions
PrimaryCondition
  = PatternExistsCondition
  / "(" _ condition:OrCondition _ ")" { return condition; }
  / NotCondition
  / InCondition
  / IsLabeledCondition
  / IsNullCondition
  / GeneralIsNullCondition
  / StringPredicateCondition
  / RegexCondition
  / QuantifierCondition
  / PropertyCondition
  / BooleanLiteralCondition
  / VariableAsCondition
  / ExistsSubqueryCondition
  / FunctionalExistsCondition
  / ExistsCondition

// Boolean literal condition - bare true or false as a condition
// Syntax: WHERE true or WHERE false
BooleanLiteralCondition
  = value:BooleanLiteral {
      return {
        type: 'ExpressionCondition',
        left: value,
        operator: '=',
        right: true
      };
    }

// Variable reference as condition - variable evaluated as boolean
// Syntax: WHERE x (where x is a boolean value)
// Excludes keywords, operators, and function/pattern syntax
// The negative lookahead prevents matching when followed by:
// - Property access (.)
// - Function call (()
// - List index ([)
// - EXISTS subquery ({)
// - Comparison operators (=, <>, etc.)
// - Regex match operator (=~)
// - IS/IN keywords
VariableAsCondition
  = !ReservedConditionWord variable:ExpressionIdentifier !(_ ("." / "(" / "[" / "{" / "=~" / ComparisonOperator / IS / IN)) {
      return {
        type: 'ExpressionCondition',
        left: { type: 'VariableRef', variable: variable },
        operator: '=',
        right: true
      };
    }

// Reserved words that cannot be used as bare variable conditions
// This list includes condition-specific keywords that could appear in WHERE clauses.
// General Cypher keywords (MATCH, RETURN, etc.) are not included because they
// cannot syntactically appear where a bare variable condition would be valid.
ReservedConditionWord
  = (EXISTS / NOT / AND / OR / XOR / STARTS / ENDS / CONTAINS / ALL / ANY / NONE / SINGLE) ![a-zA-Z0-9_]

// Pattern existence condition - checks if a pattern matches
// Syntax: (n)-[:KNOWS]->(m) as a boolean condition
// Used in WHERE clauses to check pattern existence
// IMPORTANT: This must come BEFORE the parenthesized condition rule "(" OrCondition ")"
// in PrimaryCondition, otherwise patterns like (n)-[:REL]->(m) would be incorrectly
// parsed as a parenthesized expression containing variable "n" as a condition.
PatternExistsCondition
  = pattern:Pattern {
      // Wrap the pattern in an ExistsSubquery-like structure
      return {
        type: 'ExpressionCondition',
        left: {
          type: 'ExistsSubquery',
          pattern: pattern
        },
        operator: '=',
        right: true
      };
    }

// Quantifier condition - quantifier expressions used directly as conditions
// ALL(x IN list WHERE cond), ANY(x IN list WHERE cond), etc.
QuantifierCondition
  = quantExpr:QuantifierExpression {
      // Wrap quantifier expression in ExpressionCondition comparing to true
      return {
        type: 'ExpressionCondition',
        left: quantExpr,
        operator: '=',
        right: true
      };
    }

NotCondition
  = NOT _ condition:PrimaryCondition {
      return {
        type: 'NotCondition',
        condition: condition
      };
    }

InCondition
  = variable:ExpressionIdentifier "." property:PropertyIdentifier _ IN _ list:ListLiteral {
      return {
        type: 'InCondition',
        variable: variable,
        property: property,
        values: list
      };
    }

// IS LABELED condition: checks if a variable has a specific label
// Syntax: n IS :Label or n IS :A|B (with label expression)
// Also supports n IS NOT :Label for negated form
IsLabeledCondition
  = variable:ExpressionIdentifier _ IS _ NOT _ ":" _ expr:LabelExpression {
      // Negated form: n IS NOT :Label
      return {
        type: 'NotCondition',
        condition: {
          type: 'IsLabeledCondition',
          variable: variable,
          labelExpression: expr
        }
      };
    }
  / variable:ExpressionIdentifier _ IS _ ":" _ expr:LabelExpression {
      return {
        type: 'IsLabeledCondition',
        variable: variable,
        labelExpression: expr
      };
    }

IsNullCondition
  = variable:ExpressionIdentifier "." property:PropertyIdentifier _ IS _ NOT _ NULL {
      return {
        type: 'IsNullCondition',
        variable: variable,
        property: property,
        negated: true
      };
    }
  / variable:ExpressionIdentifier "." property:PropertyIdentifier _ IS _ NULL {
      return {
        type: 'IsNullCondition',
        variable: variable,
        property: property,
        negated: false
      };
    }

// General IS NULL condition for expressions (needed for list[index] IS NULL)
// Uses PostfixExpression to support array indexing/slicing without capturing full arithmetic
GeneralIsNullCondition
  = expr:PostfixExpression _ IS _ NOT _ NULL {
      return {
        type: 'ExpressionCondition',
        left: expr,
        operator: '!=',
        right: null
      };
    }
  / expr:PostfixExpression _ IS _ NULL {
      return {
        type: 'ExpressionCondition',
        left: expr,
        operator: '=',
        right: null
      };
    }

StringPredicateCondition
  = variable:ExpressionIdentifier "." property:PropertyIdentifier _ STARTS _ WITH _ value:(StringLiteral / NullLiteral) {
      return {
        type: 'StringPredicateCondition',
        variable: variable,
        property: property,
        predicate: 'STARTS WITH',
        value: value
      };
    }
  / variable:ExpressionIdentifier "." property:PropertyIdentifier _ ENDS _ WITH _ value:(StringLiteral / NullLiteral) {
      return {
        type: 'StringPredicateCondition',
        variable: variable,
        property: property,
        predicate: 'ENDS WITH',
        value: value
      };
    }
  / variable:ExpressionIdentifier "." property:PropertyIdentifier _ CONTAINS _ value:(StringLiteral / NullLiteral) {
      return {
        type: 'StringPredicateCondition',
        variable: variable,
        property: property,
        predicate: 'CONTAINS',
        value: value
      };
    }

RegexCondition
  = variable:ExpressionIdentifier "." property:PropertyIdentifier _ "=~" _ pattern:StringLiteral {
      return {
        type: 'RegexCondition',
        variable: variable,
        property: property,
        pattern: pattern
      };
    }

PropertyCondition
  = left:ConditionValue _ op:ComparisonOperator _ right:ConditionValue {
      // If left is a simple property access, extract variable and property for backwards compatibility
      if (left && typeof left === 'object' && left.type === 'PropertyAccess') {
        return {
          type: 'PropertyCondition',
          variable: left.variable,
          property: left.property,
          operator: op,
          value: right
        };
      }
      // Otherwise, return a more general comparison (both sides are expressions)
      return {
        type: 'ExpressionCondition',
        left: left,
        operator: op,
        right: right
      };
    }

// Value in a WHERE condition - can be an expression with arithmetic operators
// Operator precedence (lowest to highest): +/- -> *// /% -> ^ -> unary +/-
ConditionValue
  = ArithmeticExpression

// Return expressions with boolean operators support
// Precedence (lowest to highest): OR -> XOR -> AND -> NOT -> comparisons -> arithmetic
ReturnExpression
  = BooleanOrExpression

BooleanOrExpression
  = head:BooleanXorExpression tail:(_ OR _ BooleanXorExpression)* {
      return tail.reduce((left, [_1, _2, _3, right]) => {
        return {
          type: 'BooleanExpression',
          operator: 'OR',
          left: left,
          right: right
        };
      }, head);
    }

BooleanXorExpression
  = head:BooleanAndExpression tail:(_ XOR _ BooleanAndExpression)* {
      return tail.reduce((left, [_1, _2, _3, right]) => {
        return {
          type: 'BooleanExpression',
          operator: 'XOR',
          left: left,
          right: right
        };
      }, head);
    }

BooleanAndExpression
  = head:BooleanNotExpression tail:(_ AND _ BooleanNotExpression)* {
      return tail.reduce((left, [_1, _2, _3, right]) => {
        return {
          type: 'BooleanExpression',
          operator: 'AND',
          left: left,
          right: right
        };
      }, head);
    }

BooleanNotExpression
  = NOT _ operand:BooleanNotExpression {
      return {
        type: 'BooleanExpression',
        operator: 'NOT',
        operand: operand
      };
    }
  / ComparisonExpression

ComparisonExpression
  = left:ArithmeticExpression _ IS _ NOT _ NULL {
      return {
        type: 'ComparisonExpression',
        operator: 'IS NOT NULL',
        left: left
      };
    }
  / left:ArithmeticExpression _ IS _ NULL {
      return {
        type: 'ComparisonExpression',
        operator: 'IS NULL',
        left: left
      };
    }
  / left:ArithmeticExpression _ NOT _ IN _ right:ArithmeticExpression {
      return {
        type: 'ComparisonExpression',
        operator: 'NOT IN',
        left: left,
        right: right
      };
    }
  / left:ArithmeticExpression _ IN _ right:ArithmeticExpression {
      return {
        type: 'ComparisonExpression',
        operator: 'IN',
        left: left,
        right: right
      };
    }
  / left:ArithmeticExpression _ op:ComparisonOperator _ right:ArithmeticExpression {
      return {
        type: 'ComparisonExpression',
        operator: op,
        left: left,
        right: right
      };
    }
  / ArithmeticExpression

// Arithmetic expressions with proper precedence
// Level 1: Addition and subtraction (lowest precedence)
ArithmeticExpression
  = head:MultiplicativeExpression tail:(_ ("+" / "-") _ MultiplicativeExpression)* {
      return tail.reduce((left, [_1, op, _2, right]) => {
        return {
          type: 'ArithmeticExpression',
          operator: op,
          left: left,
          right: right
        };
      }, head);
    }

// Level 2: Multiplication, division, and modulo
MultiplicativeExpression
  = head:PowerExpression tail:(_ ("*" / "/" / "%") _ PowerExpression)* {
      return tail.reduce((left, [_1, op, _2, right]) => {
        return {
          type: 'ArithmeticExpression',
          operator: op,
          left: left,
          right: right
        };
      }, head);
    }

// Level 3: Power/exponentiation (right-associative)
PowerExpression
  = base:UnaryExpression _ "^" _ exp:PowerExpression {
      return {
        type: 'ArithmeticExpression',
        operator: '^',
        left: base,
        right: exp
      };
    }
  / UnaryExpression

// Level 4: Unary plus and minus (highest precedence)
UnaryExpression
  = op:("+" / "-") _ operand:UnaryExpression {
      return {
        type: 'UnaryExpression',
        operator: op,
        operand: operand
      };
    }
  / PostfixExpression

// Postfix expressions - handles indexing [n], slicing [n..m], dynamic property access ['prop'], and member access .prop after primary expressions
PostfixExpression
  = base:PrimaryExpression postfixes:PostfixOperator* {
      return postfixes.reduce((expr, postfix) => {
        if (postfix.type === 'index') {
          return {
            type: 'ListIndexExpression',
            list: expr,
            index: postfix.index
          };
        } else if (postfix.type === 'slice') {
          return {
            type: 'SliceExpression',
            list: expr,
            ...(postfix.start !== undefined && { start: postfix.start }),
            ...(postfix.end !== undefined && { end: postfix.end })
          };
        } else if (postfix.type === 'dynamicProperty') {
          return {
            type: 'DynamicPropertyAccess',
            object: expr,
            property: postfix.property
          };
        } else if (postfix.type === 'memberAccess') {
          return {
            type: 'MemberAccess',
            object: expr,
            property: postfix.property
          };
        }
        return expr;
      }, base);
    }

// SliceIndex: expression for slice bounds, wraps null in an AST object
// Returns a sentinel object { isPresent: true, value: ... } to distinguish from omitted
SliceIndex
  = NullLiteral {
      return { isPresent: true, value: { type: 'NullLiteral', value: null } };
    }
  / expr:ArithmeticExpression {
      return { isPresent: true, value: expr };
    }

// Postfix operators: [index], [start..end], ['propName'], or .property for member access
// Note: String literal case must come before ArithmeticExpression since ArithmeticExpression includes strings
PostfixOperator
  = "[" _ start:SliceIndex? _ ".." _ end:SliceIndex? _ "]" {
      // Only set start/end if they were actually provided in the syntax
      // SliceIndex returns { isPresent: true, value: ... } when matched
      // SliceIndex? returns null when not matched
      return {
        type: 'slice',
        ...(start !== null && { start: start.value }),
        ...(end !== null && { end: end.value })
      };
    }
  / "[" _ prop:StringLiteral _ "]" {
      return { type: 'dynamicProperty', property: prop };
    }
  / "[" _ index:ArithmeticExpression _ "]" {
      return { type: 'index', index: index };
    }
  / "." property:PropertyIdentifier {
      return { type: 'memberAccess', property: property };
    }

// Primary expressions - the atomic values
PrimaryExpression
  = "(" _ expr:BooleanOrExpression _ ")" { return expr; }
  / ReduceExpression
  / QuantifierExpression
  / CaseExpression
  / FunctionCallExpression
  / ListLiteralExpr
  / MapLiteralExpr
  / Literal
  / ParameterRef
  / MapProjection
  / variable:ExpressionIdentifier "." property:PropertyIdentifier {
      return {
        type: 'PropertyAccess',
        variable: variable,
        property: property
      };
    }
  / variable:ExpressionIdentifier {
      return {
        type: 'VariableRef',
        variable: variable
      };
    }

// Quantifier expressions - test predicates over lists
// ALL(x IN list WHERE condition) - all elements satisfy condition
// ANY(x IN list WHERE condition) - at least one element satisfies condition
// NONE(x IN list WHERE condition) - no elements satisfy condition
// SINGLE(x IN list WHERE condition) - exactly one element satisfies condition
QuantifierExpression
  = ALL _ "(" _ variable:Identifier _ IN _ list:ArithmeticExpression _ WHERE _ condition:OrCondition _ ")" {
      return {
        type: 'QuantifierExpression',
        quantifier: 'ALL',
        variable: variable,
        list: list,
        condition: condition
      };
    }
  / ANY _ "(" _ variable:Identifier _ IN _ list:ArithmeticExpression _ WHERE _ condition:OrCondition _ ")" {
      return {
        type: 'QuantifierExpression',
        quantifier: 'ANY',
        variable: variable,
        list: list,
        condition: condition
      };
    }
  / NONE _ "(" _ variable:Identifier _ IN _ list:ArithmeticExpression _ WHERE _ condition:OrCondition _ ")" {
      return {
        type: 'QuantifierExpression',
        quantifier: 'NONE',
        variable: variable,
        list: list,
        condition: condition
      };
    }
  / SINGLE _ "(" _ variable:Identifier _ IN _ list:ArithmeticExpression _ WHERE _ condition:OrCondition _ ")" {
      return {
        type: 'QuantifierExpression',
        quantifier: 'SINGLE',
        variable: variable,
        list: list,
        condition: condition
      };
    }

// Reduce expression - fold a list into a single value
// REDUCE(accumulator = init, x IN list | expression)
ReduceExpression
  = REDUCE _ "(" _ accumulator:Identifier _ "=" _ init:ArithmeticExpression _ "," _ variable:Identifier _ IN _ list:ArithmeticExpression _ "|" _ expression:ArithmeticExpression _ ")" {
      return {
        type: 'ReduceExpression',
        accumulator: accumulator,
        init: init,
        variable: variable,
        list: list,
        expression: expression
      };
    }

// List literal as expression (returns AST node, not just array)
// Also handles list comprehension: [x IN list WHERE cond | expr]
// Also handles pattern comprehension: [p = pattern WHERE cond | expr] or [pattern | expr]
ListLiteralExpr
  = PatternComprehension
  / ListComprehension
  / "[" _ "]" {
      return {
        type: 'ListLiteral',
        values: []
      };
    }
  / "[" _ head:ArithmeticExpression tail:(_ "," _ ArithmeticExpression)* _ "]" {
      return {
        type: 'ListLiteral',
        values: [head, ...tail.map(t => t[3])]
      };
    }

// Map literal expression: {key: value, key2: value2, ...}
// Not to be confused with MapProjection which requires variable prefix: n{...}
MapLiteralExpr
  = "{" _ "}" {
      return {
        type: 'MapLiteral',
        entries: []
      };
    }
  / "{" _ head:MapLiteralEntry tail:(_ "," _ MapLiteralEntry)* _ "}" {
      return {
        type: 'MapLiteral',
        entries: [head, ...tail.map(t => t[3])]
      };
    }

MapLiteralEntry
  = key:MapKey _ ":" _ value:ReturnExpression {
      return {
        type: 'MapLiteralEntry',
        key: key,
        value: value
      };
    }

// Map keys can be identifiers (including keywords like null, true, exists) or quoted strings
// Keywords ARE allowed as map keys since they're followed by colon which provides unambiguous context
MapKey
  = BacktickIdentifier
  / head:[a-zA-Z_] tail:[a-zA-Z0-9_]* { return head + tail.join(''); }
  / StringLiteral

// Pattern comprehension: [pattern WHERE cond | expr] or [p = pattern WHERE cond | expr]
// Returns a list of values computed by evaluating the projection for each match
// Examples:
// - [(a)-[:KNOWS]->(b) | b.name] - names of all neighbors
// - [p = (a)-[:KNOWS]->(b) WHERE b.age > 30 | b.name] - with filter and path binding
// - [(n:Person) | n.name] - simple node pattern
PatternComprehension
  = "[" _ pathVar:(Identifier _ "=" _)? pattern:Pattern _ where:ListComprehensionWhere? _ projection:ListComprehensionProjection _ "]" {
      return {
        type: 'PatternComprehension',
        ...(pathVar && { pathVariable: pathVar[0] }),
        pattern: pattern,
        ...(where && { filterCondition: where }),
        projection: projection
      };
    }

// List comprehension: [x IN list WHERE cond | expr]
// All parts except variable and list are optional:
// - [x IN list] - returns all elements as-is
// - [x IN list WHERE x > 0] - filter only
// - [x IN list | x * 2] - projection only
// - [x IN list WHERE x > 0 | x * 2] - filter and projection
ListComprehension
  = "[" _ variable:Identifier _ IN _ list:ArithmeticExpression _ where:ListComprehensionWhere? _ projection:ListComprehensionProjection? _ "]" {
      return {
        type: 'ListComprehension',
        variable: variable,
        list: list,
        ...(where && { filterCondition: where }),
        ...(projection && { projection: projection })
      };
    }

// Optional WHERE clause in list/pattern comprehension
ListComprehensionWhere
  = WHERE _ condition:OrCondition { return condition; }

// Optional projection expression in list comprehension (| expr)
// Required in pattern comprehension
ListComprehensionProjection
  = "|" _ expr:ArithmeticExpression { return expr; }

// Map projection: variable{.prop, key: expr, .*}
// Projects a node or relationship into a map with selected properties
// Examples:
// - n{.name, .age} - returns {name: n.name, age: n.age}
// - n{.name, status: 'active'} - returns {name: n.name, status: 'active'}
// - n{.*} - returns all properties of n
// - n{.name, friend} - returns {name: n.name, friend: <value of friend variable>}
MapProjection
  = variable:ExpressionIdentifier _ "{" _ selectors:MapProjectionSelectorList? _ "}" {
      return {
        type: 'MapProjection',
        variable: variable,
        selectors: selectors || []
      };
    }

MapProjectionSelectorList
  = head:MapProjectionSelector tail:(_ "," _ MapProjectionSelector)* {
      return [head, ...tail.map(t => t[3])];
    }

MapProjectionSelector
  = ".*" {
      return {
        type: 'MapAllPropertiesSelector'
      };
    }
  / "." property:PropertyIdentifier {
      return {
        type: 'MapPropertySelector',
        property: property
      };
    }
  / key:PropertyIdentifier _ ":" _ value:ArithmeticExpression {
      // Literal entry: key: expr
      return {
        type: 'MapLiteralEntry',
        key: key,
        value: value
      };
    }
  / variable:ExpressionIdentifier !(_ ":") {
      // Variable selector - only match if not followed by colon
      return {
        type: 'MapVariableSelector',
        variable: variable
      };
    }

// CASE expressions - both simple and searched forms
// Simple: CASE test WHEN value THEN result ... [ELSE default] END
// Searched: CASE WHEN condition THEN result ... [ELSE default] END
CaseExpression
  = SimpleCaseExpression
  / SearchedCaseExpression

// Simple CASE: compares test expression against values
SimpleCaseExpression
  = CASE _ test:ArithmeticExpression _ alternatives:SimpleCaseAlternative+ _ elseClause:CaseElseClause? _ END {
      return {
        type: 'SimpleCaseExpression',
        test: test,
        alternatives: alternatives,
        ...(elseClause !== null && { else: elseClause })
      };
    }

// Searched CASE: evaluates boolean conditions
SearchedCaseExpression
  = CASE _ alternatives:SearchedCaseAlternative+ _ elseClause:CaseElseClause? _ END {
      return {
        type: 'SearchedCaseExpression',
        alternatives: alternatives,
        ...(elseClause !== null && { else: elseClause })
      };
    }

// Simple CASE alternative: WHEN value THEN result
SimpleCaseAlternative
  = WHEN _ when:ArithmeticExpression _ THEN _ then:ArithmeticExpression _ {
      return { when: when, then: then };
    }

// Searched CASE alternative: WHEN condition THEN result
SearchedCaseAlternative
  = WHEN _ when:OrCondition _ THEN _ then:ArithmeticExpression _ {
      return { when: when, then: then };
    }

// ELSE clause for CASE expressions
CaseElseClause
  = ELSE _ result:ArithmeticExpression {
      return result;
    }

// Function call expression - supports both scalar and aggregate functions
// Syntax: functionName([DISTINCT] arg1, arg2, ...)
FunctionCallExpression
  = name:FunctionIdentifier _ "(" _ distinct:DISTINCT? _ args:FunctionArgumentList? _ ")" {
      return {
        type: 'FunctionCall',
        name: name,
        args: args || [],
        distinct: distinct !== null
      };
    }

// Function argument list - comma-separated expressions
FunctionArgumentList
  = head:ArithmeticExpression tail:(_ "," _ ArithmeticExpression)* {
      return [head, ...tail.map(t => t[3])];
    }

// Function name identifier - allows keywords as function names
// This needs to match function names like toLower, toUpper, count, sum, etc.
// Also supports namespaced functions like duration.between, date.truncate
// Also supports backtick-quoted form for custom function names
FunctionIdentifier
  = BacktickIdentifier
  / namespace:SimpleFunctionName "." name:SimpleFunctionName {
      return namespace + '.' + name;
    }
  / SimpleFunctionName

SimpleFunctionName
  = head:[a-zA-Z_] tail:[a-zA-Z0-9_]* {
      return head + tail.join('');
    }

// Functional exists() syntax: exists(n.property) or exists((pattern)) - standard Cypher style
// The property access form must come first to avoid ambiguity with patterns starting with (variable)
FunctionalExistsCondition
  = EXISTS _ "(" _ variable:ExpressionIdentifier "." property:PropertyIdentifier _ ")" {
      return {
        type: 'ExistsCondition',
        variable: variable,
        property: property
      };
    }
  / EXISTS _ "(" _ pattern:Pattern _ ")" {
      // Pattern-based exists: exists((a)-[:REL]->(b))
      return {
        type: 'ExpressionCondition',
        left: {
          type: 'ExistsSubquery',
          pattern: pattern
        },
        operator: '=',
        right: true
      };
    }

// Postfix EXISTS syntax: n.property EXISTS - Codemix extension
ExistsCondition
  = variable:ExpressionIdentifier "." property:PropertyIdentifier _ EXISTS {
      return {
        type: 'ExistsCondition',
        variable: variable,
        property: property
      };
    }

// EXISTS subquery condition: EXISTS { pattern [WHERE condition] }
// Tests whether a pattern matches at least one result
// Examples:
// - EXISTS { (n)-[:KNOWS]->(m) } - true if n has any KNOWS relationship
// - EXISTS { (n)-[:KNOWS]->(m:Person) } - true if n knows any Person
// - EXISTS { (n)-[:KNOWS]->(m) WHERE m.age > 30 } - with filter condition
ExistsSubqueryCondition
  = EXISTS _ "{" _ pattern:Pattern _ where:(WHERE _ OrCondition)? _ "}" {
      // Return as ExpressionCondition comparing the ExistsSubquery to true
      return {
        type: 'ExpressionCondition',
        left: {
          type: 'ExistsSubquery',
          pattern: pattern,
          ...(where && { filterCondition: where[2] })
        },
        operator: '=',
        right: true
      };
    }

ComparisonOperator
  = "=" { return '='; }
  / "!=" { return '!='; }
  / "<>" { return '!='; }
  / "<=" { return '<='; }
  / ">=" { return '>='; }
  / "<" { return '<'; }
  / ">" { return '>'; }

// RETURN Clause
ReturnClause
  = RETURN _ distinct:DISTINCT? _ "*" _ {
      return {
        type: 'ReturnClause',
        distinct: distinct !== null,
        items: [],
        returnAll: true
      };
    }
  / RETURN _ distinct:DISTINCT? _ items:ReturnItemList _ {
      return {
        type: 'ReturnClause',
        distinct: distinct !== null,
        items: items,
        returnAll: false
      };
    }

ReturnItemList
  = head:ReturnItem tail:(_ "," _ ReturnItem)* {
      return [head, ...tail.map(t => t[3])];
    }

ReturnItem
  = COUNT _ "(" _ "*" _ ")" alias:(_ AS _ AliasIdentifier)? {
      // count(*) counts all rows
      return {
        type: 'ReturnItem',
        variable: '*',
        aggregate: 'COUNT',
        ...(alias && { alias: alias[3] })
      };
    }
  / COUNT _ "(" _ distinct:DISTINCT? _ variable:ExpressionIdentifier _ ")" alias:(_ AS _ AliasIdentifier)? {
      return {
        type: 'ReturnItem',
        variable: variable,
        aggregate: 'COUNT',
        ...(distinct !== null && { distinct: true }),
        ...(alias && { alias: alias[3] })
      };
    }
  / COUNT _ "(" _ distinct:DISTINCT? _ variable:ExpressionIdentifier "." property:PropertyIdentifier _ ")" alias:(_ AS _ AliasIdentifier)? {
      return {
        type: 'ReturnItem',
        variable: variable,
        property: property,
        aggregate: 'COUNT',
        ...(distinct !== null && { distinct: true }),
        ...(alias && { alias: alias[3] })
      };
    }
  / SUM _ "(" _ distinct:DISTINCT? _ variable:ExpressionIdentifier "." property:PropertyIdentifier _ ")" alias:(_ AS _ AliasIdentifier)? {
      return {
        type: 'ReturnItem',
        variable: variable,
        property: property,
        aggregate: 'SUM',
        ...(distinct !== null && { distinct: true }),
        ...(alias && { alias: alias[3] })
      };
    }
  / SUM _ "(" _ distinct:DISTINCT? _ variable:ExpressionIdentifier _ ")" alias:(_ AS _ AliasIdentifier)? {
      return {
        type: 'ReturnItem',
        variable: variable,
        aggregate: 'SUM',
        ...(distinct !== null && { distinct: true }),
        ...(alias && { alias: alias[3] })
      };
    }
  / AVG _ "(" _ distinct:DISTINCT? _ variable:ExpressionIdentifier "." property:PropertyIdentifier _ ")" alias:(_ AS _ AliasIdentifier)? {
      return {
        type: 'ReturnItem',
        variable: variable,
        property: property,
        aggregate: 'AVG',
        ...(distinct !== null && { distinct: true }),
        ...(alias && { alias: alias[3] })
      };
    }
  / AVG _ "(" _ distinct:DISTINCT? _ variable:ExpressionIdentifier _ ")" alias:(_ AS _ AliasIdentifier)? {
      return {
        type: 'ReturnItem',
        variable: variable,
        aggregate: 'AVG',
        ...(distinct !== null && { distinct: true }),
        ...(alias && { alias: alias[3] })
      };
    }
  / MIN _ "(" _ distinct:DISTINCT? _ variable:ExpressionIdentifier "." property:PropertyIdentifier _ ")" alias:(_ AS _ AliasIdentifier)? {
      return {
        type: 'ReturnItem',
        variable: variable,
        property: property,
        aggregate: 'MIN',
        ...(distinct !== null && { distinct: true }),
        ...(alias && { alias: alias[3] })
      };
    }
  / MIN _ "(" _ distinct:DISTINCT? _ variable:ExpressionIdentifier _ ")" alias:(_ AS _ AliasIdentifier)? {
      return {
        type: 'ReturnItem',
        variable: variable,
        aggregate: 'MIN',
        ...(distinct !== null && { distinct: true }),
        ...(alias && { alias: alias[3] })
      };
    }
  / MAX _ "(" _ distinct:DISTINCT? _ variable:ExpressionIdentifier "." property:PropertyIdentifier _ ")" alias:(_ AS _ AliasIdentifier)? {
      return {
        type: 'ReturnItem',
        variable: variable,
        property: property,
        aggregate: 'MAX',
        ...(distinct !== null && { distinct: true }),
        ...(alias && { alias: alias[3] })
      };
    }
  / MAX _ "(" _ distinct:DISTINCT? _ variable:ExpressionIdentifier _ ")" alias:(_ AS _ AliasIdentifier)? {
      return {
        type: 'ReturnItem',
        variable: variable,
        aggregate: 'MAX',
        ...(distinct !== null && { distinct: true }),
        ...(alias && { alias: alias[3] })
      };
    }
  / COLLECT _ "(" _ distinct:DISTINCT? _ variable:ExpressionIdentifier "." property:PropertyIdentifier _ ")" alias:(_ AS _ AliasIdentifier)? {
      return {
        type: 'ReturnItem',
        variable: variable,
        property: property,
        aggregate: 'COLLECT',
        ...(distinct !== null && { distinct: true }),
        ...(alias && { alias: alias[3] })
      };
    }
  / COLLECT _ "(" _ distinct:DISTINCT? _ variable:ExpressionIdentifier _ ")" alias:(_ AS _ AliasIdentifier)? {
      return {
        type: 'ReturnItem',
        variable: variable,
        aggregate: 'COLLECT',
        ...(distinct !== null && { distinct: true }),
        ...(alias && { alias: alias[3] })
      };
    }
  / STDEV _ "(" _ variable:ExpressionIdentifier "." property:PropertyIdentifier _ ")" alias:(_ AS _ AliasIdentifier)? {
      return {
        type: 'ReturnItem',
        variable: variable,
        property: property,
        aggregate: 'STDEV',
        ...(alias && { alias: alias[3] })
      };
    }
  / STDEVP _ "(" _ variable:ExpressionIdentifier "." property:PropertyIdentifier _ ")" alias:(_ AS _ AliasIdentifier)? {
      return {
        type: 'ReturnItem',
        variable: variable,
        property: property,
        aggregate: 'STDEVP',
        ...(alias && { alias: alias[3] })
      };
    }
  / PERCENTILEDISC _ "(" _ variable:ExpressionIdentifier "." property:PropertyIdentifier _ "," _ percentile:NumberLiteral _ ")" alias:(_ AS _ AliasIdentifier)? {
      return {
        type: 'ReturnItem',
        variable: variable,
        property: property,
        aggregate: 'PERCENTILEDISC',
        percentile: percentile,
        ...(alias && { alias: alias[3] })
      };
    }
  / PERCENTILECONT _ "(" _ variable:ExpressionIdentifier "." property:PropertyIdentifier _ "," _ percentile:NumberLiteral _ ")" alias:(_ AS _ AliasIdentifier)? {
      return {
        type: 'ReturnItem',
        variable: variable,
        property: property,
        aggregate: 'PERCENTILECONT',
        percentile: percentile,
        ...(alias && { alias: alias[3] })
      };
    }
  / expr:ReturnExpression alias:(_ AS _ AliasIdentifier)? {
      // General expression support: handles boolean expressions, comparisons, arithmetic,
      // property access (n.prop), variable references, etc.
      // Normalize simple cases to legacy format for backward compatibility
      // Handle primitive values (null, boolean, numbers) that don't have a type property
      if (expr === null || expr === undefined || typeof expr !== 'object') {
        return {
          type: 'ReturnItem',
          expression: expr,
          ...(alias && { alias: alias[3] })
        };
      }
      if (expr.type === 'VariableRef') {
        return {
          type: 'ReturnItem',
          variable: expr.variable,
          ...(alias && { alias: alias[3] })
        };
      }
      if (expr.type === 'PropertyAccess') {
        return {
          type: 'ReturnItem',
          variable: expr.variable,
          property: expr.property,
          ...(alias && { alias: alias[3] })
        };
      }
      // For labels() and type() functions, maintain legacy format
      if (expr.type === 'FunctionCall') {
        const funcName = expr.name.toLowerCase();
        if ((funcName === 'labels' || funcName === 'type') &&
            expr.args.length === 1 &&
            expr.args[0].type === 'VariableRef') {
          return {
            type: 'ReturnItem',
            variable: expr.args[0].variable,
            function: funcName,
            ...(alias && { alias: alias[3] })
          };
        }
      }
      // For complex expressions, use the expression field
      return {
        type: 'ReturnItem',
        expression: expr,
        ...(alias && { alias: alias[3] })
      };
    }

// Supported functions for RETURN clause
// Add new functions here (e.g., ID, PROPERTIES)
FunctionName
  = LABELS { return 'labels'; }
  / TYPE { return 'type'; }

// ORDER BY Clause
OrderByClause
  = ORDER _ BY _ orders:OrderList _ {
      return {
        type: 'OrderByClause',
        orders: orders
      };
    }

OrderList
  = head:OrderItem tail:(_ "," _ OrderItem)* {
      return [head, ...tail.map(t => t[3])];
    }

OrderItem
  = expr:ArithmeticExpression _ direction:OrderDirection? _ nulls:NullsOrdering? {
      // Handle backwards compatibility - extract variable/property for simple property access
      if (expr && typeof expr === 'object' && expr.type === 'PropertyAccess') {
        return {
          variable: expr.variable,
          property: expr.property,
          direction: direction || 'ASC',
          ...(nulls && { nulls: nulls })
        };
      }
      // Handle alias (simple identifier)
      if (expr && typeof expr === 'object' && expr.type === 'VariableRef') {
        return {
          alias: expr.variable,
          direction: direction || 'ASC',
          ...(nulls && { nulls: nulls })
        };
      }
      // For complex expressions
      return {
        expression: expr,
        direction: direction || 'ASC',
        ...(nulls && { nulls: nulls })
      };
    }

OrderDirection
  = ASC { return 'ASC'; }
  / ASCENDING { return 'ASC'; }
  / DESC { return 'DESC'; }
  / DESCENDING { return 'DESC'; }

NullsOrdering
  = NULLS _ FIRST { return 'FIRST'; }
  / NULLS _ LAST { return 'LAST'; }

// GROUP BY Clause
GroupByClause
  = GROUP _ BY _ items:GroupByItemList _ {
      return {
        type: 'GroupByClause',
        items: items
      };
    }

GroupByItemList
  = head:GroupByItem tail:(_ "," _ GroupByItem)* {
      return [head, ...tail.map(t => t[3])];
    }

GroupByItem
  = func:FunctionName _ "(" _ variable:ExpressionIdentifier _ ")" {
      return {
        type: 'GroupByItem',
        variable: variable,
        function: func
      };
    }
  / variable:ExpressionIdentifier "." property:PropertyIdentifier {
      return {
        type: 'GroupByItem',
        variable: variable,
        property: property
      };
    }
  / variable:ExpressionIdentifier {
      return {
        type: 'GroupByItem',
        variable: variable
      };
    }

// SKIP Clause (OFFSET is an alias for SKIP)
SkipClause
  = (SKIP / OFFSET) _ value:Integer _ {
      return { skip: value };
    }

// LIMIT Clause
LimitClause
  = LIMIT _ value:Integer {
      return { limit: value };
    }

// Keywords
MATCH = "MATCH"i !IdentifierPart
WHERE = "WHERE"i !IdentifierPart
RETURN = "RETURN"i !IdentifierPart
DISTINCT = "DISTINCT"i !IdentifierPart
COUNT = "COUNT"i !IdentifierPart
SUM = "SUM"i !IdentifierPart
AVG = "AVG"i !IdentifierPart
MIN = "MIN"i !IdentifierPart
MAX = "MAX"i !IdentifierPart
COLLECT = "COLLECT"i !IdentifierPart
STDEV = "stDev"i !IdentifierPart
STDEVP = "stDevP"i !IdentifierPart
PERCENTILEDISC = "percentileDisc"i !IdentifierPart
PERCENTILECONT = "percentileCont"i !IdentifierPart
LABELS = "LABELS"i !IdentifierPart
TYPE = "TYPE"i !IdentifierPart
ORDER = "ORDER"i !IdentifierPart
BY = "BY"i !IdentifierPart
GROUP = "GROUP"i !IdentifierPart
ASC = "ASC"i !IdentifierPart
ASCENDING = "ASCENDING"i !IdentifierPart
DESC = "DESC"i !IdentifierPart
DESCENDING = "DESCENDING"i !IdentifierPart
NULLS = "NULLS"i !IdentifierPart
FIRST = "FIRST"i !IdentifierPart
LAST = "LAST"i !IdentifierPart
SKIP = "SKIP"i !IdentifierPart
OFFSET = "OFFSET"i !IdentifierPart
LIMIT = "LIMIT"i !IdentifierPart
AND = "AND"i !IdentifierPart
OR = "OR"i !IdentifierPart
XOR = "XOR"i !IdentifierPart
EXISTS = "EXISTS"i !IdentifierPart
NOT = "NOT"i !IdentifierPart
IN = "IN"i !IdentifierPart
IS = "IS"i !IdentifierPart
NULL = "NULL"i !IdentifierPart
SHORTESTPATH = "shortestPath"i !IdentifierPart
ALLSHORTESTPATHS = "allShortestPaths"i !IdentifierPart
STARTS = "STARTS"i !IdentifierPart
ENDS = "ENDS"i !IdentifierPart
WITH = "WITH"i !IdentifierPart
CONTAINS = "CONTAINS"i !IdentifierPart
FOREACH = "FOREACH"i !IdentifierPart
SET = "SET"i !IdentifierPart
CREATE = "CREATE"i !IdentifierPart
DELETE = "DELETE"i !IdentifierPart
DETACH = "DETACH"i !IdentifierPart
REMOVE = "REMOVE"i !IdentifierPart
MERGE = "MERGE"i !IdentifierPart
ON = "ON"i !IdentifierPart
AS = "AS"i !IdentifierPart
OPTIONAL = "OPTIONAL"i !IdentifierPart
UNWIND = "UNWIND"i !IdentifierPart
CASE = "CASE"i !IdentifierPart
WHEN = "WHEN"i !IdentifierPart
THEN = "THEN"i !IdentifierPart
ELSE = "ELSE"i !IdentifierPart
END = "END"i !IdentifierPart
UNION = "UNION"i !IdentifierPart
ALL = "ALL"i !IdentifierPart
ANY = "ANY"i !IdentifierPart
NONE = "NONE"i !IdentifierPart
SINGLE = "SINGLE"i !IdentifierPart
REDUCE = "REDUCE"i !IdentifierPart
CALL = "CALL"i !IdentifierPart
YIELD = "YIELD"i !IdentifierPart

// Literals
Literal
  = StringLiteral
  / NumberLiteral
  / BooleanLiteral
  / NullLiteral

ListLiteral
  = "[" _ "]" { return []; }
  / "[" _ head:Literal tail:(_ "," _ Literal)* _ "]" {
      return [head, ...tail.map(t => t[3])];
    }

StringLiteral
  = '"' chars:DoubleQuoteChar* '"' { return chars.join(''); }
  / "'" chars:SingleQuoteChar* "'" { return chars.join(''); }

DoubleQuoteChar
  = ![\"\\\n\r] char:. { return char; }
  / "\\" sequence:EscapeSequence { return sequence; }

SingleQuoteChar
  = !['\\\n\r] char:. { return char; }
  / "\\" sequence:EscapeSequence { return sequence; }

EscapeSequence
  = "n" { return '\n'; }
  / "r" { return '\r'; }
  / "t" { return '\t'; }
  / "\\" { return '\\'; }
  / "\"" { return '"'; }
  / "'" { return "'"; }

NumberLiteral
  = HexInteger
  / OctalInteger
  / ScientificFloat
  / Float
  / Integer

// Hexadecimal integer: 0x1A2B or 0X1a2b
HexInteger
  = sign:"-"? "0" [xX] digits:[0-9a-fA-F]+ {
      const num = parseInt(digits.join(''), 16);
      return sign ? -num : num;
    }

// Octal integer: 0o755 or 0O777
OctalInteger
  = sign:"-"? "0" [oO] digits:[0-7]+ {
      const num = parseInt(digits.join(''), 8);
      return sign ? -num : num;
    }

// Scientific notation: 1e10, 1.5E-3, 2.5e+6
ScientificFloat
  = sign:"-"? intPart:[0-9]+ "." decPart:[0-9]+ [eE] expSign:[+-]? expPart:[0-9]+ {
      const mantissa = intPart.join('') + '.' + decPart.join('');
      const exponent = (expSign || '') + expPart.join('');
      const num = parseFloat(mantissa + 'e' + exponent);
      return sign ? -num : num;
    }
  / sign:"-"? intPart:[0-9]+ [eE] expSign:[+-]? expPart:[0-9]+ {
      const exponent = (expSign || '') + expPart.join('');
      const num = parseFloat(intPart.join('') + 'e' + exponent);
      return sign ? -num : num;
    }

Float
  = sign:"-"? digits:[0-9]+ "." decimals:[0-9]+ {
      const num = parseFloat(digits.join('') + '.' + decimals.join(''));
      return sign ? -num : num;
    }

Integer
  = sign:"-"? digits:[0-9]+ {
      const num = parseInt(digits.join(''), 10);
      return sign ? -num : num;
    }

BooleanLiteral
  = "true"i !IdentifierPart { return true; }
  / "false"i !IdentifierPart { return false; }

NullLiteral
  = "null"i !IdentifierPart { return null; }

// Identifiers
// Backtick-quoted identifier: allows reserved words and special characters
// Escape sequence: `` (double backtick) represents a literal backtick
BacktickIdentifier
  = "`" chars:BacktickChar* "`" {
      return chars.join('');
    }

BacktickChar
  = "``" { return "`"; }  // Escaped backtick
  / [^`]                   // Any character except backtick

// Identifier: either backtick-quoted or standard unquoted (keywords disallowed)
Identifier
  = BacktickIdentifier
  / !Keyword head:[a-zA-Z_] tail:[a-zA-Z0-9_]* {
      return head + tail.join('');
    }

// LabelIdentifier allows keywords as labels (e.g., edge type "Contains")
// Used for node labels and relationship types where keywords should be valid
// Also supports backtick-quoted form for special characters
LabelIdentifier
  = BacktickIdentifier
  / head:[a-zA-Z_] tail:[a-zA-Z0-9_]* {
      return head + tail.join('');
    }

// AliasIdentifier allows keywords as aliases in AS clauses (e.g., "AS labels", "AS type")
// Keywords are valid alias names since the AS keyword provides unambiguous context
AliasIdentifier
  = BacktickIdentifier
  / head:[a-zA-Z_] tail:[a-zA-Z0-9_]* {
      return head + tail.join('');
    }

// ExpressionIdentifier allows keywords as variable references in expression contexts
// This enables using variables named after keywords (e.g., after WITH n AS labels, RETURN labels)
// Safe because in expression context, keywords are only recognized when followed by expected syntax
ExpressionIdentifier
  = BacktickIdentifier
  / head:[a-zA-Z_] tail:[a-zA-Z0-9_]* {
      return head + tail.join('');
    }

// PropertyIdentifier: supports @ prefix, backtick-quoted, or standard identifier
// Keywords ARE allowed as property names (e.g., a.type is valid)
PropertyIdentifier
  = "@" head:[a-zA-Z_] tail:[a-zA-Z0-9_]* {
      return "@" + head + tail.join('');
    }
  / BacktickIdentifier
  / head:[a-zA-Z_] tail:[a-zA-Z0-9_]* {
      return head + tail.join('');
    }

IdentifierPart
  = [a-zA-Z0-9_]

Keyword
  = (MATCH / WHERE / RETURN / DISTINCT / COUNT / SUM / AVG / MIN / MAX / COLLECT / STDEV / STDEVP / PERCENTILEDISC / PERCENTILECONT / LABELS / TYPE / ORDER / GROUP / BY / ASC / ASCENDING / DESC / DESCENDING / NULLS / FIRST / LAST / SKIP / OFFSET / LIMIT / AND / OR / XOR / EXISTS / NOT / IN / IS / NULL / SHORTESTPATH / ALLSHORTESTPATHS / STARTS / ENDS / WITH / CONTAINS / FOREACH / SET / CREATE / DELETE / DETACH / REMOVE / MERGE / ON / AS / UNWIND / CASE / WHEN / THEN / ELSE / END / UNION / ALL / ANY / NONE / SINGLE / REDUCE / CALL / YIELD)

// Whitespace
_
  = (Whitespace / Comment)*

Whitespace
  = [ \t\n\r]

Comment
  = "//" (![\n\r] .)*
  / "/*" (!"*/" .)* "*/"
