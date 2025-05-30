Copyright © Bentley Systems, Incorporated. All rights reserved. See [LICENSE.md](../../../../LICENSE.md) for license terms and full copyright notice.

# With Count function

- dataset: AllProperties.bim

```sql
SELECT NullProp, count(*) as Total_Count FROM aps.TestElement GROUP BY NullProp
```

| className                 | accessString | generated | index | jsonName    | name        | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ----------- | ----------- | ------------ | -------- | ------ | ------------------ |
| AllProperties:TestElement | NullProp     | false     | 0     | nullProp    | NullProp    | undefined    | string   | String | NullProp           |
|                           | Total_Count  | true      | 1     | total_Count | Total_Count | undefined    | long     | Int64  | undefined          |

| Total_Count | NullProp  |
| ----------- | --------- |
| 5           | undefined |
| 5           | NotNull   |

# With Sum function

- dataset: AllProperties.bim

```sql
SELECT NullProp, SUM(DirectLong) as Total_Sum FROM aps.TestElement GROUP BY NullProp
```

| className                 | accessString | generated | index | jsonName  | name      | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | --------- | --------- | ------------ | -------- | ------ | ------------------ |
| AllProperties:TestElement | NullProp     | false     | 0     | nullProp  | NullProp  | undefined    | string   | String | NullProp           |
|                           | Total_Sum    | true      | 1     | total_Sum | Total_Sum | undefined    | long     | Int64  | undefined          |

| Total_Sum | NullProp  |
| --------- | --------- |
| 5020      | undefined |
| 5025      | NotNull   |

# With Avg function

- dataset: AllProperties.bim

```sql
SELECT NullProp, Avg(DirectLong) as Average_Val FROM aps.TestElement GROUP BY NullProp
```

| className                 | accessString | generated | index | jsonName    | name        | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ----------- | ----------- | ------------ | -------- | ------ | ------------------ |
| AllProperties:TestElement | NullProp     | false     | 0     | nullProp    | NullProp    | undefined    | string   | String | NullProp           |
|                           | Average_Val  | true      | 1     | average_Val | Average_Val | undefined    | double   | Double | undefined          |

| Average_Val | NullProp  |
| ----------- | --------- |
| 1004        | undefined |
| 1005        | NotNull   |

# With Min function

- dataset: AllProperties.bim

```sql
SELECT NullProp, Min(DirectLong) as Minimum_Val FROM aps.TestElement GROUP BY NullProp
```

| className                 | accessString | generated | index | jsonName    | name        | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ----------- | ----------- | ------------ | -------- | ------ | ------------------ |
| AllProperties:TestElement | NullProp     | false     | 0     | nullProp    | NullProp    | undefined    | string   | String | NullProp           |
|                           | Minimum_Val  | true      | 1     | minimum_Val | Minimum_Val | undefined    | long     | Int64  | undefined          |

| Minimum_Val | NullProp  |
| ----------- | --------- |
| 1000        | undefined |
| 1001        | NotNull   |

# With Max function

- dataset: AllProperties.bim

```sql
SELECT NullProp, Max(DirectLong) as Maximum_Val FROM aps.TestElement GROUP BY NullProp
```

| className                 | accessString | generated | index | jsonName    | name        | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ----------- | ----------- | ------------ | -------- | ------ | ------------------ |
| AllProperties:TestElement | NullProp     | false     | 0     | nullProp    | NullProp    | undefined    | string   | String | NullProp           |
|                           | Maximum_Val  | true      | 1     | maximum_Val | Maximum_Val | undefined    | long     | Int64  | undefined          |

| Maximum_Val | NullProp  |
| ----------- | --------- |
| 1008        | undefined |
| 1009        | NotNull   |

# With multiple columns

- dataset: AllProperties.bim

```sql
SELECT count(*) as Total_Count, bin, NullProp FROM aps.TestElement group by bin, nullprop
```

| className                 | accessString | generated | index | jsonName    | name        | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ----------- | ----------- | ------------ | -------- | ------ | ------------------ |
|                           | Total_Count  | true      | 0     | total_Count | Total_Count | undefined    | long     | Int64  | undefined          |
| AllProperties:IPrimitive  | bin          | false     | 1     | bin         | bin         | undefined    | binary   | Blob   | bin                |
| AllProperties:TestElement | NullProp     | false     | 2     | nullProp    | NullProp    | undefined    | string   | String | NullProp           |

| Total_Count | bin                                | NullProp  |
| ----------- | ---------------------------------- | --------- |
| 5           | BIN(1,2,3)                         | undefined |
| 5           | BIN(11,21,31,34,53,21,14,14,55,22) | NotNull   |

