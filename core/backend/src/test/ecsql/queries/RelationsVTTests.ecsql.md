Copyright © Bentley Systems, Incorporated. All rights reserved. See [LICENSE.md](../../../../LICENSE.md) for license terms and full copyright notice.

<!--
`ECVLib.Relations()` is an experimental table valued function that returns every instance directly
related to a seed instance, without having to know which relationships apply to it.

    ECVLib.Relations(<ECInstanceId>, <ECClassId>[, <direction>])

It returns the columns `RelatedECInstanceId`, `RelatedECClassId`, `Direction`,
`RelationshipECClassId`, `RelationshipECInstanceId` and `NavPropertyName`.

The first half of this file verifies the behavior of the function. The second half
("Learning ...") demonstrates how it is used against the BisCore schema.

See docs/learning/ECSqlReference/Relations.md for the reference documentation.
-->

# Relations() is experimental and rejected unless experimental features are enabled

<!--
`Relations()` is disabled by default. Without `ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES`
(or `PRAGMA experimental_features_enabled=true`) the statement already fails to prepare.
-->

- dataset: AllProperties.bim
- errorDuringPrepare: true

```sql
SELECT r.RelatedECInstanceId FROM bis.Element e, ECVLib.Relations(e.ECInstanceId, e.ECClassId) r WHERE e.ECInstanceId = 0x14
```

# Relations() traverses in both directions by default

<!--
Without a direction argument the seed is expanded in both directions, so the result mixes
`forward` rows (the seed is the source of the relationship) with `backward` rows (the seed is
the target). Element `0x14` participates in both end table (navigation property) relationships
and in the `AllProperties:TestElementRefersToElements` link table relationship.
-->

- dataset: AllProperties.bim

```sql
SELECT r.RelatedECInstanceId, r.Direction, rc.Name RelName, r.NavPropertyName FROM bis.Element e, ECVLib.Relations(e.ECInstanceId, e.ECClassId) r JOIN meta.ECClassDef rc ON rc.ECInstanceId = r.RelationshipECClassId WHERE e.ECInstanceId = 0x14 ORDER BY r.RelatedECInstanceId, rc.Name ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
```

| className        | accessString        | generated | index | jsonName            | name                | extendedType | typeName | type   | originPropertyName  |
| ---------------- | ------------------- | --------- | ----- | ------------------- | ------------------- | ------------ | -------- | ------ | ------------------- |
|                  | RelatedECInstanceId | false     | 0     | relatedECInstanceId | RelatedECInstanceId | Id           | long     | Id     | RelatedECInstanceId |
| ECVLib:Relations | Direction           | false     | 1     | direction           | Direction           | undefined    | string   | String | Direction           |
|                  | RelName             | true      | 2     | relName             | RelName             | undefined    | string   | String | Name                |
| ECVLib:Relations | NavPropertyName     | false     | 3     | navPropertyName     | NavPropertyName     | undefined    | string   | String | NavPropertyName     |

| RelatedECInstanceId | Direction | RelName                        | NavPropertyName |
| ------------------- | --------- | ------------------------------ | --------------- |
| 0x1                 | backward  | CodeSpecSpecifiesCode          | CodeSpec        |
| 0x1                 | backward  | ElementScopesCode              | CodeScope       |
| 0x11                | backward  | ModelContainsElements          | Model           |
| 0x12                | forward   | GeometricElement3dIsInCategory | Category        |
| 0x15                | forward   | TestElementRefersToElements    | undefined       |
| 0x21                | forward   | ElementOwnsUniqueAspect        | Element         |

# Relations() with direction 'forward'

<!--
`forward` restricts the traversal to relationships in which the seed is the source. It is exactly
the subset of the default result whose `Direction` is `forward`.
-->

- dataset: AllProperties.bim

```sql
SELECT r.RelatedECInstanceId, rc.Name RelName, r.NavPropertyName FROM bis.Element e, ECVLib.Relations(e.ECInstanceId, e.ECClassId, 'forward') r JOIN meta.ECClassDef rc ON rc.ECInstanceId = r.RelationshipECClassId WHERE e.ECInstanceId = 0x14 ORDER BY r.RelatedECInstanceId, rc.Name ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
```

