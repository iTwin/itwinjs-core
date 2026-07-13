Copyright © Bentley Systems, Incorporated. All rights reserved. See [LICENSE.md](../../../../LICENSE.md) for license terms and full copyright notice.

# Simple select for all types of derived properties

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  dt,
  b,
  bin,
  DirectStr,
  DirectLong,
  DirectDouble,
  p2d,
  p3d
FROM
  aps.TestElement
LIMIT
  5
```

| className                 | accessString | generated | index | jsonName     | name         | extendedType | typeName | type     | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ------------ | ------------ | ------------ | -------- | -------- | ------------------ |
|                           | ECInstanceId | false     | 0     | id           | ECInstanceId | Id           | long     | Id       | ECInstanceId       |
| AllProperties:IPrimitive  | dt           | false     | 1     | dt           | dt           | undefined    | dateTime | DateTime | dt                 |
| AllProperties:IPrimitive  | b            | false     | 2     | b            | b            | undefined    | boolean  | Boolean  | b                  |
| AllProperties:IPrimitive  | bin          | false     | 3     | bin          | bin          | undefined    | binary   | Blob     | bin                |
| AllProperties:TestElement | DirectStr    | false     | 4     | directStr    | DirectStr    | undefined    | string   | String   | DirectStr          |
| AllProperties:TestElement | DirectLong   | false     | 5     | directLong   | DirectLong   | undefined    | long     | Int64    | DirectLong         |
| AllProperties:TestElement | DirectDouble | false     | 6     | directDouble | DirectDouble | undefined    | double   | Double   | DirectDouble       |
| AllProperties:IPrimitive  | p2d          | false     | 7     | p2d          | p2d          | undefined    | point2d  | Point2d  | p2d                |
| AllProperties:IPrimitive  | p3d          | false     | 8     | p3d          | p3d          | undefined    | point3d  | Point3d  | p3d                |

| ECInstanceId | dt                      | b    | bin                           | DirectStr | DirectLong | DirectDouble | p2d             | p3d             |
| ------------ | ----------------------- | ---- | ----------------------------- | --------- | ---------- | ------------ | --------------- | --------------- |
| 0x14         | 2017-01-01T00:00:00.000 | true | BIN(1,2,3)                         | str0      | 1000       | 0.1          | {"X": 1.034,"Y": 2.034}     | {"X": -1,"Y": 2.3,"Z": 3.0001}           |
| 0x15         | 2010-01-01T11:11:11.000 | true | BIN(11,21,31,34,53,21,14,14,55,22) | str1      | 1001       | 1.1          | {"X": 1111.11,"Y": 2222.22} | {"X": -111.11,"Y": -222.22,"Z": -333.33} |
| 0x16         | 2017-01-01T00:00:00.000 | true | BIN(1,2,3)                         | str2      | 1002       | 2.1          | {"X": 1.034,"Y": 2.034}     | {"X": -1,"Y": 2.3,"Z": 3.0001}           |
| 0x17         | 2010-01-01T11:11:11.000 | true | BIN(11,21,31,34,53,21,14,14,55,22) | str3      | 1003       | 3.1          | {"X": 1111.11,"Y": 2222.22} | {"X": -111.11,"Y": -222.22,"Z": -333.33} |
| 0x18         | 2017-01-01T00:00:00.000 | true | BIN(1,2,3)                         | str4      | 1004       | 4.1          | {"X": 1.034,"Y": 2.034}     | {"X": -1,"Y": 2.3,"Z": 3.0001}           |

# Using a computation of two columns

- dataset: AllProperties.bim

```sql
SELECT ECInstanceId, DirectLong + DirectDouble as Computed_Value from aps.TestElement
```

| className | accessString                  | generated | index | jsonName                      | name                          | extendedType | typeName | type   | originPropertyName |
| --------- | ----------------------------- | --------- | ----- | ----------------------------- | ----------------------------- | ------------ | -------- | ------ | ------------------ |
|           | ECInstanceId                  | false     | 0     | id                            | ECInstanceId                  | Id           | long     | Id     | ECInstanceId       |
|           | Computed_Value                | true      | 1     | computed_Value                | Computed_Value                | undefined    | double   | Double | undefined          |

| ECInstanceId | Computed_Value |
| ------------ | ----------------------------- |
| 0x14         | 1000.1                        |
| 0x15         | 1002.1                        |
| 0x16         | 1004.1                        |
| 0x17         | 1006.1                        |
| 0x18         | 1008.1                        |
| 0x19         | 1010.1                        |
| 0x1a         | 1012.1                        |
| 0x1b         | 1014.1                        |
| 0x1c         | 1016.1                        |
| 0x1d         | 1018.1                        |

# Using a computation of three columns

- dataset: AllProperties.bim

```sql
SELECT ECInstanceId, i + d + DirectLong + DirectDouble - l as Computed_Column from aps.TestElement
```

| className | accessString    | generated | index | jsonName        | name            | extendedType | typeName | type   | originPropertyName |
| --------- | --------------- | --------- | ----- | --------------- | --------------- | ------------ | -------- | ------ | ------------------ |
|           | ECInstanceId    | false     | 0     | id              | ECInstanceId    | Id           | long     | Id     | ECInstanceId       |
|           | Computed_Column | true      | 1     | computed_Column | Computed_Column | undefined    | double   | Double | undefined          |

| ECInstanceId | Computed_Column    |
| ------------ | ------------------ |
| 0x14         | 100.19999999999982 |
| 0x15         | 103.19999999999982 |
| 0x16         | 106.19999999999982 |
| 0x17         | 109.19999999999982 |
| 0x18         | 112.19999999999982 |
| 0x19         | 115.19999999999982 |
| 0x1a         | 118.19999999999982 |
| 0x1b         | 121.19999999999982 |
| 0x1c         | 124.19999999999982 |
| 0x1d         | 127.19999999999982 |

# Using derived property in a subquery

- dataset: AllProperties.bim

```sql
SELECT
  subquery.Id,
  subquery.Computed_Val
