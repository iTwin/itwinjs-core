# JOIN

- dataset: AllProperties.bim

```sql
SELECT
  te.ECInstanceId,
  te.i
FROM
  aps.TestElement te
  JOIN aps.IPrimitive p ON te.ECInstanceId = p.ECInstanceId
LIMIT
  3
```

| className                | accessString | generated | index | jsonName | name         | extendedType | typeName | type | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | -------- | ------------ | ------------ | -------- | ---- | ------------------ |
|                          | ECInstanceId | false     | 0     | id       | ECInstanceId | Id           | long     | Id   | ECInstanceId       |
| AllProperties:IPrimitive | i            | false     | 1     | i        | i            | undefined    | int      | Int  | i                  |

| ECInstanceId | i   |
| ------------ | --- |
| 0x14         | 100 |
| 0x15         | 101 |
| 0x16         | 102 |

# INNER JOIN

- dataset: AllProperties.bim

```sql
SELECT
  te.ECInstanceId,
  te.i
FROM
  aps.TestElement te
  INNER JOIN aps.IPrimitive p ON te.ECInstanceId = p.ECInstanceId
LIMIT
  3
```

| className                | accessString | generated | index | jsonName | name         | extendedType | typeName | type | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | -------- | ------------ | ------------ | -------- | ---- | ------------------ |
|                          | ECInstanceId | false     | 0     | id       | ECInstanceId | Id           | long     | Id   | ECInstanceId       |
| AllProperties:IPrimitive | i            | false     | 1     | i        | i            | undefined    | int      | Int  | i                  |

| ECInstanceId | i   |
| ------------ | --- |
| 0x14         | 100 |
| 0x15         | 101 |
| 0x16         | 102 |

# LEFT JOIN

- dataset: AllProperties.bim

```sql
SELECT
  te.ECInstanceId,
  te.i
FROM
  aps.TestElement te
  LEFT JOIN meta.ECSchemaDef d ON d.VersionMajor + 100 = te.i
LIMIT
  3
```

| className                | accessString | generated | index | jsonName | name         | extendedType | typeName | type | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | -------- | ------------ | ------------ | -------- | ---- | ------------------ |
|                          | ECInstanceId | false     | 0     | id       | ECInstanceId | Id           | long     | Id   | ECInstanceId       |
| AllProperties:IPrimitive | i            | false     | 1     | i        | i            | undefined    | int      | Int  | i                  |

| ECInstanceId | i   |
| ------------ | --- |
| 0x14         | 100 |
| 0x15         | 101 |
| 0x15         | 101 |

# RIGHT JOIN

- dataset: AllProperties.bim

```sql
SELECT
  te.ECInstanceId,
  te.i
FROM
  aps.TestElement te
  RIGHT JOIN meta.ECSchemaDef d ON d.VersionMajor + 100 = te.i
```

| className                | accessString | generated | index | jsonName | name         | extendedType | typeName | type | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | -------- | ------------ | ------------ | -------- | ---- | ------------------ |
|                          | ECInstanceId | false     | 0     | id       | ECInstanceId | Id           | long     | Id   | ECInstanceId       |
| AllProperties:IPrimitive | i            | false     | 1     | i        | i            | undefined    | int      | Int  | i                  |

| ECInstanceId | i   |
| ------------ | --- |
| 0x15         | 101 |
| 0x15         | 101 |
| 0x15         | 101 |
| 0x15         | 101 |
| 0x15         | 101 |
| 0x15         | 101 |
| 0x16         | 102 |
| 0x16         | 102 |
| 0x18         | 104 |
| 0x19         | 105 |

# FULL JOIN

- dataset: AllProperties.bim

```sql
SELECT
  te.ECInstanceId,
  te.i
FROM
  aps.TestElement te
  FULL JOIN meta.ECSchemaDef d ON d.VersionMajor + 100 = te.i
```

| className                | accessString | generated | index | jsonName | name         | extendedType | typeName | type | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | -------- | ------------ | ------------ | -------- | ---- | ------------------ |
|                          | ECInstanceId | false     | 0     | id       | ECInstanceId | Id           | long     | Id   | ECInstanceId       |
| AllProperties:IPrimitive | i            | false     | 1     | i        | i            | undefined    | int      | Int  | i                  |