| className        | accessString        | generated | index | jsonName            | name                | extendedType | typeName | type   | originPropertyName  |
| ---------------- | ------------------- | --------- | ----- | ------------------- | ------------------- | ------------ | -------- | ------ | ------------------- |
|                  | RelatedECInstanceId | false     | 0     | relatedECInstanceId | RelatedECInstanceId | Id           | long     | Id     | RelatedECInstanceId |
|                  | RelName             | true      | 1     | relName             | RelName             | undefined    | string   | String | Name                |
| ECVLib:Relations | NavPropertyName     | false     | 2     | navPropertyName     | NavPropertyName     | undefined    | string   | String | NavPropertyName     |

| RelatedECInstanceId | RelName                        | NavPropertyName |
| ------------------- | ------------------------------ | --------------- |
| 0x12                | GeometricElement3dIsInCategory | Category        |
| 0x15                | TestElementRefersToElements    | undefined       |
| 0x21                | ElementOwnsUniqueAspect        | Element         |

# Relations() with direction 'backward'

<!--
`backward` restricts the traversal to relationships in which the seed is the target.
-->

- dataset: AllProperties.bim

```sql
SELECT r.RelatedECInstanceId, rc.Name RelName, r.NavPropertyName FROM bis.Element e, ECVLib.Relations(e.ECInstanceId, e.ECClassId, 'backward') r JOIN meta.ECClassDef rc ON rc.ECInstanceId = r.RelationshipECClassId WHERE e.ECInstanceId = 0x14 ORDER BY r.RelatedECInstanceId, rc.Name ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
```

| className        | accessString        | generated | index | jsonName            | name                | extendedType | typeName | type   | originPropertyName  |
| ---------------- | ------------------- | --------- | ----- | ------------------- | ------------------- | ------------ | -------- | ------ | ------------------- |
|                  | RelatedECInstanceId | false     | 0     | relatedECInstanceId | RelatedECInstanceId | Id           | long     | Id     | RelatedECInstanceId |
|                  | RelName             | true      | 1     | relName             | RelName             | undefined    | string   | String | Name                |
| ECVLib:Relations | NavPropertyName     | false     | 2     | navPropertyName     | NavPropertyName     | undefined    | string   | String | NavPropertyName     |

| RelatedECInstanceId | RelName               | NavPropertyName |
| ------------------- | --------------------- | --------------- |
| 0x1                 | CodeSpecSpecifiesCode | CodeSpec        |
| 0x1                 | ElementScopesCode     | CodeScope       |
| 0x11                | ModelContainsElements | Model           |

# The direction argument is case insensitive

<!--
`'BACKWARD'` produces exactly the same rows as `'backward'`.
-->

- dataset: AllProperties.bim

```sql
SELECT r.RelatedECInstanceId, rc.Name RelName, r.NavPropertyName FROM bis.Element e, ECVLib.Relations(e.ECInstanceId, e.ECClassId, 'BACKWARD') r JOIN meta.ECClassDef rc ON rc.ECInstanceId = r.RelationshipECClassId WHERE e.ECInstanceId = 0x14 ORDER BY r.RelatedECInstanceId, rc.Name ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
```

| RelatedECInstanceId | RelName               | NavPropertyName |
| ------------------- | --------------------- | --------------- |
| 0x1                 | CodeSpecSpecifiesCode | CodeSpec        |
| 0x1                 | ElementScopesCode     | CodeScope       |
| 0x11                | ModelContainsElements | Model           |

# A NULL direction means 'both'

<!--
Passing NULL as the direction is the same as omitting the argument, which makes it safe to feed
the direction from a column that may be NULL.
-->

- dataset: AllProperties.bim

```sql
SELECT r.RelatedECInstanceId, r.Direction FROM bis.Element e, ECVLib.Relations(e.ECInstanceId, e.ECClassId, NULL) r WHERE e.ECInstanceId = 0x14 ORDER BY r.RelatedECInstanceId, r.RelationshipECClassId ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
```

