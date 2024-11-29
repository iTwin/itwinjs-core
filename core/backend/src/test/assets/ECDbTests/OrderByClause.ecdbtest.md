Copyright © Bentley Systems, Incorporated. All rights reserved. See [LICENSE.md](../../../../LICENSE.md) for license terms and full copyright notice.

# OrderByExp basic test

- dataset: AllProperties.bim

```sql
SELECT ECInstanceId, NullProp FROM aps.TestElement ORDER BY NullProp
```

| className                 | accessString | generated | index | jsonName | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | -------- | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id       | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
| AllProperties:TestElement | NullProp     | false     | 1     | nullProp | NullProp     | undefined    | string   | String | NullProp           |

| ECInstanceId | NullProp  |
| ------------ | --------- |
| 0x14         | undefined |
| 0x16         | undefined |
| 0x18         | undefined |
| 0x1a         | undefined |
| 0x1c         | undefined |
| 0x15         | NotNull   |
| 0x17         | NotNull   |
| 0x19         | NotNull   |
| 0x1b         | NotNull   |
| 0x1d         | NotNull   |

# OrderByExp basic test desc

- dataset: AllProperties.bim

```sql
SELECT ECInstanceId, NullProp FROM aps.TestElement ORDER BY NullProp desc
```

| className                 | accessString | generated | index | jsonName | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | -------- | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id       | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
| AllProperties:TestElement | NullProp     | false     | 1     | nullProp | NullProp     | undefined    | string   | String | NullProp           |

| ECInstanceId | NullProp  |
| ------------ | --------- |
| 0x15         | NotNull   |
| 0x17         | NotNull   |
| 0x19         | NotNull   |
| 0x1b         | NotNull   |
| 0x1d         | NotNull   |
| 0x14         | undefined |
| 0x16         | undefined |
| 0x18         | undefined |
| 0x1a         | undefined |
| 0x1c         | undefined |

# OrderByExp with multiple columns

- dataset: AllProperties.bim

```sql
SELECT ECInstanceId, NullProp, bin FROM aps.TestElement ORDER BY NullProp, bin
```

| className                 | accessString | generated | index | jsonName | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | -------- | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id       | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
| AllProperties:TestElement | NullProp     | false     | 1     | nullProp | NullProp     | undefined    | string   | String | NullProp           |
| AllProperties:IPrimitive  | bin          | false     | 2     | bin      | bin          | Json         | string   | Blob   | bin                |

| ECInstanceId | bin                                | NullProp  |
| ------------ | ---------------------------------- | --------- |
| 0x14         | BIN(1,2,3)                         | undefined |
| 0x16         | BIN(1,2,3)                         | undefined |
| 0x18         | BIN(1,2,3)                         | undefined |
| 0x1a         | BIN(1,2,3)                         | undefined |
| 0x1c         | BIN(1,2,3)                         | undefined |
| 0x15         | BIN(11,21,31,34,53,21,14,14,55,22) | NotNull   |
| 0x17         | BIN(11,21,31,34,53,21,14,14,55,22) | NotNull   |
| 0x19         | BIN(11,21,31,34,53,21,14,14,55,22) | NotNull   |
| 0x1b         | BIN(11,21,31,34,53,21,14,14,55,22) | NotNull   |
| 0x1d         | BIN(11,21,31,34,53,21,14,14,55,22) | NotNull   |

# OrderByExp with multiple columns with different sorting order combo 1

- dataset: AllProperties.bim

```sql
SELECT ECInstanceId, NullProp, bin FROM aps.TestElement ORDER BY NullProp desc, bin
```

| className                 | accessString | generated | index | jsonName | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | -------- | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id       | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
| AllProperties:TestElement | NullProp     | false     | 1     | nullProp | NullProp     | undefined    | string   | String | NullProp           |
| AllProperties:IPrimitive  | bin          | false     | 2     | bin      | bin          | Json         | string   | Blob   | bin                |