| ECInstanceId | i   |
| ------------ | --- |
| 0x14         | 100 |
| 0x15         | 101 |
| 0x15         | 101 |
| 0x15         | 101 |
| 0x15         | 101 |
| 0x15         | 101 |
| 0x15         | 101 |
| 0x16         | 102 |
| 0x16         | 102 |
| 0x17         | 103 |
| 0x18         | 104 |
| 0x19         | 105 |
| 0x1a         | 106 |
| 0x1b         | 107 |
| 0x1c         | 108 |
| 0x1d         | 109 |

# JOIN USING - FORWARD

- dataset: AllProperties.bim

```sql
SELECT
  t0.ECInstanceId AS ParentId,
  ec_classname (t0.ECClassId) AS ParentClassName,
  t1.ECInstanceId AS ChildId,
  ec_classname (t1.ECClassId) AS ChildClassName
FROM
  [BisCore].[Element] t0
  JOIN [BisCore].[Element] t1 USING [BisCore].[ElementOwnsChildElements] FORWARD
ORDER BY t0.ECInstanceId, t1.ECInstanceId;
```

| className | accessString    | generated | index | jsonName        | name            | extendedType | typeName | type   | originPropertyName |
| --------- | --------------- | --------- | ----- | --------------- | --------------- | ------------ | -------- | ------ | ------------------ |
|           | ParentId        | true      | 0     | parentId        | ParentId        | Id           | long     | Id     | ECInstanceId       |
|           | ParentClassName | true      | 1     | parentClassName | ParentClassName | undefined    | string   | String | undefined          |
|           | ChildId         | true      | 2     | childId         | ChildId         | Id           | long     | Id     | ECInstanceId       |
|           | ChildClassName  | true      | 3     | childClassName  | ChildClassName  | undefined    | string   | String | undefined          |

| ParentId | ParentClassName         | ChildId | ChildClassName              |
| -------- | ----------------------- | ------- | --------------------------- |
| 0x1      | BisCore:Subject         | 0xe     | BisCore:LinkPartition       |
| 0x1      | BisCore:Subject         | 0x10    | BisCore:DefinitionPartition |
| 0x1      | BisCore:Subject         | 0x11    | BisCore:PhysicalPartition   |
| 0x12     | BisCore:SpatialCategory | 0x13    | BisCore:SubCategory         |

# JOIN USING - BACKWARD

- dataset: AllProperties.bim

```sql
SELECT
  t0.ECInstanceId AS ParentId,
  ec_classname (t0.ECClassId) AS ParentClassName,
  t1.ECInstanceId AS ChildId,
  ec_classname (t1.ECClassId) AS ChildClassName
FROM
  [BisCore].[Element] t0
  JOIN [BisCore].[Element] t1 USING [BisCore].[ElementOwnsChildElements] BACKWARD
ORDER BY t0.ECInstanceId, t1.ECInstanceId;
```

| className | accessString    | generated | index | jsonName        | name            | extendedType | typeName | type   | originPropertyName |
| --------- | --------------- | --------- | ----- | --------------- | --------------- | ------------ | -------- | ------ | ------------------ |
|           | ParentId        | true      | 0     | parentId        | ParentId        | Id           | long     | Id     | ECInstanceId       |
|           | ParentClassName | true      | 1     | parentClassName | ParentClassName | undefined    | string   | String | undefined          |
|           | ChildId         | true      | 2     | childId         | ChildId         | Id           | long     | Id     | ECInstanceId       |
|           | ChildClassName  | true      | 3     | childClassName  | ChildClassName  | undefined    | string   | String | undefined          |

| ParentId | ParentClassName             | ChildId | ChildClassName          |
| -------- | --------------------------- | ------- | ----------------------- |
| 0xe      | BisCore:LinkPartition       | 0x1     | BisCore:Subject         |
| 0x10     | BisCore:DefinitionPartition | 0x1     | BisCore:Subject         |
| 0x11     | BisCore:PhysicalPartition   | 0x1     | BisCore:Subject         |
| 0x13     | BisCore:SubCategory         | 0x12    | BisCore:SpatialCategory |

# Double JOIN ON

