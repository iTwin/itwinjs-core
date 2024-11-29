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

# JOIN USING Relationship - FORWARD

- dataset: AllProperties.bim

```sql
SELECT
  t0.ECInstanceId AS ParentId,
  t0.ECClassId AS ParentClassId,
  t1.ECInstanceId AS ChildId,
  t1.ECClassId AS ChildClassId
FROM
  [BisCore].[Element] t0
  JOIN [BisCore].[Element] t1 USING [BisCore].[ElementOwnsChildElements] FORWARD;
```

| className | accessString  | generated | index | jsonName      | name          | extendedType | typeName | type | originPropertyName |
| --------- | ------------- | --------- | ----- | ------------- | ------------- | ------------ | -------- | ---- | ------------------ |
|           | ParentId      | true      | 0     | parentId      | ParentId      | Id           | long     | Id   | ECInstanceId       |
|           | ParentClassId | true      | 1     | parentClassId | ParentClassId | ClassId      | long     | Id   | ECClassId          |
|           | ChildId       | true      | 2     | childId       | ChildId       | Id           | long     | Id   | ECInstanceId       |
|           | ChildClassId  | true      | 3     | childClassId  | ChildClassId  | ClassId      | long     | Id   | ECClassId          |

| ParentId | ParentClassId | ChildId | ChildClassId |
| -------- | ------------- | ------- | ------------ |
| 0x12     | 0xc5          | 0x13    | 0x89         |
| 0x1      | 0x126         | 0xe     | 0xdd         |
| 0x1      | 0x126         | 0x10    | 0x98         |
| 0x1      | 0x126         | 0x11    | 0xf0         |

# JOIN USING Relationship - BACKWARD

- dataset: AllProperties.bim

```sql
SELECT
  t0.ECInstanceId AS ParentId,
  t0.ECClassId AS ParentClassId,
  t1.ECInstanceId AS ChildId,
  t1.ECClassId AS ChildClassId
FROM
  [BisCore].[Element] t0
  JOIN [BisCore].[Element] t1 USING [BisCore].[ElementOwnsChildElements] BACKWARD;
```

| className | accessString  | generated | index | jsonName      | name          | extendedType | typeName | type | originPropertyName |
| --------- | ------------- | --------- | ----- | ------------- | ------------- | ------------ | -------- | ---- | ------------------ |
|           | ParentId      | true      | 0     | parentId      | ParentId      | Id           | long     | Id   | ECInstanceId       |
|           | ParentClassId | true      | 1     | parentClassId | ParentClassId | ClassId      | long     | Id   | ECClassId          |
|           | ChildId       | true      | 2     | childId       | ChildId       | Id           | long     | Id   | ECInstanceId       |
|           | ChildClassId  | true      | 3     | childClassId  | ChildClassId  | ClassId      | long     | Id   | ECClassId          |

| ParentId | ParentClassId | ChildId | ChildClassId |
| -------- | ------------- | ------- | ------------ |
| 0x13     | 0x89          | 0x12    | 0xc5         |
| 0xe      | 0xdd          | 0x1     | 0x126        |
| 0x10     | 0x98          | 0x1     | 0x126        |
| 0x11     | 0xf0          | 0x1     | 0x126        |

# Double JOIN ON

- dataset: AllProperties.bim

```sql
SELECT
  t0.ECInstanceId AS ParentId,
  t0.ECClassId AS ParentClassId,
  t1.ECInstanceId AS ChildId,
  t1.ECClassId AS ChildClassId,
  rel.SourceECInstanceId,
  rel.SourceECClassId,
  rel.TargetECInstanceId,
  rel.TargetECClassId
FROM
  [BisCore].[Element] t0
  JOIN [BisCore].[ElementOwnsChildElements] rel ON t0.ECInstanceId = rel.TargetECInstanceId
  JOIN [BisCore].[Element] t1 ON t1.ECInstanceId = rel.SourceECInstanceId;
```

| className | accessString       | generated | index | jsonName        | name               | extendedType  | typeName | type | originPropertyName |
| --------- | ------------------ | --------- | ----- | --------------- | ------------------ | ------------- | -------- | ---- | ------------------ |
|           | ParentId           | true      | 0     | parentId        | ParentId           | Id            | long     | Id   | ECInstanceId       |
|           | ParentClassId      | true      | 1     | parentClassId   | ParentClassId      | ClassId       | long     | Id   | ECClassId          |
|           | ChildId            | true      | 2     | childId         | ChildId            | Id            | long     | Id   | ECInstanceId       |
|           | ChildClassId       | true      | 3     | childClassId    | ChildClassId       | ClassId       | long     | Id   | ECClassId          |
|           | SourceECInstanceId | false     | 4     | sourceId        | SourceECInstanceId | SourceId      | long     | Id   | SourceECInstanceId |
|           | SourceECClassId    | false     | 5     | sourceClassName | SourceECClassId    | SourceClassId | long     | Id   | SourceECClassId    |
|           | TargetECInstanceId | false     | 6     | targetId        | TargetECInstanceId | TargetId      | long     | Id   | TargetECInstanceId |
|           | TargetECClassId    | false     | 7     | targetClassName | TargetECClassId    | TargetClassId | long     | Id   | TargetECClassId    |

| ParentId | ParentClassId | ChildId | ChildClassId | SourceECInstanceId | SourceECClassId | TargetECInstanceId | TargetECClassId |
| -------- | ------------- | ------- | ------------ | ------------------ | --------------- | ------------------ | --------------- |
| 0x13     | 0x89          | 0x12    | 0xc5         | 0x12               | 0xc5            | 0x13               | 0x89            |
| 0xe      | 0xdd          | 0x1     | 0x126        | 0x1                | 0x126           | 0xe                | 0xdd            |
| 0x10     | 0x98          | 0x1     | 0x126        | 0x1                | 0x126           | 0x10               | 0x98            |
| 0x11     | 0xf0          | 0x1     | 0x126        | 0x1                | 0x126           | 0x11               | 0xf0            |


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
- skip: NATURAL JOIN is not yet supported

```sql
SELECT *
FROM (SELECT ECInstanceId AS CommonId, FederationGuid FROM bis.Element) AS ElementAlias
NATURAL JOIN (SELECT ECInstanceId AS CommonId, IsPrivate FROM bis.Model) AS ModelAlias;
```