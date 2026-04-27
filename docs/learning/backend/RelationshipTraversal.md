# Relationship Traversal with the `relations()` Virtual Table

> **Experimental feature** — `relations()` is currently experimental and disabled by default. Enable it per-query by appending `ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES` to your ECSQL, or enable it for the connection with `PRAGMA experimental_features_enabled=true`.

The `relations()` virtual table provides a high-performance way to traverse relationships in an iModel or ECDb. It is especially useful when you need to:

- **Discover** all related instances without knowing the specific relationship classes
- **Walk** multi-hop graph structures using recursive CTEs, chained cross-joins, or iterative BFS
- **Compare** graphs by intersecting or merging reachable sets from different seed instances

This guide covers practical patterns for common relationship traversal scenarios.

> For the full API reference (columns, syntax, and options), see the [relations() virtual table reference](../ECSqlReference/RelationsVTab.md).

## How it works

Traditional ECSQL queries require you to know the exact relationship class name and join through it:

```sql
-- Traditional: you must know the exact relationship class
SELECT target.ECInstanceId
FROM bis.ElementOwnsChildElements rel
JOIN bis.Element target ON target.ECInstanceId = rel.TargetECInstanceId
WHERE rel.SourceECInstanceId = 0x1A
```

The `relations()` virtual table takes a different approach: given a seed instance (id + class), it automatically discovers **all** applicable relationships and returns every related instance in a single query:

```sql
-- relations(): auto-discovers all relationships
SELECT RelatedECInstanceId, RelatedECClassId, Direction
FROM ECVLib.Relations(0x1A, 0x38)
ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
```

Internally, `relations()` bypasses the ECSQL layer entirely, generating raw SQLite prepared statements from ECDb property maps. This yields 3–10× faster traversal for relationship-heavy queries.

## Pattern 1: Find immediate neighbors

The simplest use case — find everything directly connected to an instance:

### TypeScript (async)

```typescript
import { QueryRowFormat } from "@itwin/core-common";

async function findNeighbors(iModel: IModelDb, seedId: string, seedClassId: string) {
  const neighbors = [];
  for await (const row of iModel.createQueryReader(
    `SELECT RelatedECInstanceId, RelatedECClassId, Direction, RelationshipECClassId
     FROM ECVLib.Relations(${seedId}, ${seedClassId})
     ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES`,
    undefined,
    { rowFormat: QueryRowFormat.UseJsPropertyNames }
  )) {
    neighbors.push(row.toRow());
  }
  return neighbors;
}
```

## Pattern 2: Directional traversal

Control which side of relationships to follow:

```sql
-- Only follow relationships where the seed is the source (parent → child)
SELECT RelatedECInstanceId, RelatedECClassId
FROM ECVLib.Relations(0x1A, 0x38, 'forward')
ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
```

```sql
-- Only follow relationships where the seed is the target (child → parent)
SELECT RelatedECInstanceId, RelatedECClassId
FROM ECVLib.Relations(0x1A, 0x38, 'backward')
ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
```

**When to use directional traversal:**

| Direction | Meaning | Typical use case |
|-----------|---------|------------------|
| `'forward'` | Seed is source → get targets | Find children, owned elements |
| `'backward'` | Seed is target → get sources | Find parents, owners |
| `'both'` *(default)* | Both directions | Full neighbor discovery |

## Pattern 3: Enriching results with JOINs

The virtual table returns ids and class ids. JOIN with entity tables to get actual properties:

```sql
SELECT e.ECInstanceId, e.UserLabel, e.CodeValue,
       ec_classname(r.RelationshipECClassId, 's.c') AS RelClassName,
       r.Direction
FROM bis.Element e
JOIN ECVLib.Relations(0x1A, 0x38) r
  ON r.RelatedECInstanceId = e.ECInstanceId
ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
```

In TypeScript:

```typescript
async function getRelatedElements(iModel: IModelDb, seedId: string, seedClassId: string) {
  const results = [];
  for await (const row of iModel.createQueryReader(
    `SELECT e.ECInstanceId, e.UserLabel,
            ec_classname(r.RelationshipECClassId, 's.c') AS relClass,
            r.Direction
     FROM bis.Element e
     JOIN ECVLib.Relations(${seedId}, ${seedClassId}) r
       ON r.RelatedECInstanceId = e.ECInstanceId
     ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES`,
    undefined,
    { rowFormat: QueryRowFormat.UseJsPropertyNames }
  )) {
    results.push(row.toRow());
  }
  return results;
}
```

## Pattern 4: Multi-hop traversal

Walk the relationship graph to discover transitive connections. There are three approaches:

### 4a. Recursive CTE (pure SQL)

Use a recursive Common Table Expression to walk the graph entirely in SQL:

```sql
WITH RECURSIVE graph(ECInstanceId, ECClassId, Depth) AS (
    VALUES (0x1A, 0x38, 0)
    UNION
    SELECT r.RelatedECInstanceId, r.RelatedECClassId, g.Depth + 1
    FROM graph g, ECVLib.Relations(g.ECInstanceId, g.ECClassId, 'forward') r
    WHERE g.Depth < 3
)
SELECT DISTINCT ECInstanceId, ECClassId, Depth FROM graph
ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
```