# With Having clause

- dataset: AllProperties.bim

```sql
SELECT
  ECInstanceId,
  DirectLong,
  NullProp
FROM
  aps.TestElement
GROUP BY
  NullProp
HAVING
  DirectLong > 1000
```

| className                 | accessString | generated | index | jsonName   | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ---------- | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | ECInstanceId | false     | 0     | id         | ECInstanceId | Id           | long     | Id     | ECInstanceId       |
| AllProperties:TestElement | DirectLong   | false     | 1     | directLong | DirectLong   | undefined    | long     | Int64  | DirectLong         |
| AllProperties:TestElement | NullProp     | false     | 2     | nullProp   | NullProp     | undefined    | string   | String | NullProp           |

| ECInstanceId | DirectLong | NullProp |
| ------------ | ---------- | -------- |
| 0x15         | 1001       | NotNull  |

# With Having clause and Sum function

- dataset: AllProperties.bim

```sql
SELECT
  NullProp,
  SUM(DirectLong) AS Total_Sum
FROM
  aps.TestElement
GROUP BY
  NullProp
HAVING
  Total_Sum > 5020
```

| className                 | accessString | generated | index | jsonName  | name      | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | --------- | --------- | ------------ | -------- | ------ | ------------------ |
| AllProperties:TestElement | NullProp     | false     | 0     | nullProp  | NullProp  | undefined    | string   | String | NullProp           |
|                           | Total_Sum    | true      | 1     | total_Sum | Total_Sum | undefined    | long     | Int64  | undefined          |

| NullProp | Total_Sum |
| -------- | --------- |
| NotNull  | 5025      |

# With Having clause and Avg function

- dataset: AllProperties.bim

```sql
SELECT
  NullProp,
  AVG(DirectLong) AS Average_Val
FROM
  aps.TestElement
GROUP BY
  NullProp
HAVING
  Average_Val < 1005
```

| className                 | accessString | generated | index | jsonName    | name        | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ----------- | ----------- | ------------ | -------- | ------ | ------------------ |
| AllProperties:TestElement | NullProp     | false     | 0     | nullProp    | NullProp    | undefined    | string   | String | NullProp           |
|                           | Average_Val  | true      | 1     | average_Val | Average_Val | undefined    | double   | Double | undefined          |

| Average_Val |
| ----------- |
| 1004        |

# With Having clause and multiple aggregate functions gt check

- dataset: AllProperties.bim

```sql
SELECT
  NullProp,
  MAX(DirectLong) AS Max_Val,
  MIN(DirectLong) AS Min_Val
FROM
  aps.TestElement
GROUP BY
  NullProp
HAVING
  (Max_Val + Min_Val) / 2 > 1004
```

| className                 | accessString | generated | index | jsonName | name     | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | -------- | -------- | ------------ | -------- | ------ | ------------------ |
| AllProperties:TestElement | NullProp     | false     | 0     | nullProp | NullProp | undefined    | string   | String | NullProp           |
|                           | Max_Val      | true      | 1     | max_Val  | Max_Val  | undefined    | long     | Int64  | undefined          |
|                           | Min_Val      | true      | 2     | min_Val  | Min_Val  | undefined    | long     | Int64  | undefined          |

| NullProp | Max_Val | Min_Val |
| -------- | ------- | ------- |
| NotNull  | 1009    | 1001    |

# With Having clause and multiple aggregate functions lt check2

- dataset: AllProperties.bim

```sql
SELECT
  NullProp,
  MAX(DirectLong) AS Max_Val,
  MIN(DirectLong) AS Min_Val
FROM
  aps.TestElement
GROUP BY
  NullProp
HAVING
  (Max_Val + Min_Val) / 2 < 1005
```

| className                 | accessString | generated | index | jsonName | name     | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | -------- | -------- | ------------ | -------- | ------ | ------------------ |
| AllProperties:TestElement | NullProp     | false     | 0     | nullProp | NullProp | undefined    | string   | String | NullProp           |
|                           | Max_Val      | true      | 1     | max_Val  | Max_Val  | undefined    | long     | Int64  | undefined          |
|                           | Min_Val      | true      | 2     | min_Val  | Min_Val  | undefined    | long     | Int64  | undefined          |

| Max_Val | Min_Val |
| ------- | ------- |
| 1008    | 1000    |

# With multiple aggregate functions

- dataset: AllProperties.bim

```sql
SELECT
  NullProp,
  Count(*) AS Total_Count,
  MAX(DirectLong) AS Max_Val,
  MIN(DirectLong) AS Min_Val
FROM
  aps.TestElement
GROUP BY
  NullProp
```