| ECInstanceId | NullProp  | bin                                |
| ------------ | --------- | ---------------------------------- |
| 0x15         | NotNull   | BIN(11,21,31,34,53,21,14,14,55,22) |
| 0x17         | NotNull   | BIN(11,21,31,34,53,21,14,14,55,22) |
| 0x19         | NotNull   | BIN(11,21,31,34,53,21,14,14,55,22) |
| 0x1b         | NotNull   | BIN(11,21,31,34,53,21,14,14,55,22) |
| 0x1d         | NotNull   | BIN(11,21,31,34,53,21,14,14,55,22) |
| 0x14         | undefined | BIN(1,2,3)                         |
| 0x16         | undefined | BIN(1,2,3)                         |
| 0x18         | undefined | BIN(1,2,3)                         |
| 0x1a         | undefined | BIN(1,2,3)                         |
| 0x1c         | undefined | BIN(1,2,3)                         |

# OrderByExp with multiple columns with different sorting order combo 2

- dataset: AllProperties.bim

```sql
SELECT ECInstanceId, NullProp, bin FROM aps.TestElement ORDER BY NullProp, bin desc
```

| className                 | accessString | generated | index | jsonName | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | -------- | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id       | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
| AllProperties:TestElement | NullProp     | false     | 1     | nullProp | NullProp     | undefined    | string   | String | NullProp           |
| AllProperties:IPrimitive  | bin          | false     | 2     | bin      | bin          | Json         | string   | Blob   | bin                |

| ECInstanceId | bin                                | NullProp  |
| ------------ | ---------------------------------- | --------- |
| 0x14         | BIN(1,2,3)                         | undefined |
| 0x16         | BIN(1,2,3)                         | undefined |
| 0x18         | BIN(1,2,3)                         | undefined |
| 0x1a         | BIN(1,2,3)                         | undefined |
| 0x1c         | BIN(1,2,3)                         | undefined |
| 0x15         | BIN(11,21,31,34,53,21,14,14,55,22) | NotNull   |
| 0x17         | BIN(11,21,31,34,53,21,14,14,55,22) | NotNull   |
| 0x19         | BIN(11,21,31,34,53,21,14,14,55,22) | NotNull   |
| 0x1b         | BIN(11,21,31,34,53,21,14,14,55,22) | NotNull   |
| 0x1d         | BIN(11,21,31,34,53,21,14,14,55,22) | NotNull   |

# OrderByExp with aggreagate functions first

- dataset: AllProperties.bim

```sql
SELECT ECInstanceId, NullProp, bin FROM aps.TestElement GROUP BY NullProp ORDER BY MAX(DirectLong)
```

| className                 | accessString | generated | index | jsonName | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | -------- | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id       | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
| AllProperties:TestElement | NullProp     | false     | 1     | nullProp | NullProp     | undefined    | string   | String | NullProp           |
| AllProperties:IPrimitive  | bin          | false     | 2     | bin      | bin          | Json         | string   | Blob   | bin                |

| ECInstanceId | bin                                | NullProp  |
| ------------ | ---------------------------------- | --------- |
| 0x1c         | BIN(1,2,3)                         | undefined |
| 0x1d         | BIN(11,21,31,34,53,21,14,14,55,22) | NotNull   |

# OrderByExp with aggreagate functions second

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  NullProp,
  bin
FROM
  aps.TestElement
GROUP BY
  NullProp
ORDER BY
  MAX(DirectLong) DESC
