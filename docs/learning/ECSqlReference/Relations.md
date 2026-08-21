# Relations Virtual Table

`Relations` is an ECSQL built in table valued function that returns every instance directly related to a *seed* instance, without the caller having to know which relationships apply to that instance. It is backed by a native graph traversal that reads the relationship storage directly instead of preparing one ECSQL statement per candidate relationship class, which makes it substantially faster than discovering the applicable relationships yourself.

`Relations` is defined under the schema named `ECVLib`. The schema name is optional for table valued functions, so `Relations(...)` and `ECVLib.Relations(...)` are equivalent.

It is an experimental feature, so `PRAGMA experimental_features_enabled=true` must be set on the connection, or the ECSQL option `ENABLE_EXPERIMENTAL_FEATURES` must be passed with the query, in order for it to work.

## When to use it

[Joins](./JOIN.md) and [navigation properties](../ECSQL.md#navigation-properties) both require you to know *which* relationship to traverse, and are the better choice whenever you do. `Relations` is for the cases where you do not:

- generic "what is this element connected to?" views, where the relationships differ per element
- following a chain of relationships whose classes vary from one hop to the next
- code that must work against schemas it was not written against

## Syntax

```sql
ECVLib.Relations(<ECInstanceId>, <ECClassId>[, <direction>])
```

The seed is identified by *both* an `ECInstanceId` and an `ECClassId`, because the class determines which relationships can apply. Both arguments are mandatory — a query that supplies only one is rejected rather than silently returning no rows.

Arguments may be literals:

```sql
SELECT RelatedECInstanceId, Direction FROM ECVLib.Relations(0x20000000001, 0x94) ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
```

or column references, which expands the relationships of every row of the driving table:

```sql
SELECT e.ECInstanceId, r.RelatedECInstanceId
FROM bis.Element e, ECVLib.Relations(e.ECInstanceId, e.ECClassId) r
WHERE e.CodeValue = 'Wall-1'
ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
```

## Traversal direction

The optional third argument restricts the traversal:

| Value        | Meaning                                                     |
| ------------ | ----------------------------------------------------------- |
| `'forward'`  | Only relationships in which the seed is the **source**.      |
| `'backward'` | Only relationships in which the seed is the **target**.      |
| `'both'`     | Both of the above. This is the default.                     |

The comparison is case insensitive, and a `NULL` direction is treated as `'both'` — which makes it safe to feed the direction from a column that may be `NULL`. Any other value is an error rather than an empty result, so that a typo cannot be mistaken for "this instance has no relationships".

```sql
SELECT r.RelatedECInstanceId
FROM bis.Element e, ECVLib.Relations(e.ECInstanceId, e.ECClassId, 'forward') r
WHERE e.ECInstanceId = :elementId
ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
```

## Returned columns

| Column                     | Type     | Description                                                                                                                       |
| -------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `RelatedECInstanceId`      | `long`   | `ECInstanceId` of the related instance.                                                                                            |
| `RelatedECClassId`         | `long`   | `ECClassId` of the related instance.                                                                                               |
| `Direction`                | `string` | `forward` when the seed is the source of the relationship, `backward` when it is the target.                                        |
| `RelationshipECClassId`    | `long`   | `ECClassId` of the relationship that was traversed.                                                                                 |
| `RelationshipECInstanceId` | `long`   | `ECInstanceId` of the relationship instance. This distinguishes two link table rows connecting the same pair of instances. |
| `NavPropertyName`          | `string` | Name of the navigation property that stores the relationship for end table (foreign key) relationships. `NULL` for link table relationships. |

`NavPropertyName` tells you *how* the relationship is stored. When it is not `NULL`, the same row can be reproduced with plain ECSQL through that navigation property. When it is `NULL`, the relationship lives in a link table and must be queried as a relationship class.

## Examples

### Which model contains an element

`Direction` is `forward` when the seed is the *source* of the relationship and `backward` when it is the *target*. `BisCore:ModelContainsElements` is stored in the `Model` navigation property of `bis.Element`, and the element is the *target* of that relationship, so the model appears as a `backward` row:

```sql
SELECT r.RelatedECInstanceId ModelId
FROM bis.Element e, ECVLib.Relations(e.ECInstanceId, e.ECClassId, 'backward') r
  JOIN meta.ECClassDef rc ON rc.ECInstanceId = r.RelationshipECClassId
WHERE e.ECInstanceId = :elementId AND rc.Name = 'ModelContainsElements'
ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
```

### Everything an element is connected to

This is the case `Relations` exists for — the caller does not have to know any BisCore relationship names up front:

```sql
SELECT rc.Name RelationshipName, r.Direction, COUNT(*) Cnt
FROM bis.Element e, ECVLib.Relations(e.ECInstanceId, e.ECClassId) r
  JOIN meta.ECClassDef rc ON rc.ECInstanceId = r.RelationshipECClassId
WHERE e.ECInstanceId = :elementId
GROUP BY rc.Name, r.Direction
ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
```

### Resolving the related instances

`Relations` only returns keys. Join `RelatedECInstanceId` back to a class to turn them into rows. Note that such a join also acts as a filter — related instances that are not elements (an `ElementAspect` reached through `BisCore:ElementOwnsUniqueAspect`, for example) drop out:

```sql
SELECT related.ECInstanceId, related.CodeValue
FROM bis.Element seed, ECVLib.Relations(seed.ECInstanceId, seed.ECClassId, 'forward') r
  JOIN bis.Element related ON related.ECInstanceId = r.RelatedECInstanceId
WHERE seed.ECInstanceId = :elementId
ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
```

### Walking more than one hop

The `RelatedECInstanceId`/`RelatedECClassId` of one `Relations` can seed the next one, which walks the graph one more hop:

```sql
SELECT r1.RelatedECInstanceId Hop1, r2.RelatedECInstanceId Hop2
FROM bis.Element e,
  ECVLib.Relations(e.ECInstanceId, e.ECClassId, 'forward') r1,
  ECVLib.Relations(r1.RelatedECInstanceId, r1.RelatedECClassId, 'forward') r2
WHERE e.ECInstanceId = :elementId
ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
```

## Recursive traversal with a CTE

`Relations` reports the instances *directly* related to the seed — it does not recurse. To walk further, feed each newly discovered instance back in as the next seed with a [recursive CTE](./CTE.md). `UNION` (rather than `UNION ALL`) discards rows that have already been produced, which keeps cycles from looping forever:

```sql
WITH RECURSIVE reachable(Id, ClassId, Depth) AS (
  SELECT ECInstanceId, ECClassId, 0 FROM bis.Element WHERE ECInstanceId = :elementId
  UNION
  SELECT r.RelatedECInstanceId, r.RelatedECClassId, Depth + 1
  FROM reachable, ECVLib.Relations(reachable.Id, reachable.ClassId, 'forward') r
  WHERE Depth < 3 ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
)
SELECT Id, Depth FROM reachable ORDER BY Depth, Id
```

> **Note:** `ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES` must be attached to the `SELECT` that actually contains `Relations()` — the recursive term — because the option does not propagate from the outer statement into the CTE body. Enabling the feature once with `PRAGMA experimental_features_enabled=true` avoids having to place the option carefully.

Always bound the recursion with a depth limit (or another terminating condition). `UNION` only suppresses rows that are identical in *every* column, so a `Depth` column means the same instance can still be reported once per depth at which it is reached.

## Remarks

- A syntactically valid seed that does not exist yields no rows rather than an error, so `Relations` can be joined against columns that are legitimately unset.
- Only instances of the primary (`main`) table space are traversed.
- The seed does not have to come from a class — any table, subquery or CTE can supply the `ECInstanceId`/`ECClassId` pair.
- Make sure the `ECClassId` you pass is the one for the aspect of the instance you mean. A `bis.PhysicalPartition` element and the `bis.PhysicalModel` that models it share an `ECInstanceId` but have different `ECClassId`s, and they have completely different relationships.

[ECSql Syntax](./index.md)