| RelatedECInstanceId | Direction |
| ------------------- | --------- |
| 0x1                 | backward  |
| 0x1                 | backward  |
| 0x11                | backward  |
| 0x12                | forward   |
| 0x15                | forward   |
| 0x21                | forward   |

# An invalid direction is rejected

<!--
Only 'forward', 'backward' and 'both' are accepted. Anything else is an error rather than an
empty result, so that a typo cannot be mistaken for "no relationships".
-->

- dataset: AllProperties.bim
- mode: Statement
- stepStatus: BE_SQLITE_ERROR

```sql
SELECT r.RelatedECInstanceId FROM bis.Element e, ECVLib.Relations(e.ECInstanceId, e.ECClassId, 'sideways') r WHERE e.ECInstanceId = 0x14 ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
```

# Relations() can be used without the ECVLib schema prefix

<!--
`Relations(...)` and `ECVLib.Relations(...)` are the same function.
-->

- dataset: AllProperties.bim

```sql
SELECT r.RelatedECInstanceId, r.Direction FROM bis.Element e, Relations(e.ECInstanceId, e.ECClassId, 'forward') r WHERE e.ECInstanceId = 0x14 ORDER BY r.RelatedECInstanceId ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
```

| RelatedECInstanceId | Direction |
| ------------------- | --------- |
| 0x12                | forward   |
| 0x15                | forward   |
| 0x21                | forward   |

# NavPropertyName is the navigation property for end table relationships and NULL for link tables

<!--
`NavPropertyName` tells you how the relationship is stored. For end table (foreign key)
relationships it is the name of the navigation property holding the relationship, so the row can
be reproduced with plain ECSql. `AllProperties:TestElementRefersToElements` is a link table
relationship, which has no navigation property, so the column is NULL there.

`RelationshipECInstanceId` is the id of the relationship instance itself. For a link table
relationship that is the id of the link table row (`0x26`), for an end table relationship it is
the id of the element holding the foreign key.
-->

- dataset: AllProperties.bim

```sql
SELECT r.RelatedECInstanceId, rc.Name RelName, r.RelationshipECInstanceId, r.NavPropertyName FROM bis.Element e, ECVLib.Relations(e.ECInstanceId, e.ECClassId, 'forward') r JOIN meta.ECClassDef rc ON rc.ECInstanceId = r.RelationshipECClassId WHERE e.ECInstanceId = 0x14 ORDER BY r.RelatedECInstanceId ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
```

| className        | accessString             | generated | index | jsonName                 | name                     | extendedType | typeName | type   | originPropertyName       |
| ---------------- | ------------------------ | --------- | ----- | ------------------------ | ------------------------ | ------------ | -------- | ------ | ------------------------ |
|                  | RelatedECInstanceId      | false     | 0     | relatedECInstanceId      | RelatedECInstanceId      | Id           | long     | Id     | RelatedECInstanceId      |
|                  | RelName                  | true      | 1     | relName                  | RelName                  | undefined    | string   | String | Name                     |
|                  | RelationshipECInstanceId | false     | 2     | relationshipECInstanceId | RelationshipECInstanceId | Id           | long     | Id     | RelationshipECInstanceId |
| ECVLib:Relations | NavPropertyName          | false     | 3     | navPropertyName          | NavPropertyName          | undefined    | string   | String | NavPropertyName          |

| RelatedECInstanceId | RelName                        | RelationshipECInstanceId | NavPropertyName |
| ------------------- | ------------------------------ | ------------------------ | --------------- |
| 0x12                | GeometricElement3dIsInCategory | 0x14                     | Category        |
| 0x15                | TestElementRefersToElements    | 0x26                     | undefined       |
| 0x21                | ElementOwnsUniqueAspect        | 0x21                     | Element         |

# An unknown seed returns no rows instead of an error

<!--
A syntactically valid seed that does not exist simply has no relationships.
-->

- dataset: AllProperties.bim
- mode: Statement
- stepStatus: BE_SQLITE_DONE

```sql
SELECT RelatedECInstanceId FROM ECVLib.Relations(999999, 999999) ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
```