```

| className                 | accessString | generated | index | jsonName | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | -------- | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id       | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
| AllProperties:TestElement | NullProp     | false     | 1     | nullProp | NullProp     | undefined    | string   | String | NullProp           |
| AllProperties:IPrimitive  | bin          | false     | 2     | bin      | bin          | Json         | string   | Blob   | bin                |

| ECInstanceId | NullProp  | bin                                |
| ------------ | --------- | ---------------------------------- |
| 0x1d         | NotNull   | BIN(11,21,31,34,53,21,14,14,55,22) |
| 0x1c         | undefined | BIN(1,2,3)                         |

# OrderByExp with Length function

- dataset: AllProperties.bim

```sql
SELECT DirectStr, NullProp, bin FROM aps.TestElement ORDER BY LENGTH(bin)
```

| className                 | accessString | generated | index | jsonName  | name      | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | --------- | --------- | ------------ | -------- | ------ | ------------------ |
| AllProperties:TestElement | DirectStr    | false     | 0     | directStr | DirectStr | undefined    | string   | String | DirectStr          |
| AllProperties:TestElement | NullProp     | false     | 1     | nullProp  | NullProp  | undefined    | string   | String | NullProp           |
| AllProperties:IPrimitive  | bin          | false     | 2     | bin       | bin       | Json         | string   | Blob   | bin                |

| DirectStr | bin                                | NullProp  |
| --------- | ---------------------------------- | --------- |
| str0      | BIN(1,2,3)                         | undefined |
| str2      | BIN(1,2,3)                         | undefined |
| str4      | BIN(1,2,3)                         | undefined |
| str6      | BIN(1,2,3)                         | undefined |
| str8      | BIN(1,2,3)                         | undefined |
| str1      | BIN(11,21,31,34,53,21,14,14,55,22) | NotNull   |
| str3      | BIN(11,21,31,34,53,21,14,14,55,22) | NotNull   |
| str5      | BIN(11,21,31,34,53,21,14,14,55,22) | NotNull   |
| str7      | BIN(11,21,31,34,53,21,14,14,55,22) | NotNull   |
| str9      | BIN(11,21,31,34,53,21,14,14,55,22) | NotNull   |

# OrderByExp with Case first

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  DirectLong,
  DirectDouble,
  NullProp,
  bin
FROM
  aps.TestElement
ORDER BY
  CASE
    WHEN DirectDouble > 5.1 THEN DirectLong
    ELSE NullProp
  END
```

| className                 | accessString | generated | index | jsonName     | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ------------ | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id           | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
| AllProperties:TestElement | DirectLong   | false     | 1     | directLong   | DirectLong   | undefined    | long     | Int64  | DirectLong         |
| AllProperties:TestElement | DirectDouble | false     | 2     | directDouble | DirectDouble | undefined    | double   | Double | DirectDouble       |
| AllProperties:TestElement | NullProp     | false     | 3     | nullProp     | NullProp     | undefined    | string   | String | NullProp           |
| AllProperties:IPrimitive  | bin          | false     | 4     | bin          | bin          | Json         | string   | Blob   | bin                |

| ECInstanceId | DirectLong | DirectDouble | bin                                | NullProp  |
| ------------ | ---------- | ------------ | ---------------------------------- | --------- |
| 0x14         | 1000       | 0.1          | BIN(1,2,3)                         | undefined |
| 0x16         | 1002       | 2.1          | BIN(1,2,3)                         | undefined |
| 0x18         | 1004       | 4.1          | BIN(1,2,3)                         | undefined |
| 0x1a         | 1006       | 6.1          | BIN(1,2,3)                         | undefined |
| 0x1b         | 1007       | 7.1          | BIN(11,21,31,34,53,21,14,14,55,22) | NotNull   |
| 0x1c         | 1008       | 8.1          | BIN(1,2,3)                         | undefined |
| 0x1d         | 1009       | 9.1          | BIN(11,21,31,34,53,21,14,14,55,22) | NotNull   |
| 0x15         | 1001       | 1.1          | BIN(11,21,31,34,53,21,14,14,55,22) | NotNull   |
| 0x17         | 1003       | 3.1          | BIN(11,21,31,34,53,21,14,14,55,22) | NotNull   |
| 0x19         | 1005       | 5.1          | BIN(11,21,31,34,53,21,14,14,55,22) | NotNull   |

# OrderByExp with Case second

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  DirectLong,
  DirectDouble,
  NullProp,
  bin
