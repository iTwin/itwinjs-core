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