- dataset: AllProperties.bim

```sql
SELECT
  t0.ECInstanceId AS ParentId,
  ec_classname (t0.ECClassId) AS ParentClassName,
  t1.ECInstanceId AS ChildId,
  ec_classname (t1.ECClassId) AS ChildClassName,
  rel.SourceECInstanceId,
  ec_classname (rel.SourceECClassId) AS SourceClassName,
  rel.TargetECInstanceId,
  ec_classname (rel.TargetECClassId) AS TargetClassName
FROM
  [BisCore].[Element] t0
  JOIN [BisCore].[ElementOwnsChildElements] rel ON t0.ECInstanceId = rel.TargetECInstanceId
  JOIN [BisCore].[Element] t1 ON t1.ECInstanceId = rel.SourceECInstanceId
  ORDER BY t0.ECInstanceId, t1.ECInstanceId, rel.SourceECInstanceId, rel.TargetECInstanceId;
```

| className | accessString       | generated | index | jsonName        | name               | extendedType | typeName | type   | originPropertyName |
| --------- | ------------------ | --------- | ----- | --------------- | ------------------ | ------------ | -------- | ------ | ------------------ |
|           | ParentId           | true      | 0     | parentId        | ParentId           | Id           | long     | Id     | ECInstanceId       |
|           | ParentClassName    | true      | 1     | parentClassName | ParentClassName    | undefined    | string   | String | undefined          |
|           | ChildId            | true      | 2     | childId         | ChildId            | Id           | long     | Id     | ECInstanceId       |
|           | ChildClassName     | true      | 3     | childClassName  | ChildClassName     | undefined    | string   | String | undefined          |
|           | SourceECInstanceId | false     | 4     | sourceId        | SourceECInstanceId | SourceId     | long     | Id     | SourceECInstanceId |
|           | SourceClassName    | true      | 5     | sourceClassName | SourceClassName    | undefined    | string   | String | undefined          |
|           | TargetECInstanceId | false     | 6     | targetId        | TargetECInstanceId | TargetId     | long     | Id     | TargetECInstanceId |
|           | TargetClassName    | true      | 7     | targetClassName | TargetClassName    | undefined    | string   | String | undefined          |

| ParentId | ParentClassName             | ChildId | ChildClassName          | SourceECInstanceId | SourceClassName         | TargetECInstanceId | TargetClassName             |
| -------- | --------------------------- | ------- | ----------------------- | ------------------ | ----------------------- | ------------------ | --------------------------- |
| 0xe      | BisCore:LinkPartition       | 0x1     | BisCore:Subject         | 0x1                | BisCore:Subject         | 0xe                | BisCore:LinkPartition       |
| 0x10     | BisCore:DefinitionPartition | 0x1     | BisCore:Subject         | 0x1                | BisCore:Subject         | 0x10               | BisCore:DefinitionPartition |
| 0x11     | BisCore:PhysicalPartition   | 0x1     | BisCore:Subject         | 0x1                | BisCore:Subject         | 0x11               | BisCore:PhysicalPartition   |
| 0x13     | BisCore:SubCategory         | 0x12    | BisCore:SpatialCategory | 0x12               | BisCore:SpatialCategory | 0x13               | BisCore:SubCategory         |

# CROSS JOIN

- dataset: AllProperties.bim

```sql
SELECT
  te.ECInstanceId AS TestElementId,
  d.Name AS SchemaName
FROM
  aps.TestElement te
  CROSS JOIN meta.ECSchemaDef d
LIMIT
  10;
```

| className | accessString  | generated | index | jsonName      | name          | extendedType | typeName | type   | originPropertyName |
| --------- | ------------- | --------- | ----- | ------------- | ------------- | ------------ | -------- | ------ | ------------------ |
|           | TestElementId | true      | 0     | testElementId | TestElementId | Id           | long     | Id     | ECInstanceId       |
|           | SchemaName    | true      | 1     | schemaName    | SchemaName    | undefined    | string   | String | Name               |