# Relations() without an ECClassId is rejected

<!--
Both the ECInstanceId and the ECClassId are mandatory. A single argument cannot be resolved into
a query plan, so preparation fails.
-->

- dataset: AllProperties.bim
- errorDuringPrepare: true

```sql
SELECT RelatedECInstanceId FROM ECVLib.Relations(0x14) ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
```

# Relations() with more than three arguments is rejected

- dataset: AllProperties.bim
- errorDuringPrepare: true

```sql
SELECT RelatedECInstanceId FROM ECVLib.Relations(0x14, 0x17b, 'forward', 4) ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
```

# Two Relations() can be chained to walk two hops

<!--
The `RelatedECInstanceId`/`RelatedECClassId` of one Relations() can be used as the seed of the
next one, which walks the graph one more hop. Here `0x14` refers to `0x15` through the link
table, and `0x15` in turn is in category `0x12`.
-->

- dataset: AllProperties.bim

```sql
SELECT r1.RelatedECInstanceId Hop1, r2.RelatedECInstanceId Hop2 FROM bis.Element e, ECVLib.Relations(e.ECInstanceId, e.ECClassId, 'forward') r1, ECVLib.Relations(r1.RelatedECInstanceId, r1.RelatedECClassId, 'forward') r2 WHERE e.ECInstanceId = 0x14 AND r1.RelatedECInstanceId = 0x15 ORDER BY r2.RelatedECInstanceId ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
```

| className | accessString | generated | index | jsonName | name | extendedType | typeName | type | originPropertyName  |
| --------- | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ---- | ------------------- |
|           | Hop1         | true      | 0     | hop1     | Hop1 | Id           | long     | Id   | RelatedECInstanceId |
|           | Hop2         | true      | 1     | hop2     | Hop2 | Id           | long     | Id   | RelatedECInstanceId |

| Hop1 | Hop2 |
| ---- | ---- |
| 0x15 | 0x12 |

# Learning - finding the model that contains an element

<!--
`bis.Element` stores its model in the `Model` navigation property, which backs the
`BisCore:ModelContainsElements` relationship. Because the element is the *target* of that
relationship, the model shows up as a `backward` row. Filtering on the relationship class name
turns the generic traversal into a specific question: "which model contains element 0x14?".
-->

- dataset: AllProperties.bim

```sql
SELECT r.RelatedECInstanceId ModelId FROM bis.Element e, ECVLib.Relations(e.ECInstanceId, e.ECClassId, 'backward') r JOIN meta.ECClassDef rc ON rc.ECInstanceId = r.RelationshipECClassId WHERE e.ECInstanceId = 0x14 AND rc.Name = 'ModelContainsElements' ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
```

| ModelId |
| ------- |
| 0x11    |

# Learning - counting the elements a model contains

<!--
The same relationship read from the other end. Seeding with the model and traversing `forward`
yields one row per contained element, so the physical model `0x11` reports its 12 elements.
-->

- dataset: AllProperties.bim

```sql
SELECT m.ECInstanceId ModelId, COUNT(*) ContainedElements FROM bis.Model m, ECVLib.Relations(m.ECInstanceId, m.ECClassId, 'forward') r JOIN meta.ECClassDef rc ON rc.ECInstanceId = r.RelationshipECClassId WHERE m.ECInstanceId = 0x11 AND rc.Name = 'ModelContainsElements' GROUP BY m.ECInstanceId ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
```

| ModelId | ContainedElements |
| ------- | ----------------- |
| 0x11    | 12                |

# Learning - listing every relationship an element takes part in

<!--
This is what Relations() is for: the caller does not have to know which BisCore relationships
apply to `0x1e`. Grouping by relationship class gives an overview of how the element is
connected - through its code, its model, its category and the domain specific
`AllProperties:TestFeatureUsesElement` navigation property.
-->

- dataset: AllProperties.bim

```sql
SELECT rc.Name RelName, COUNT(*) Cnt FROM bis.Element e, ECVLib.Relations(e.ECInstanceId, e.ECClassId) r JOIN meta.ECClassDef rc ON rc.ECInstanceId = r.RelationshipECClassId WHERE e.ECInstanceId = 0x1e GROUP BY rc.Name ORDER BY rc.Name ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
```