FROM
  (
    SELECT
      ECInstanceId AS Id,
      (DirectLong + DirectDouble) AS Computed_Val
    FROM
      aps.TestElement
  ) subquery
```

| className | accessString | generated | index | jsonName     | name         | extendedType | typeName | type   |
| --------- | ------------ | --------- | ----- | ------------ | ------------ | ------------ | -------- | ------ |
|           | Id           | true      | 0     | id           | Id           | Id           | long     | Id     |
|           | Computed_Val | true      | 1     | computed_Val | Computed_Val | undefined    | double   | Double |

| Id   | Computed_Val |
| ---- | ------------ |
| 0x14 | 1000.1       |
| 0x15 | 1002.1       |
| 0x16 | 1004.1       |
| 0x17 | 1006.1       |
| 0x18 | 1008.1       |
| 0x19 | 1010.1       |
| 0x1a | 1012.1       |
| 0x1b | 1014.1       |
| 0x1c | 1016.1       |
| 0x1d | 1018.1       |

# Using UPPER and LOWER functions

- dataset: AllProperties.bim

```sql
SELECT
  UPPER(DirectStr) AS uppercase,
  LOWER(s) AS lowercase
FROM
  aps.TestElement
ORDER BY
  lowercase DESC
```

| className | accessString | generated | index | jsonName  | name      | extendedType | typeName | type   |
| --------- | ------------ | --------- | ----- | --------- | --------- | ------------ | -------- | ------ |
|           | uppercase    | true      | 0     | uppercase | uppercase | undefined    | string   | String |
|           | lowercase    | true      | 1     | lowercase | lowercase | undefined    | string   | String |

| uppercase | lowercase |
| --------- | --------- |
| STR9      | str9      |
| STR8      | str8      |
| STR7      | str7      |
| STR6      | str6      |
| STR5      | str5      |
| STR4      | str4      |
| STR3      | str3      |
| STR2      | str2      |
| STR1      | str1      |
| STR0      | str0      |

# Using Case

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  CASE
    WHEN DirectLong > (
      SELECT
        AVG(DirectLong)
      FROM
        aps.TestElement
    ) THEN 'Lower'
    ELSE 'Higher'
  END AS Column_Check
FROM
  aps.TestElement
```

| className | accessString | generated | index | jsonName     | name         | extendedType | typeName | type   | originPropertyName |
| --------- | ------------ | --------- | ----- | ------------ | ------------ | ------------ | -------- | ------ | ------------------ |
|           | ECInstanceId | false     | 0     | id           | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
|           | Column_Check | true      | 1     | column_Check | Column_Check | undefined    | string   | String | undefined          |

| ECInstanceId | Column_Check |
| ------------ | ------------ |
| 0x14         | Higher       |
| 0x15         | Higher       |
| 0x16         | Higher       |
| 0x17         | Higher       |
| 0x18         | Higher       |
| 0x19         | Lower        |
| 0x1a         | Lower        |
| 0x1b         | Lower        |
| 0x1c         | Lower        |
| 0x1d         | Lower        |

# With string functions

- dataset: AllProperties.bim

```sql
SELECT
  s || ' ' || DirectStr AS spaced_str,
  concat_ws (',', s, DirectStr) AS separated_str,
  ltrim(DirectStr, 'str') AS left_trimmed
FROM
  aps.TestElement
```