### 4b. Chained cross-join (fixed depth)

For a known small number of hops, chain cross-joins:

```sql
SELECT r1.RelatedECInstanceId AS Hop1, r2.RelatedECInstanceId AS Hop2
FROM bis.Element a,
     ECVLib.Relations(a.ECInstanceId, a.ECClassId, 'forward') r1,
     ECVLib.Relations(r1.RelatedECInstanceId, r1.RelatedECClassId, 'forward') r2
WHERE a.ECInstanceId = 0x1A
ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
```

### 4c. Programmatic BFS (TypeScript)

For dynamic depth or complex per-node logic, use an iterative BFS loop:

```typescript
async function bfsTraversal(
  iModel: IModelDb,
  seedId: string,
  seedClassId: string,
  maxDepth: number,
  direction: "forward" | "backward" | "both" = "forward"
) {
  const visited = new Map<string, { classId: string; depth: number }>();
  let frontier = [{ id: seedId, classId: seedClassId }];

  for (let depth = 0; depth < maxDepth && frontier.length > 0; depth++) {
    const next: Array<{ id: string; classId: string }> = [];
    for (const node of frontier) {
      for await (const row of iModel.createQueryReader(
        `SELECT RelatedECInstanceId, RelatedECClassId
         FROM ECVLib.Relations(${node.id}, ${node.classId}, '${direction}')
         ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES`,
        undefined,
        { rowFormat: QueryRowFormat.UseJsPropertyNames }
      )) {
        const relId = row.relatedECInstanceId;
        if (!visited.has(relId)) {
          visited.set(relId, { classId: row.relatedECClassId, depth: depth + 1 });
          next.push({ id: relId, classId: row.relatedECClassId });
        }
      }
    }
    frontier = next;
  }
  return visited;
}
```

### Controlling traversal depth

| Max depth | Behavior |
|-----------|----------|
| 0 | Seed only (no expansion) |
| 1 | Immediate neighbors |
| 3 | Three hops — covers most practical scenarios |
| ∞ | Full transitive closure (no depth limit, but be careful with large graphs) |

## Pattern 5: Graph set operations

### Intersection — find shared nodes between two seeds

Useful for answering "what do these two elements have in common?":

```typescript
async function graphIntersection(
  iModel: IModelDb,
  seedAId: string, seedAClassId: string,
  seedBId: string, seedBClassId: string,
  maxDepth: number
) {
  // Collect reachable sets from each seed
  const reachableA = await bfsTraversal(iModel, seedAId, seedAClassId, maxDepth, "forward");
  const reachableB = await bfsTraversal(iModel, seedBId, seedBClassId, maxDepth, "forward");

  // Return nodes found in both sets
  const shared = new Map<string, { classId: string; depth: number }>();
  for (const [id, info] of reachableA) {
    if (reachableB.has(id))
      shared.set(id, info);
  }
  return shared;
}
```

### Union — all reachable nodes from either seed

Useful for combining scope from multiple starting points:

```typescript
async function graphUnion(
  iModel: IModelDb,
  seeds: Array<{ id: string; classId: string }>,
  maxDepth: number
) {
  const all = new Map<string, { classId: string; depth: number }>();
  for (const seed of seeds) {
    const reachable = await bfsTraversal(iModel, seed.id, seed.classId, maxDepth);
    for (const [id, info] of reachable) {
      if (!all.has(id))
        all.set(id, info);
    }
  }
  return all;
}
```

## Pattern 6: Real-world scenario — impact analysis

A common use case is determining what elements are affected when a component changes. For example, finding all elements that are transitively connected to a modified pipe:

```typescript
async function impactAnalysis(iModel: IModelDb, changedElementId: string, changedClassId: string) {
  // BFS to find all transitively connected elements
  const affected = await bfsTraversal(iModel, changedElementId, changedClassId, 5, "forward");

  // Enrich with element properties
  const impacted = [];
  for (const [id] of affected) {
    for await (const row of iModel.createQueryReader(
      `SELECT ECInstanceId, UserLabel FROM bis.Element WHERE ECInstanceId = ${id}`,
      undefined,
      { rowFormat: QueryRowFormat.UseJsPropertyNames }
    )) {
      impacted.push(row.toRow());
    }
  }
  return impacted;
}
```

## Performance considerations

- **Prefer `relations()` over manual relationship JOINs** when you need to discover all relationships from a seed without knowing specific class names.
- **Use direction filtering** to reduce the result set when you only care about one direction.
- **Set depth limits** in BFS traversals to avoid runaway walks in densely connected graphs.
- **Track visited nodes** in BFS loops — without it, cycles in the graph may cause infinite loops.
- The virtual table works with both **link-table** (many-to-many) and **navigation-property** (foreign-key) relationships transparently.

## See also

- [relations() Virtual Table Reference](../ECSqlReference/RelationsVTab.md) — full syntax, columns, and options
- [CTE (Common Table Expression)](../ECSqlReference/CTE.md) — recursive CTE syntax
- [Executing ECSQL](./ExecutingECSQL.md) — how to run ECSQL from TypeScript
- [Frequently Used ECSQL Queries](./ECSQL-queries.md) — other useful query patterns
- [Spatial Queries](../SpatialQueries.md) — spatial index-based queries