| className                 | accessString | generated | index | jsonName    | name        | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ----------- | ----------- | ------------ | -------- | ------ | ------------------ |
| AllProperties:TestElement | NullProp     | false     | 0     | nullProp    | NullProp    | undefined    | string   | String | NullProp           |
|                           | Total_Count  | true      | 1     | total_Count | Total_Count | undefined    | long     | Int64  | undefined          |
|                           | Max_Val      | true      | 2     | max_Val     | Max_Val     | undefined    | long     | Int64  | undefined          |
|                           | Min_Val      | true      | 3     | min_Val     | Min_Val     | undefined    | long     | Int64  | undefined          |

| Total_Count | Max_Val | Min_Val | NullProp  |
| ----------- | ------- | ------- | --------- |
| 5           | 1008    | 1000    | undefined |
| 5           | 1009    | 1001    | NotNull   |

# With Case

- dataset: AllProperties.bim

```sql
SELECT
  nullprop,
  SUM(DirectLong) AS sum_Val
FROM
  aps.TestElement
GROUP BY
  nullprop
HAVING
  SUM(
    CASE
      WHEN DirectDouble > 5.1 THEN DirectLong
      ELSE 0
    END
  ) > 2015
```

| className                 | accessString | generated | index | jsonName | name     | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | -------- | -------- | ------------ | -------- | ------ | ------------------ |
| AllProperties:TestElement | NullProp     | false     | 0     | nullProp | NullProp | undefined    | string   | String | NullProp           |
|                           | sum_Val      | true      | 1     | sum_Val  | sum_Val  | undefined    | long     | Int64  | undefined          |

| NullProp | sum_Val |
| -------- | ------- |
| NotNull  | 5025    |

# With Coalesce

- dataset: AllProperties.bim

```sql
SELECT
  nullprop,
  SUM(DirectLong) AS sum_Val
FROM
  aps.TestElement
GROUP BY
  nullprop
HAVING
  Length(Coalesce(NullProp, DirectStr)) > 4
```

| className                 | accessString | generated | index | jsonName | name     | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | -------- | -------- | ------------ | -------- | ------ | ------------------ |
| AllProperties:TestElement | NullProp     | false     | 0     | nullProp | NullProp | undefined    | string   | String | NullProp           |
|                           | sum_Val      | true      | 1     | sum_Val  | sum_Val  | undefined    | long     | Int64  | undefined          |

| NullProp | sum_Val |
| -------- | ------- |
| NotNull  | 5025    |

# With Join

- dataset: AllProperties.bim

```sql
SELECT
  ec_classname (e.ECClassId) AS Name,
  e.Model.Id,
  c.Name AS ClassName,
  e.NullProp
FROM
  aps.TestElement e
  JOIN meta.ECClassDef c ON e.ECClassID = c.ECInstanceId
GROUP BY
  nullprop
```

| className                 | accessString | generated | index | jsonName  | name      | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | --------- | --------- | ------------ | -------- | ------ | ------------------ |
|                           | Name         | true      | 0     | name      | Name      | undefined    | string   | String | undefined          |
|                           | Model.Id     | false     | 1     | model.id  | Id        | NavId        | long     | Id     | Id                 |
|                           | ClassName    | true      | 2     | className | ClassName | undefined    | string   | String | Name               |
| AllProperties:TestElement | NullProp     | false     | 3     | nullProp  | NullProp  | undefined    | string   | String | NullProp           |

| Name                      | Id   | ClassName   | NullProp  |
| ------------------------- | ---- | ----------- | --------- |
| AllProperties:TestElement | 0x11 | TestElement | undefined |
| AllProperties:TestElement | 0x11 | TestElement | NotNull   |


# With a subquery

- dataset: AllProperties.bim

```sql
SELECT
  NullProp,
  bin,
  COUNT(*) AS Total_Count
FROM
  aps.TestElement
GROUP BY
  nullprop
HAVING
  Length(bin) > (
    SELECT
      count(*)
    FROM
      aps.TestElement
    GROUP BY
      nullprop
  )
```

| className                 | accessString | generated | index | jsonName    | name        | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ----------- | ----------- | ------------ | -------- | ------ | ------------------ |
| AllProperties:TestElement | NullProp     | false     | 0     | nullProp    | NullProp    | undefined    | string   | String | NullProp           |
| AllProperties:IPrimitive  | bin          | false     | 1     | bin         | bin         | undefined    | binary   | Blob   | bin                |
|                           | Total_Count  | true      | 2     | total_Count | Total_Count | undefined    | long     | Int64  | undefined          |