| className | accessString  | generated | index | jsonName      | name          | extendedType | typeName | type   |
| --------- | ------------- | --------- | ----- | ------------- | ------------- | ------------ | -------- | ------ |
|           | spaced_str    | true      | 0     | spaced_str    | spaced_str    | undefined    | string   | String |
|           | separated_str | true      | 1     | separated_str | separated_str | undefined    | string   | String |
|           | left_trimmed  | true      | 2     | left_trimmed  | left_trimmed  | undefined    | string   | String |

| spaced_str | separated_str | left_trimmed |
| ---------- | ------------- | ------------ |
| str0 str0  | str0,str0     | "0"          |
| str1 str1  | str1,str1     | "1"          |
| str2 str2  | str2,str2     | "2"          |
| str3 str3  | str3,str3     | "3"          |
| str4 str4  | str4,str4     | "4"          |
| str5 str5  | str5,str5     | "5"          |
| str6 str6  | str6,str6     | "6"          |
| str7 str7  | str7,str7     | "7"          |
| str8 str8  | str8,str8     | "8"          |
| str9 str9  | str9,str9     | "9"          |

# With Window function

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  Model.Id AS ModelId,
  ROW_NUMBER() OVER (
    PARTITION BY
      NullProp
  ) AS RowNum
FROM
  aps.TestElement
```

| className | accessString | generated | index | jsonName | name         | extendedType | typeName | type  | originPropertyName |
| --------- | ------------ | --------- | ----- | -------- | ------------ | ------------ | -------- | ----- | ------------------ |
|           | ECInstanceId | false     | 0     | id       | ECInstanceId | Id           | long     | Id    | ECInstanceId       |
|           | ModelId      | true      | 1     | modelId  | ModelId      | NavId        | long     | Id    | Id                 |
|           | RowNum       | true      | 2     | rowNum   | RowNum       | undefined    | long     | Int64 | undefined          |

| ECInstanceId | ModelId | RowNum |
| ------------ | ------- | ------ |
| 0x14         | 0x11    | 1      |
| 0x16         | 0x11    | 2      |
| 0x18         | 0x11    | 3      |
| 0x1a         | 0x11    | 4      |
| 0x1c         | 0x11    | 5      |
| 0x15         | 0x11    | 1      |
| 0x17         | 0x11    | 2      |
| 0x19         | 0x11    | 3      |
| 0x1b         | 0x11    | 4      |
| 0x1d         | 0x11    | 5      |

# Order by with Window function

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  Model.Id AS ModelId,
  ROW_NUMBER() OVER (
    PARTITION BY
      NullProp
  ) AS RowNum
FROM
  aps.TestElement
ORDER BY
  RowNum DESC
```

| className | accessString | generated | index | jsonName | name         | extendedType | typeName | type  | originPropertyName |
| --------- | ------------ | --------- | ----- | -------- | ------------ | ------------ | -------- | ----- | ------------------ |
|           | ECInstanceId | false     | 0     | id       | ECInstanceId | Id           | long     | Id    | ECInstanceId       |
|           | ModelId      | true      | 1     | modelId  | ModelId      | NavId        | long     | Id    | Id                 |
|           | RowNum       | true      | 2     | rowNum   | RowNum       | undefined    | long     | Int64 | undefined          |

| ECInstanceId | ModelId | RowNum |
| ------------ | ------- | ------ |
| 0x1c         | 0x11    | 5      |
| 0x1d         | 0x11    | 5      |
| 0x1a         | 0x11    | 4      |
| 0x1b         | 0x11    | 4      |
| 0x18         | 0x11    | 3      |
| 0x19         | 0x11    | 3      |
| 0x16         | 0x11    | 2      |
| 0x17         | 0x11    | 2      |
| 0x14         | 0x11    | 1      |
| 0x15         | 0x11    | 1      |

# Group by nav prop

- dataset: AllProperties.bim

```sql
SELECT Model.Id AS ModelId, COUNT(*) AS ElementCount FROM Bis.Element GROUP BY ModelId
```

| className | accessString | generated | index | jsonName     | name         | extendedType | typeName | type  | originPropertyName |
| --------- | ------------ | --------- | ----- | ------------ | ------------ | ------------ | -------- | ----- | ------------------ |
|           | ModelId      | true      | 0     | modelId      | ModelId      | NavId        | long     | Id    | Id                 |
|           | ElementCount | true      | 1     | elementCount | ElementCount | undefined    | long     | Int64 | undefined          |

| ModelId | ElementCount |
| ------- | ------------ |
| 0x1     | 4            |
| 0x10    | 2            |
| 0x11    | 12           |
