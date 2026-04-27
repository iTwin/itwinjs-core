# relations() Virtual Table

> **Experimental feature** — `relations()` is currently experimental and disabled by default. Enable it per-query by appending `ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES` to your ECSQL, or enable it for the connection with `PRAGMA experimental_features_enabled=true`.

`relations()` is a built-in virtual table that provides fast one-hop relationship traversal from a seed instance. Unlike traditional ECSQL relationship queries that join through class tables, `relations()` bypasses ECSQL entirely and generates raw SQLite statements from property maps, delivering **3–10× faster** traversal.

The virtual table is registered under the `ECVLib` schema. It discovers all applicable relationships (both link-table and navigation-property based) for the seed class and returns one row per related instance.

## Syntax

```sql
SELECT RelatedECInstanceId, RelatedECClassId, Direction, RelationshipECClassId
FROM ECVLib.Relations(<seed-id>, <seed-class-id> [, '<direction>'])
ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
```

The table-valued function accepts 2 or 3 arguments:

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| 1st | Id64 | **Yes** | The seed instance id |
| 2nd | Id64 | **Yes** | The seed class id |
| 3rd | string | No | `'forward'`, `'backward'`, or `'both'` (default) |

## Columns

| Column | Type | Description |
|--------|------|-------------|
| `RelatedECInstanceId` | Id64 | *(output)* Id of the related instance |
| `RelatedECClassId` | Id64 | *(output)* ECClassId of the related instance |
| `Direction` | string | *(output)* Actual direction of this edge: `'forward'` or `'backward'` |
| `RelationshipECClassId` | Id64 | *(output)* ECClassId of the relationship that was traversed |

### Direction semantics

- **Forward**: The seed is on the **source** side of the relationship → related instance is the **target**.
- **Backward**: The seed is on the **target** side → related instance is the **source**.

## Examples

> All examples below include `ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES` which is required while this feature is experimental.

### Basic: find all related instances

```sql
SELECT RelatedECInstanceId, RelatedECClassId, Direction, RelationshipECClassId
FROM ECVLib.Relations(0x1A, 0x38)
ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
```

### Forward-only traversal

```sql
SELECT RelatedECInstanceId, RelatedECClassId
FROM ECVLib.Relations(0x1A, 0x38, 'forward')
ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
```

### Backward-only traversal

```sql
SELECT RelatedECInstanceId, RelatedECClassId
FROM ECVLib.Relations(0x1A, 0x38, 'backward')
ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
```

### JOIN with element data

Combine `relations()` with a regular class query to retrieve properties of related instances:

```sql
SELECT e.ECInstanceId, e.UserLabel, e.CodeValue, r.Direction
FROM bis.Element e
JOIN ECVLib.Relations(0x1A, 0x38) r
  ON r.RelatedECInstanceId = e.ECInstanceId
ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
```

### Cross-join with element table

Use a cross-join to pass column references as TVF arguments:

```sql
SELECT r.RelatedECInstanceId, r.Direction
FROM bis.Element a, ECVLib.Relations(a.ECInstanceId, a.ECClassId) r
WHERE a.CodeValue = 'MyElement'
ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
```

### Chained multi-hop traversal

Chain multiple `Relations()` cross-joins for multi-hop traversal in a single query:

```sql
SELECT r1.RelatedECInstanceId AS Hop1, r2.RelatedECInstanceId AS Hop2
FROM bis.Element a,
     ECVLib.Relations(a.ECInstanceId, a.ECClassId, 'forward') r1,
     ECVLib.Relations(r1.RelatedECInstanceId, r1.RelatedECClassId, 'forward') r2
WHERE a.CodeValue = 'MyElement'
ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
```

### Multi-hop BFS using a recursive CTE

Walk the graph breadth-first up to a maximum depth:

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

### Subquery: filter elements by relationship

```sql
SELECT ECInstanceId, UserLabel
FROM bis.Element
WHERE ECInstanceId IN (
  SELECT RelatedECInstanceId FROM ECVLib.Relations(0x1A, 0x38, 'forward')
)
ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
```

## TypeScript usage

### Using `createQueryReader` (async)

```typescript
const seedId = "0x1a";
const seedClassId = "0x38";

for await (const row of iModel.createQueryReader(
  `SELECT RelatedECInstanceId, RelatedECClassId, Direction
   FROM ECVLib.Relations(${seedId}, ${seedClassId})
   ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES`,
  undefined,
  { rowFormat: QueryRowFormat.UseJsPropertyNames }
)) {
  const related = row.toRow();
  console.log(`Related: ${related.relatedECInstanceId}, direction: ${related.direction}`);
}
```

### Multi-hop BFS traversal in TypeScript

For multi-hop graph traversal, use a programmatic BFS loop with the TVF:

```typescript
async function bfsTraversal(
  iModel: IModelDb,
  seedId: string,
  seedClassId: string,
  maxDepth: number,
  direction: "forward" | "backward" | "both" = "both"
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

## Compared to traditional ECSQL relationship queries

| Aspect | Traditional ECSQL | `relations()` virtual table |
|--------|-------------------|-----------------------------|
| **Speed** | Baseline | 3–10× faster |
| **Setup** | Must know relationship class name | Auto-discovers all applicable relationships |
| **Multi-hop** | Complex nested JOINs | Recursive CTE, chained cross-join, or programmatic BFS |
| **Direction control** | Manual source/target JOINs | Direction argument filter |
| **Relationship types** | Separate queries for link-table vs nav-prop | Unified result set |

## Notes

- **Experimental**: This feature is experimental and must be explicitly enabled via `ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES` or `PRAGMA experimental_features_enabled=true`.
- Both required arguments (seed id and seed class id) must be provided. Omitting either produces an empty result set.
- The virtual table automatically handles polymorphic relationships — derived classes on either side of a relationship constraint are discovered.
- The direction argument defaults to `'both'` if omitted.
- Results include relationships from **all** applicable relationship classes, not just one. Use the `RelationshipECClassId` column to distinguish which relationship class produced each row.
- Cross-join syntax (`FROM table a, Relations(a.col1, a.col2) r`) allows passing column references as TVF arguments. This is required for recursive CTEs and chained multi-hop queries.

## See also

- [Relationship Traversal Guide](../backend/RelationshipTraversal.md) — practical patterns for graph queries
- [CTE (Common Table Expression)](./CTE.md) — recursive CTE syntax
- [JOINs](./JOIN.md) — join syntax
- [IdSet Virtual Table](./IdSet.md) — another built-in virtual table
- [Spatial Queries](../SpatialQueries.md) — spatial index virtual table

[ECSql Syntax](./index.md)