| TestElementId | SchemaName           |
| ------------- | -------------------- |
| 0x14          | AllProperties        |
| 0x14          | BisCore              |
| 0x14          | BisCustomAttributes  |
| 0x14          | CoreCustomAttributes |
| 0x14          | ECDbFileInfo         |
| 0x14          | ECDbMap              |
| 0x14          | ECDbMeta             |
| 0x14          | ECDbSchemaPolicies   |
| 0x14          | ECDbSystem           |
| 0x14          | Generic              |

# CROSS JOIN allproperties and ecschemaDef

- dataset: AllProperties.bim

```sql
SELECT te.ECInstanceId, d.Alias FROM aps.TestElement te CROSS JOIN meta.ECSchemaDef d LIMIT 3;
```

| className            | accessString | generated | index | jsonName | name         | extendedType | typeName | type   | originPropertyName |
| -------------------- | ------------ | --------- | ----- | -------- | ------------ | ------------ | -------- | ------ | ------------------ |
|                      | ECInstanceId | false     | 0     | id       | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
| ECDbMeta:ECSchemaDef | Alias        | false     | 1     | alias    | Alias        | undefined    | string   | String | Alias              |

| ECInstanceId | Alias |
| ------------ | ----- |
| 0x14         | aps   |
| 0x14         | bis   |
| 0x14         | bisCA |

# NATURAL JOIN

- dataset: AllProperties.bim
- errorDuringPrepare: true

```sql
SELECT 1
FROM (SELECT ECInstanceId AS CommonId, FederationGuid FROM bis.Element) AS ElementAlias
NATURAL JOIN (SELECT ECInstanceId AS CommonId, IsPrivate FROM bis.Model) AS ModelAlias;
```

# Double Join Using

- dataset: AllProperties.bim

```sql
SELECT
  t0.ECInstanceId AS ParentId,
  ec_classname (t0.ECClassId) AS ParentClassName,
  t1.ECInstanceId AS ChildId,
  ec_classname (t1.ECClassId) AS ChildClassName,
  t2.ECInstanceId AS GrandChildId,
  ec_classname (t2.ECClassId) AS GrandChildClassName
FROM
  [BisCore].[Element] t0
  JOIN [BisCore].[Element] t1 USING [BisCore].[ElementOwnsChildElements] AS Rel1 FORWARD
  JOIN [BisCore].[Element] t2 USING [BisCore].[ElementOwnsChildElements] AS Rel2 FORWARD
ORDER BY t0.ECInstanceId, t1.ECInstanceId, t2.ECInstanceId;
```

| className | accessString        | generated | index | jsonName            | name                | extendedType | typeName | type   | originPropertyName |
| --------- | ------------------- | --------- | ----- | ------------------- | ------------------- | ------------ | -------- | ------ | ------------------ |
|           | ParentId            | true      | 0     | parentId            | ParentId            | Id           | long     | Id     | ECInstanceId       |
|           | ParentClassName     | true      | 1     | parentClassName     | ParentClassName     | undefined    | string   | String | undefined          |
|           | ChildId             | true      | 2     | childId             | ChildId             | Id           | long     | Id     | ECInstanceId       |
|           | ChildClassName      | true      | 3     | childClassName      | ChildClassName      | undefined    | string   | String | undefined          |
|           | GrandChildId        | true      | 4     | grandChildId        | GrandChildId        | Id           | long     | Id     | ECInstanceId       |
|           | GrandChildClassName | true      | 5     | grandChildClassName | GrandChildClassName | undefined    | string   | String | undefined          |

| ParentId | ParentClassName         | ChildId | ChildClassName              | GrandChildId | GrandChildClassName         |
| -------- | ----------------------- | ------- | --------------------------- | ------------ | --------------------------- |
| 0x1      | BisCore:Subject         | 0xe     | BisCore:LinkPartition       | 0xe          | BisCore:LinkPartition       |
| 0x1      | BisCore:Subject         | 0xe     | BisCore:LinkPartition       | 0x10         | BisCore:DefinitionPartition |
| 0x1      | BisCore:Subject         | 0xe     | BisCore:LinkPartition       | 0x11         | BisCore:PhysicalPartition   |
| 0x1      | BisCore:Subject         | 0x10    | BisCore:DefinitionPartition | 0xe          | BisCore:LinkPartition       |
| 0x1      | BisCore:Subject         | 0x10    | BisCore:DefinitionPartition | 0x10         | BisCore:DefinitionPartition |
| 0x1      | BisCore:Subject         | 0x10    | BisCore:DefinitionPartition | 0x11         | BisCore:PhysicalPartition   |
| 0x1      | BisCore:Subject         | 0x11    | BisCore:PhysicalPartition   | 0xe          | BisCore:LinkPartition       |
| 0x1      | BisCore:Subject         | 0x11    | BisCore:PhysicalPartition   | 0x10         | BisCore:DefinitionPartition |
| 0x1      | BisCore:Subject         | 0x11    | BisCore:PhysicalPartition   | 0x11         | BisCore:PhysicalPartition   |
| 0x12     | BisCore:SpatialCategory | 0x13    | BisCore:SubCategory         | 0x13         | BisCore:SubCategory         |