FROM
  aps.TestElement
ORDER BY
  CASE
    WHEN DirectDouble > 5.1 THEN NullProp
    ELSE DirectLong
  END
```

| className                 | accessString | generated | index | jsonName     | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ------------ | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id           | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
| AllProperties:TestElement | DirectLong   | false     | 1     | directLong   | DirectLong   | undefined    | long     | Int64  | DirectLong         |
| AllProperties:TestElement | DirectDouble | false     | 2     | directDouble | DirectDouble | undefined    | double   | Double | DirectDouble       |
| AllProperties:TestElement | NullProp     | false     | 3     | nullProp     | NullProp     | undefined    | string   | String | NullProp           |
| AllProperties:IPrimitive  | bin          | false     | 4     | bin          | bin          | Json         | string   | Blob   | bin                |

| ECInstanceId | DirectLong | DirectDouble | bin                                | NullProp  |
| ------------ | ---------- | ------------ | ---------------------------------- | --------- |
| 0x1a         | 1006       | 6.1          | BIN(1,2,3)                         | undefined |
| 0x1c         | 1008       | 8.1          | BIN(1,2,3)                         | undefined |
| 0x14         | 1000       | 0.1          | BIN(1,2,3)                         | undefined |
| 0x15         | 1001       | 1.1          | BIN(11,21,31,34,53,21,14,14,55,22) | NotNull   |
| 0x16         | 1002       | 2.1          | BIN(1,2,3)                         | undefined |
| 0x17         | 1003       | 3.1          | BIN(11,21,31,34,53,21,14,14,55,22) | NotNull   |
| 0x18         | 1004       | 4.1          | BIN(1,2,3)                         | undefined |
| 0x19         | 1005       | 5.1          | BIN(11,21,31,34,53,21,14,14,55,22) | NotNull   |
| 0x1b         | 1007       | 7.1          | BIN(11,21,31,34,53,21,14,14,55,22) | NotNull   |
| 0x1d         | 1009       | 9.1          | BIN(11,21,31,34,53,21,14,14,55,22) | NotNull   |

# OrderByExp with Nulls First

- dataset: AllProperties.bim

```sql
SELECT ECInstanceId, NullProp FROM aps.TestElement ORDER BY NullProp NULLS FIRST
```

| className                 | accessString | generated | index | jsonName | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | -------- | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id       | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
| AllProperties:TestElement | NullProp     | false     | 1     | nullProp | NullProp     | undefined    | string   | String | NullProp           |

| ECInstanceId | NullProp  |
| ------------ | --------- |
| 0x14         | undefined |
| 0x16         | undefined |
| 0x18         | undefined |
| 0x1a         | undefined |
| 0x1c         | undefined |
| 0x15         | NotNull   |
| 0x17         | NotNull   |
| 0x19         | NotNull   |
| 0x1b         | NotNull   |
| 0x1d         | NotNull   |

# OrderByExp with Nulls Last

- dataset: AllProperties.bim

```sql
SELECT ECInstanceId, NullProp FROM aps.TestElement ORDER BY NullProp NULLS LAST
```

| className                 | accessString | generated | index | jsonName | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | -------- | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id       | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
| AllProperties:TestElement | NullProp     | false     | 1     | nullProp | NullProp     | undefined    | string   | String | NullProp           |

| ECInstanceId | NullProp  |
| ------------ | --------- |
| 0x15         | NotNull   |
| 0x17         | NotNull   |
| 0x19         | NotNull   |
| 0x1b         | NotNull   |
| 0x1d         | NotNull   |
| 0x14         | undefined |
| 0x16         | undefined |
| 0x18         | undefined |
| 0x1a         | undefined |
| 0x1c         | undefined |

# OrderByExp with subquery in From Clause

- dataset: AllProperties.bim

```sql
SELECT
  sub.Id,
  sub.null_check
FROM
  (
    SELECT
      ECInstanceId AS Id,
      NullProp AS null_check
    FROM
      aps.TestElement
  ) sub