| RelName                        | Cnt |
| ------------------------------ | --- |
| CodeSpecSpecifiesCode          | 1   |
| ElementScopesCode              | 1   |
| GeometricElement3dIsInCategory | 1   |
| ModelContainsElements          | 1   |
| TestFeatureUsesElement         | 1   |

# Learning - a CTE can supply the seed

<!--
The seed does not have to come from a plain class - any table, subquery or CTE works, so a set
of seeds can be prepared once and then expanded.
-->

- dataset: AllProperties.bim

```sql
WITH seed(Id, ClassId) AS (SELECT ECInstanceId, ECClassId FROM bis.Model WHERE ECInstanceId = 0x11) SELECT r.RelatedECInstanceId FROM seed, ECVLib.Relations(seed.Id, seed.ClassId, 'forward') r ORDER BY r.RelatedECInstanceId ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
```

| RelatedECInstanceId |
| ------------------- |
| 0x11                |
| 0x14                |
| 0x15                |
| 0x16                |
| 0x17                |
| 0x18                |
| 0x19                |
| 0x1a                |
| 0x1b                |
| 0x1c                |
| 0x1d                |
| 0x1e                |
| 0x1f                |

# Learning - recursive traversal with a CTE

<!--
Relations() only reports the instances *directly* related to the seed. A recursive CTE feeds each
newly discovered instance back in as the next seed, which walks the graph to an arbitrary depth.

Note that `ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES` has to be attached to the SELECT that
actually contains Relations() - the recursive term - because the option does not propagate from
the outer statement into the CTE body. `PRAGMA experimental_features_enabled=true` avoids this.

Starting from element 0x14: at depth 1 it reaches its category (0x12), the element it refers to
through the link table (0x15) and its aspect (0x21); at depth 2 the category's sub-category
(0x13) is reached through 0x12.
-->

- dataset: AllProperties.bim

```sql
WITH RECURSIVE reachable(Id, ClassId, Depth) AS (SELECT ECInstanceId, ECClassId, 0 FROM bis.Element WHERE ECInstanceId = 0x14 UNION SELECT r.RelatedECInstanceId, r.RelatedECClassId, Depth + 1 FROM reachable, ECVLib.Relations(reachable.Id, reachable.ClassId, 'forward') r WHERE Depth < 2 ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES) SELECT Id, Depth FROM reachable ORDER BY Depth, Id
```

| Id   | Depth |
| ---- | ----- |
| 0x14 | 0     |
| 0x12 | 1     |
| 0x15 | 1     |
| 0x21 | 1     |
| 0x12 | 2     |
| 0x13 | 2     |

# Learning - resolving the related instances back to elements

<!--
Relations() only returns keys. Joining `RelatedECInstanceId` back to `bis.Element` turns those
keys into real rows. Note that the join also acts as a filter: the aspect `0x21` reached through
`ElementOwnsUniqueAspect` is not an element and therefore drops out.
-->

- dataset: AllProperties.bim

```sql
SELECT related.ECInstanceId, related.CodeValue FROM bis.Element seed, ECVLib.Relations(seed.ECInstanceId, seed.ECClassId, 'forward') r JOIN bis.Element related ON related.ECInstanceId = r.RelatedECInstanceId WHERE seed.ECInstanceId = 0x14 ORDER BY related.ECInstanceId ECSQLOPTIONS ENABLE_EXPERIMENTAL_FEATURES
```

| className       | accessString | generated | index | jsonName  | name         | extendedType | typeName | type   | originPropertyName |
| --------------- | ------------ | --------- | ----- | --------- | ------------ | ------------ | -------- | ------ | ------------------ |
|                 | ECInstanceId | false     | 0     | id        | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
| BisCore:Element | CodeValue    | false     | 1     | codeValue | CodeValue    | undefined    | string   | String | CodeValue          |

| ECInstanceId | CodeValue         |
| ------------ | ----------------- |
| 0x12         | MySpatialCategory |
| 0x15         | undefined         |