# Double Join with Where

- dataset: AllProperties.bim

```sql
SELECT
  Parent.ECInstanceId AS ParentId,
  Child.ECInstanceId AS ChildId,
  GrandChild.ECInstanceId AS GrandChildId
FROM
  [BisCore].[Element] Parent
  JOIN [BisCore].[Element] Child USING [BisCore].[ElementOwnsChildElements] re1 FORWARD
  JOIN [BisCore].[Element] GrandChild USING [BisCore].[ElementOwnsChildElements] re2 FORWARD
WHERE
  Parent.ECInstanceId <> GrandChild.ECInstanceId
ORDER BY Parent.ECInstanceId, Child.ECInstanceId, GrandChild.ECInstanceId
```

| className | accessString | generated | index | jsonName     | name         | extendedType | typeName | type | originPropertyName |
| --------- | ------------ | --------- | ----- | ------------ | ------------ | ------------ | -------- | ---- | ------------------ |
|           | ParentId     | true      | 0     | parentId     | ParentId     | Id           | long     | Id   | ECInstanceId       |
|           | ChildId      | true      | 1     | childId      | ChildId      | Id           | long     | Id   | ECInstanceId       |
|           | GrandChildId | true      | 2     | grandChildId | GrandChildId | Id           | long     | Id   | ECInstanceId       |

| ParentId | ChildId | GrandChildId |
| -------- | ------- | ------------ |
| 0x1      | 0xe     | 0xe          |
| 0x1      | 0xe     | 0x10         |
| 0x1      | 0xe     | 0x11         |
| 0x1      | 0x10    | 0xe          |
| 0x1      | 0x10    | 0x10         |
| 0x1      | 0x10    | 0x11         |
| 0x1      | 0x11    | 0xe          |
| 0x1      | 0x11    | 0x10         |
| 0x1      | 0x11    | 0x11         |
| 0x12     | 0x13    | 0x13         |

# JOIN in subquery

- dataset: AllProperties.bim

```sql
SELECT
  t1.ECInstanceId AS ParentId,
  SubQuery.ChildId
FROM
  [BisCore].[Element] t1
  JOIN (
    SELECT
      TargetECInstanceId AS ChildId
    FROM
      [BisCore].[ElementOwnsChildElements]
  ) SubQuery ON t1.ECInstanceId = SubQuery.ChildId
ORDER BY t1.ECInstanceId, SubQuery.ChildId;
```

| className | accessString | generated | index | jsonName | name     | extendedType | typeName | type | originPropertyName |
| --------- | ------------ | --------- | ----- | -------- | -------- | ------------ | -------- | ---- | ------------------ |
|           | ParentId     | true      | 0     | parentId | ParentId | Id           | long     | Id   | ECInstanceId       |
|           | ChildId      | true      | 1     | childId  | ChildId  | TargetId     | long     | Id   | undefined          |

| ParentId | ChildId |
| -------- | ------- |
| 0xe      | 0xe     |
| 0x10     | 0x10    |
| 0x11     | 0x11    |
| 0x13     | 0x13    |

# JOIN on Empty Table

- dataset: AllProperties.bim

```sql
SELECT
  te.ECInstanceId,
  te.i
FROM
  aps.TestElement te
  LEFT JOIN aps.testElementRefersToElements ter ON te.i = ter.i
```