ORDER BY
  sub.null_check
```

| className | accessString | generated | index | jsonName   | name       | extendedType | typeName | type   |
| --------- | ------------ | --------- | ----- | ---------- | ---------- | ------------ | -------- | ------ |
|           | Id           | true      | 0     | id         | Id         | Id           | long     | Id     |
|           | null_check   | true      | 1     | null_check | null_check | undefined    | string   | String |

| Id   | null_check |
| ---- | ---------- |
| 0x14 | undefined  |
| 0x16 | undefined  |
| 0x18 | undefined  |
| 0x1a | undefined  |
| 0x1c | undefined  |
| 0x15 | NotNull    |
| 0x17 | NotNull    |
| 0x19 | NotNull    |
| 0x1b | NotNull    |
| 0x1d | NotNull    |

# OrderByExp with Coalesce

- dataset: AllProperties.bim

```sql
SELECT
  DirectStr,
  NullProp,
  COALESCE(NullProp, DirectStr) AS coalesced_col
FROM
  aps.TestElement
ORDER BY
  COALESCE(NullProp, DirectStr)
```

| className                 | accessString  | generated | index | jsonName      | name          | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------- | --------- | ----- | ------------- | ------------- | ------------ | -------- | ------ | ------------------ |
| AllProperties:TestElement | DirectStr     | false     | 0     | directStr     | DirectStr     | undefined    | string   | String | DirectStr          |
| AllProperties:TestElement | NullProp      | false     | 1     | nullProp      | NullProp      | undefined    | string   | String | NullProp           |
|                           | coalesced_col | true      | 2     | coalesced_col | coalesced_col | undefined    | string   | String | undefined          |

| DirectStr | NullProp  | coalesced_col |
| --------- | --------- | ------------- |
| str1      | NotNull   | NotNull       |
| str3      | NotNull   | NotNull       |
| str5      | NotNull   | NotNull       |
| str7      | NotNull   | NotNull       |
| str9      | NotNull   | NotNull       |
| str0      | undefined | str0          |
| str2      | undefined | str2          |
| str4      | undefined | str4          |
| str6      | undefined | str6          |
| str8      | undefined | str8          |

# OrderByExp with Join

- dataset: AllProperties.bim

```sql
SELECT
  e.ECInstanceId AS ElementId,
  c.ECInstanceId AS ClassId,
  c.Name,
  e.NullProp
FROM
  aps.TestElement e
  JOIN meta.ECClassDef c ON e.ECClassId = c.ECInstanceId
ORDER BY
  e.NullProp DESC
```

| className                 | accessString | generated | index | jsonName  | name      | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | --------- | --------- | ------------ | -------- | ------ | ------------------ |
|                           | ElementId    | true      | 0     | elementId | ElementId | Id           | long     | Id     | ECInstanceId       |
|                           | ClassId      | true      | 1     | classId   | ClassId   | Id           | long     | Id     | ECInstanceId       |
| ECDbMeta:ECClassDef       | Name         | false     | 2     | name      | Name      | undefined    | string   | String | Name               |
| AllProperties:TestElement | NullProp     | false     | 3     | nullProp  | NullProp  | undefined    | string   | String | NullProp           |

| ElementId | ClassId | Name        | NullProp  |
| --------- | ------- | ----------- | --------- |
| 0x15      | 0x152   | TestElement | NotNull   |
| 0x17      | 0x152   | TestElement | NotNull   |
| 0x19      | 0x152   | TestElement | NotNull   |
| 0x1b      | 0x152   | TestElement | NotNull   |
| 0x1d      | 0x152   | TestElement | NotNull   |
| 0x14      | 0x152   | TestElement | undefined |
| 0x16      | 0x152   | TestElement | undefined |
| 0x18      | 0x152   | TestElement | undefined |
| 0x1a      | 0x152   | TestElement | undefined |
| 0x1c      | 0x152   | TestElement | undefined |