| NullProp | bin                                | Total_Count |
| -------- | ---------------------------------- | ----------- |
| NotNull  | BIN(11,21,31,34,53,21,14,14,55,22) | 5           |

# With DISTINCT

- dataset: AllProperties.bim

```sql
SELECT  bin,  Count(Distinct(bin)) as distinct_count FROM  aps.TestElement GROUP BY  bin
```

| className                | accessString   | generated | index | jsonName       | name           | extendedType | typeName | type  | originPropertyName |
| ------------------------ | -------------- | --------- | ----- | -------------- | -------------- | ------------ | -------- | ----- | ------------------ |
| AllProperties:IPrimitive | bin            | false     | 0     | bin            | bin            | undefined    | binary   | Blob  | bin                |
|                          | distinct_count | true      | 1     | distinct_count | distinct_count | undefined    | long     | Int64 | undefined          |

| bin                                | distinct_count |
| ---------------------------------- | -------------- |
| BIN(1,2,3)                         | 1              |
| BIN(11,21,31,34,53,21,14,14,55,22) | 1              |

# With where clause

- dataset: AllProperties.bim

```sql
SELECT
  bin,
  nullprop,
  count(*) AS Total_Count
FROM
  aps.TestElement
WHERE
  DirectLong > 1005
GROUP BY
  nullprop,
  bin
```

| className                 | accessString | generated | index | jsonName    | name        | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ----------- | ----------- | ------------ | -------- | ------ | ------------------ |
| AllProperties:IPrimitive  | bin          | false     | 0     | bin         | bin         | undefined    | binary   | Blob   | bin                |
| AllProperties:TestElement | NullProp     | false     | 1     | nullProp    | NullProp    | undefined    | string   | String | NullProp           |
|                           | Total_Count  | true      | 2     | total_Count | Total_Count | undefined    | long     | Int64  | undefined          |

| bin                                | Total_Count | NullProp  |
| ---------------------------------- | ----------- | --------- |
| BIN(1,2,3)                         | 2           | undefined |
| BIN(11,21,31,34,53,21,14,14,55,22) | 2           | NotNull   |

# With order by clause

- dataset: AllProperties.bim

```sql
SELECT
  directstr,
  bin,
  nullprop,
  count(*) AS Total_Count
FROM
  aps.TestElement
WHERE
  DirectLong > 1005
GROUP BY
  nullprop
ORDER BY
  bin
```

| className                 | accessString | generated | index | jsonName    | name        | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ----------- | ----------- | ------------ | -------- | ------ | ------------------ |
| AllProperties:TestElement | DirectStr    | false     | 0     | directStr   | DirectStr   | undefined    | string   | String | DirectStr          |
| AllProperties:IPrimitive  | bin          | false     | 1     | bin         | bin         | undefined    | binary   | Blob   | bin                |
| AllProperties:TestElement | NullProp     | false     | 2     | nullProp    | NullProp    | undefined    | string   | String | NullProp           |
|                           | Total_Count  | true      | 3     | total_Count | Total_Count | undefined    | long     | Int64  | undefined          |

| DirectStr | bin                                | Total_Count | NullProp  |
| --------- | ---------------------------------- | ----------- | --------- |
| str6      | BIN(1,2,3)                         | 2           | undefined |
| str7      | BIN(11,21,31,34,53,21,14,14,55,22) | 2           | NotNull   |

# With order by clause desc

- dataset: AllProperties.bim

```sql
SELECT
  directstr,
  bin,
  nullprop,
  count(*) AS Total_Count
FROM
  aps.TestElement
WHERE
  DirectLong > 1005
GROUP BY
  nullprop
ORDER BY
  bin DESC
```

| className                 | accessString | generated | index | jsonName    | name        | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ----------- | ----------- | ------------ | -------- | ------ | ------------------ |
| AllProperties:TestElement | DirectStr    | false     | 0     | directStr   | DirectStr   | undefined    | string   | String | DirectStr          |
| AllProperties:IPrimitive  | bin          | false     | 1     | bin         | bin         | undefined    | binary   | Blob   | bin                |
| AllProperties:TestElement | NullProp     | false     | 2     | nullProp    | NullProp    | undefined    | string   | String | NullProp           |
|                           | Total_Count  | true      | 3     | total_Count | Total_Count | undefined    | long     | Int64  | undefined          |

| DirectStr | bin                                | NullProp  | Total_Count |
| --------- | ---------------------------------- | --------- | ----------- |
| str7      | BIN(11,21,31,34,53,21,14,14,55,22) | NotNull   | 2           |
| str6      | BIN(1,2,3)                         | undefined | 2           |