| className                | accessString | generated | index | jsonName | name         | extendedType | typeName | type | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | -------- | ------------ | ------------ | -------- | ---- | ------------------ |
|                          | ECInstanceId | false     | 0     | id       | ECInstanceId | Id           | long     | Id   | ECInstanceId       |
| AllProperties:IPrimitive | i            | false     | 1     | i        | i            | undefined    | int      | Int  | i                  |

| ECInstanceId | i   |
| ------------ | --- |
| 0x14         | 100 |
| 0x15         | 101 |
| 0x16         | 102 |
| 0x17         | 103 |
| 0x18         | 104 |
| 0x19         | 105 |
| 0x1a         | 106 |
| 0x1b         | 107 |
| 0x1c         | 108 |
| 0x1d         | 109 |

# Nested JOIN in Select

- dataset: AllProperties.bim

```sql
SELECT
  nested_join.te_ECInstanceId,
  nested_join.te_i,
  nested_join.VersionMajor
FROM
  (
    SELECT
      te.ECInstanceId AS te_ECInstanceId,
      te.i AS te_i,
      d.VersionMajor
    FROM
      aps.TestElement te
      INNER JOIN aps.IPrimitive p ON te.ECInstanceId = p.ECInstanceId
      LEFT JOIN meta.ECSchemaDef d ON d.VersionMajor + 100 = te.i
  ) AS nested_join
LIMIT
  5;
```

| className            | accessString    | generated | index | jsonName        | name            | extendedType | typeName | type | originPropertyName |
| -------------------- | --------------- | --------- | ----- | --------------- | --------------- | ------------ | -------- | ---- | ------------------ |
|                      | te_ECInstanceId | true      | 0     | te_ECInstanceId | te_ECInstanceId | Id           | long     | Id   | undefined          |
|                      | te_i            | true      | 1     | te_i            | te_i            | undefined    | int      | Int  | undefined          |
| ECDbMeta:ECSchemaDef | VersionMajor    | false     | 2     | versionMajor    | VersionMajor    | undefined    | int      | Int  | VersionMajor       |

| te_ECInstanceId | te_i | VersionMajor |
| --------------- | ---- | ------------ |
| 0x14            | 100  | undefined    |
| 0x15            | 101  | 1            |
| 0x15            | 101  | 1            |
| 0x15            | 101  | 1            |
| 0x15            | 101  | 1            |

# Mixed JOIN types in one query

- dataset: AllProperties.bim

```sql
SELECT
  te.ECInstanceId,
  te.i,
  d.VersionMajor,
  eoc.SourceECInstanceId AS sourceECid
FROM
  aps.TestElement te
  INNER JOIN aps.IPrimitive p ON te.ECInstanceId = p.ECInstanceId
  LEFT JOIN meta.ECSchemaDef d ON d.VersionMajor + 100 = te.i
  CROSS JOIN BisCore.ElementOwnsChildElements eoc
LIMIT
  6;
```

| className                | accessString | generated | index | jsonName     | name         | extendedType | typeName | type | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | ------------ | ------------ | ------------ | -------- | ---- | ------------------ |
|                          | ECInstanceId | false     | 0     | id           | ECInstanceId | Id           | long     | Id   | ECInstanceId       |
| AllProperties:IPrimitive | i            | false     | 1     | i            | i            | undefined    | int      | Int  | i                  |
| ECDbMeta:ECSchemaDef     | VersionMajor | false     | 2     | versionMajor | VersionMajor | undefined    | int      | Int  | VersionMajor       |
|                          | sourceECid   | true      | 3     | sourceECid   | sourceECid   | SourceId     | long     | Id   | SourceECInstanceId |

| ECInstanceId | i   | sourceECid | VersionMajor |
| ------------ | --- | ---------- | ------------ |
| 0x14         | 100 | 0x12       | undefined    |
| 0x14         | 100 | 0x1        | undefined    |
| 0x14         | 100 | 0x1        | undefined    |
| 0x14         | 100 | 0x1        | undefined    |
| 0x15         | 101 | 0x12       | 1            |
| 0x15         | 101 | 0x1        | 1            |

# Named Properties Join

- dataset: AllProperties.bim
- errorDuringPrepare: true

```sql
SELECT 1 FROM bis.Element e JOIN bis.SpatialElement s USING (ECInstanceId);
```
