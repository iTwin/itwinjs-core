# Partition by two date values

- dataset: AllProperties.bim

```sql
SELECT
  te.ECInstanceId [MyId],
  te.s,
  te.DT [Date],
  row_number() OVER (
    PARTITION BY
      te.DT
    ORDER BY
      te.ECInstanceId
  ) AS [RowNumber]
FROM
  aps.TestElement te
WHERE
  te.i < 106
```

| className                | accessString | generated | index | jsonName  | name      | extendedType | typeName | type     | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | --------- | --------- | ------------ | -------- | -------- | ------------------ |
|                          | MyId         | true      | 0     | myId      | MyId      | Id           | long     | Id       | ECInstanceId       |
| AllProperties:IPrimitive | s            | false     | 1     | s         | s         | undefined    | string   | String   | s                  |
|                          | Date         | true      | 2     | date      | Date      | undefined    | dateTime | DateTime | dt                 |
|                          | RowNumber    | true      | 3     | rowNumber | RowNumber | undefined    | long     | Int64    | undefined          |

| MyId | s    | Date                    | RowNumber |
| ---- | ---- | ----------------------- | --------- |
| 0x15 | str1 | 2010-01-01T11:11:11.000 | 1         |
| 0x17 | str3 | 2010-01-01T11:11:11.000 | 2         |
| 0x19 | str5 | 2010-01-01T11:11:11.000 | 3         |
| 0x14 | str0 | 2017-01-01T00:00:00.000 | 1         |
| 0x16 | str2 | 2017-01-01T00:00:00.000 | 2         |
| 0x18 | str4 | 2017-01-01T00:00:00.000 | 3         |

# Rank by date values

- dataset: AllProperties.bim

```sql
SELECT i, rank() over(ORDER BY dt) as [rank] from aps.TestElement
```

| className                | accessString | generated | index | jsonName | name | extendedType | typeName | type  | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ----- | ------------------ |
| AllProperties:IPrimitive | i            | false     | 0     | i        | i    | undefined    | int      | Int   | i                  |
|                          | rank         | true      | 1     | rank     | rank | undefined    | long     | Int64 | undefined          |

| i   | rank |
| --- | ---- |
| 101 | 1    |
| 103 | 1    |
| 105 | 1    |
| 107 | 1    |
| 109 | 1    |
| 100 | 6    |
| 102 | 6    |
| 104 | 6    |
| 106 | 6    |
| 108 | 6    |

# Dense_Rank with WHERE clause

- dataset: AllProperties.bim

```sql
SELECT i, dense_rank() over(ORDER BY dt) as [rank] from aps.TestElement WHERE i < 103
```

| className                | accessString | generated | index | jsonName | name | extendedType | typeName | type  | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | ----- | ------------------ |
| AllProperties:IPrimitive | i            | false     | 0     | i        | i    | undefined    | int      | Int   | i                  |
|                          | rank         | true      | 1     | rank     | rank | undefined    | long     | Int64 | undefined          |

| i   | rank |
| --- | ---- |
| 101 | 1    |
| 100 | 2    |
| 102 | 2    |

# Dense_Rank wrapped in CTE with order by and copy of a column

- dataset: AllProperties.bim

```sql
WITH
  RankedElements (i, [rank]) AS (
    SELECT
      i,
      dense_rank() OVER (ORDER BY dt) AS [rank]
    FROM
      aps.TestElement
    WHERE
      i < 103
  )
SELECT re.*, re.[rank] AS [copyOfRank]
FROM RankedElements re
ORDER BY re.[rank] DESC
```

| className | accessString | generated | index | jsonName   | name       | extendedType | typeName | type  | originPropertyName |
| --------- | ------------ | --------- | ----- | ---------- | ---------- | ------------ | -------- | ----- | ------------------ |
|           | i            | true      | 0     | i          | i          | undefined    | int      | Int   | undefined          |
|           | rank         | true      | 1     | rank       | rank       | undefined    | long     | Int64 | undefined          |
|           | copyOfRank   | true      | 2     | copyOfRank | copyOfRank | undefined    | long     | Int64 | undefined          |

| i   | rank | copyOfRank |
| --- | ---- | ---------- |
| 100 | 2    | 2          |
| 102 | 2    | 2          |
| 101 | 1    | 1          |

# Several window functions (percent, cume_dist, ntile, lag, lead) in combination

- dataset: AllProperties.bim

```sql
SELECT
  te.ECInstanceId [MyId],
  percent_rank() OVER (PARTITION BY te.DT) AS [percent],
  cume_dist() OVER (PARTITION BY te.DT) AS [cumeDist],
  ntile(2) OVER (ORDER BY te.i) AS [half],
  lag(te.ECInstanceId, 1, null) OVER (ORDER BY te.i) AS [previousId],
  lead(te.ECInstanceId, 1, null) OVER (ORDER BY te.i) AS [nextId]
FROM
  aps.TestElement te
WHERE
  te.i < 106
```

| className | accessString | generated | index | jsonName   | name       | extendedType | typeName | type   | originPropertyName |
| --------- | ------------ | --------- | ----- | ---------- | ---------- | ------------ | -------- | ------ | ------------------ |
|           | MyId         | true      | 0     | myId       | MyId       | Id           | long     | Id     | ECInstanceId       |
|           | percent      | true      | 1     | percent    | percent    | undefined    | double   | Double | undefined          |
|           | cumeDist     | true      | 2     | cumeDist   | cumeDist   | undefined    | double   | Double | undefined          |
|           | half         | true      | 3     | half       | half       | undefined    | long     | Int64  | undefined          |
|           | previousId   | true      | 4     | previousId | previousId | Id           | long     | Id     | undefined          |
|           | nextId       | true      | 5     | nextId     | nextId     | Id           | long     | Id     | undefined          |

| MyId | percent | cumeDist | half | previousId | nextId    |
| ---- | ------- | -------- | ---- | ---------- | --------- |
| 0x15 | 0       | 1        | 1    | 0x14       | 0x16      |
| 0x17 | 0       | 1        | 2    | 0x16       | 0x18      |
| 0x19 | 0       | 1        | 2    | 0x18       | undefined |
| 0x14 | 0       | 1        | 1    | undefined  | 0x15      |
| 0x16 | 0       | 1        | 1    | 0x15       | 0x17      |
| 0x18 | 0       | 1        | 2    | 0x17       | 0x19      |

# First and Last per date partition

- dataset: AllProperties.bim

```sql
SELECT
  te.i,
  first_value(i) OVER (PARTITION BY dt ORDER BY i) AS [firstId],
  last_value(i) OVER (PARTITION BY dt ORDER BY i) AS [lastId]
  FROM
  aps.TestElement te
```

| className                | accessString | generated | index | jsonName | name    | extendedType | typeName | type | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | -------- | ------- | ------------ | -------- | ---- | ------------------ |
| AllProperties:IPrimitive | i            | false     | 0     | i        | i       | undefined    | int      | Int  | i                  |
|                          | firstId      | true      | 1     | firstId  | firstId | undefined    | int      | Int  | undefined          |
|                          | lastId       | true      | 2     | lastId   | lastId  | undefined    | int      | Int  | undefined          |

| i   | firstId | lastId |
| --- | ------- | ------ |
| 101 | 101     | 101    |
| 103 | 101     | 103    |
| 105 | 101     | 105    |
| 107 | 101     | 107    |
| 109 | 101     | 109    |
| 100 | 100     | 100    |
| 102 | 100     | 102    |
| 104 | 100     | 104    |
| 106 | 100     | 106    |
| 108 | 100     | 108    |

# Max aggregate function

- dataset: AllProperties.bim

```sql
SELECT te.i, te.dt, MAX(i) OVER (partition by dt) as [max] from aps.TestElement te
```

| className                | accessString | generated | index | jsonName | name | extendedType | typeName | type     | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | -------- | ------------------ |
| AllProperties:IPrimitive | i            | false     | 0     | i        | i    | undefined    | int      | Int      | i                  |
| AllProperties:IPrimitive | dt           | false     | 1     | dt       | dt   | undefined    | dateTime | DateTime | dt                 |
|                          | max          | true      | 2     | max      | max  | undefined    | int      | Int      | undefined          |

| i   | dt                      | max |
| --- | ----------------------- | --- |
| 101 | 2010-01-01T11:11:11.000 | 109 |
| 103 | 2010-01-01T11:11:11.000 | 109 |
| 105 | 2010-01-01T11:11:11.000 | 109 |
| 107 | 2010-01-01T11:11:11.000 | 109 |
| 109 | 2010-01-01T11:11:11.000 | 109 |
| 100 | 2017-01-01T00:00:00.000 | 108 |
| 102 | 2017-01-01T00:00:00.000 | 108 |
| 104 | 2017-01-01T00:00:00.000 | 108 |
| 106 | 2017-01-01T00:00:00.000 | 108 |
| 108 | 2017-01-01T00:00:00.000 | 108 |

# Max aggregate function with filter

- dataset: AllProperties.bim

```sql
SELECT te.i, te.dt, MAX(i) FILTER(WHERE i < 105) OVER (partition by dt) as [max] from aps.TestElement te
```

| className                | accessString | generated | index | jsonName | name | extendedType | typeName | type     | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | -------- | ---- | ------------ | -------- | -------- | ------------------ |
| AllProperties:IPrimitive | i            | false     | 0     | i        | i    | undefined    | int      | Int      | i                  |
| AllProperties:IPrimitive | dt           | false     | 1     | dt       | dt   | undefined    | dateTime | DateTime | dt                 |
|                          | max          | true      | 2     | max      | max  | undefined    | int      | Int      | undefined          |

| i   | dt                      | max |
| --- | ----------------------- | --- |
| 101 | 2010-01-01T11:11:11.000 | 103 |
| 103 | 2010-01-01T11:11:11.000 | 103 |
| 105 | 2010-01-01T11:11:11.000 | 103 |
| 107 | 2010-01-01T11:11:11.000 | 103 |
| 109 | 2010-01-01T11:11:11.000 | 103 |
| 100 | 2017-01-01T00:00:00.000 | 104 |
| 102 | 2017-01-01T00:00:00.000 | 104 |
| 104 | 2017-01-01T00:00:00.000 | 104 |
| 106 | 2017-01-01T00:00:00.000 | 104 |
| 108 | 2017-01-01T00:00:00.000 | 104 |

# Rows with Frame Start

- dataset: AllProperties.bim

```sql
SELECT te.i, first_value(i) OVER (order by i ROWS CURRENT ROW) as [first] from aps.TestElement te
```

| className                | accessString | generated | index | jsonName | name  | extendedType | typeName | type | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | -------- | ----- | ------------ | -------- | ---- | ------------------ |
| AllProperties:IPrimitive | i            | false     | 0     | i        | i     | undefined    | int      | Int  | i                  |
|                          | first        | true      | 1     | first    | first | undefined    | int      | Int  | undefined          |

| i   | first |
| --- | ----- |
| 100 | 100   |
| 101 | 101   |
| 102 | 102   |
| 103 | 103   |
| 104 | 104   |
| 105 | 105   |
| 106 | 106   |
| 107 | 107   |
| 108 | 108   |
| 109 | 109   |

# Rows with frame between

- dataset: AllProperties.bim

```sql
SELECT te.i, first_value(i) OVER (order by i ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) as [first] from aps.TestElement te
```

| className                | accessString | generated | index | jsonName | name  | extendedType | typeName | type | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | -------- | ----- | ------------ | -------- | ---- | ------------------ |
| AllProperties:IPrimitive | i            | false     | 0     | i        | i     | undefined    | int      | Int  | i                  |
|                          | first        | true      | 1     | first    | first | undefined    | int      | Int  | undefined          |

| i   | first |
| --- | ----- |
| 100 | 100   |
| 101 | 100   |
| 102 | 100   |
| 103 | 100   |
| 104 | 100   |
| 105 | 100   |
| 106 | 100   |
| 107 | 100   |
| 108 | 100   |
| 109 | 100   |

# Groups with frame start

- dataset: AllProperties.bim

```sql
SELECT te.i, last_value(i) OVER (order by dt GROUPS UNBOUNDED PRECEDING) as [group] from aps.TestElement te
```

| className                | accessString | generated | index | jsonName | name  | extendedType | typeName | type | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | -------- | ----- | ------------ | -------- | ---- | ------------------ |
| AllProperties:IPrimitive | i            | false     | 0     | i        | i     | undefined    | int      | Int  | i                  |
|                          | group        | true      | 1     | group    | group | undefined    | int      | Int  | undefined          |

| i   | group |
| --- | ----- |
| 101 | 109   |
| 103 | 109   |
| 105 | 109   |
| 107 | 109   |
| 109 | 109   |
| 100 | 108   |
| 102 | 108   |
| 104 | 108   |
| 106 | 108   |
| 108 | 108   |

# Range with frame start

- dataset: AllProperties.bim

```sql
SELECT te.i, first_value(i) OVER (order by dt RANGE 0 + 1 PRECEDING EXCLUDE NO OTHERS) as [range] from aps.TestElement te
```

| className                | accessString | generated | index | jsonName | name  | extendedType | typeName | type | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | -------- | ----- | ------------ | -------- | ---- | ------------------ |
| AllProperties:IPrimitive | i            | false     | 0     | i        | i     | undefined    | int      | Int  | i                  |
|                          | range        | true      | 1     | range    | range | undefined    | int      | Int  | undefined          |

| i   | range |
| --- | ----- |
| 101 | 101   |
| 103 | 101   |
| 105 | 101   |
| 107 | 101   |
| 109 | 101   |
| 100 | 100   |
| 102 | 100   |
| 104 | 100   |
| 106 | 100   |
| 108 | 100   |

# Named window

- dataset: AllProperties.bim

```sql
SELECT
  te.i,
  te.DT [Date],
  row_number() OVER win AS [RowNumber]
FROM
  aps.TestElement te
WHERE
  te.i < 106
WINDOW
  win as (PARTITION BY te.DT ORDER BY te.i)
```

| className                | accessString | generated | index | jsonName  | name      | extendedType | typeName | type     | originPropertyName |
| ------------------------ | ------------ | --------- | ----- | --------- | --------- | ------------ | -------- | -------- | ------------------ |
| AllProperties:IPrimitive | i            | false     | 0     | i         | i         | undefined    | int      | Int      | i                  |
|                          | Date         | true      | 1     | date      | Date      | undefined    | dateTime | DateTime | dt                 |
|                          | RowNumber    | true      | 2     | rowNumber | RowNumber | undefined    | long     | Int64    | undefined          |

| i   | Date                    | RowNumber |
| --- | ----------------------- | --------- |
| 101 | 2010-01-01T11:11:11.000 | 1         |
| 103 | 2010-01-01T11:11:11.000 | 2         |
| 105 | 2010-01-01T11:11:11.000 | 3         |
| 100 | 2017-01-01T00:00:00.000 | 1         |
| 102 | 2017-01-01T00:00:00.000 | 2         |
| 104 | 2017-01-01T00:00:00.000 | 3         |

# Window chaining

- dataset: AllProperties.bim

```sql
SELECT
  te.i,
  group_concat(i) OVER (win ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS [othersInGroup]
FROM
  aps.TestElement te
WINDOW
  win AS (PARTITION BY te.DT ORDER BY te.i)
```

| className                | accessString  | generated | index | jsonName      | name          | extendedType | typeName | type   | originPropertyName |
| ------------------------ | ------------- | --------- | ----- | ------------- | ------------- | ------------ | -------- | ------ | ------------------ |
| AllProperties:IPrimitive | i             | false     | 0     | i             | i             | undefined    | int      | Int    | i                  |
|                          | othersInGroup | true      | 1     | othersInGroup | othersInGroup | undefined    | string   | String | undefined          |

| i   | othersInGroup       |
| --- | ------------------- |
| 101 | "101"               |
| 103 | 101,103             |
| 105 | 101,103,105         |
| 107 | 101,103,105,107     |
| 109 | 101,103,105,107,109 |
| 100 | "100"               |
| 102 | 100,102             |
| 104 | 100,102,104         |
| 106 | 100,102,104,106     |
| 108 | 100,102,104,106,108 |

# Window partition collate nocase

- dataset: AllProperties.bim

```sql
SELECT
  te.i [id],
  te.noCaseString,
  row_number() OVER (PARTITION BY te.noCaseString COLLATE NOCASE) AS [partition]
FROM
  aps.TestElement te
```

| className                 | accessString | generated | index | jsonName     | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ------------ | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | id           | true      | 0     | id           | id           | undefined    | int      | Int    | i                  |
| AllProperties:TestElement | NoCaseString | false     | 1     | noCaseString | NoCaseString | undefined    | string   | String | NoCaseString       |
|                           | partition    | true      | 2     | partition    | partition    | undefined    | long     | Int64  | undefined          |

| id  | NoCaseString | partition |
| --- | ------------ | --------- |
| 100 | abc          | 1         |
| 101 | ABC          | 2         |
| 102 | abc          | 3         |
| 103 | ABC          | 4         |
| 104 | abc          | 5         |
| 105 | ABC          | 6         |
| 106 | abc          | 7         |
| 107 | ABC          | 8         |
| 108 | abc          | 9         |
| 109 | ABC          | 10        |

# Window partition collate rtrim

- dataset: AllProperties.bim

```sql
SELECT
  te.i [id],
  te.noCaseString,
  row_number() OVER (PARTITION BY te.noCaseString COLLATE RTRIM) AS [partition]
FROM
  aps.TestElement te
```

| className                 | accessString | generated | index | jsonName     | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ------------ | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | id           | true      | 0     | id           | id           | undefined    | int      | Int    | i                  |
| AllProperties:TestElement | NoCaseString | false     | 1     | noCaseString | NoCaseString | undefined    | string   | String | NoCaseString       |
|                           | partition    | true      | 2     | partition    | partition    | undefined    | long     | Int64  | undefined          |

| id  | NoCaseString | partition |
| --- | ------------ | --------- |
| 101 | ABC          | 1         |
| 103 | ABC          | 2         |
| 105 | ABC          | 3         |
| 107 | ABC          | 4         |
| 109 | ABC          | 5         |
| 100 | abc          | 1         |
| 102 | abc          | 2         |
| 104 | abc          | 3         |
| 106 | abc          | 4         |
| 108 | abc          | 5         |

# Window partition collate binary

- dataset: AllProperties.bim

```sql
SELECT
  te.i [id],
  te.noCaseString,
  row_number() OVER (PARTITION BY te.noCaseString COLLATE BINARY) AS [partition]
FROM
  aps.TestElement te
```

| className                 | accessString | generated | index | jsonName     | name         | extendedType | typeName | type   | originPropertyName |
| ------------------------- | ------------ | --------- | ----- | ------------ | ------------ | ------------ | -------- | ------ | ------------------ |
|                           | id           | true      | 0     | id           | id           | undefined    | int      | Int    | i                  |
| AllProperties:TestElement | NoCaseString | false     | 1     | noCaseString | NoCaseString | undefined    | string   | String | NoCaseString       |
|                           | partition    | true      | 2     | partition    | partition    | undefined    | long     | Int64  | undefined          |

| id  | NoCaseString | partition |
| --- | ------------ | --------- |
| 101 | ABC          | 1         |
| 103 | ABC          | 2         |
| 105 | ABC          | 3         |
| 107 | ABC          | 4         |
| 109 | ABC          | 5         |s
| 100 | abc          | 1         |
| 102 | abc          | 2         |
| 104 | abc          | 3         |
| 106 | abc          | 4         |
| 108 | abc          | 5         |

# Partition by ExtractInstanceExp

- dataset: AllProperties.bim

```sql
SELECT te.i [id], row_number() OVER (PARTITION BY $) AS [partition] FROM aps.TestElement te LIMIT 4
```

| className | accessString | generated | index | jsonName  | name      | extendedType | typeName | type  | originPropertyName |
| --------- | ------------ | --------- | ----- | --------- | --------- | ------------ | -------- | ----- | ------------------ |
|           | id           | true      | 0     | id        | id        | undefined    | int      | Int   | i                  |
|           | partition    | true      | 1     | partition | partition | undefined    | long     | Int64 | undefined          |

| id  | partition |
| --- | --------- |
| 100 | 1         |
| 101 | 1         |
| 102 | 1         |
| 103 | 1         |

# Partition by ExtractPropertyExp

- dataset: AllProperties.bim

```sql
SELECT te.i [id], row_number() OVER (PARTITION BY $->b) AS [partition] FROM aps.TestElement te LIMIT 4
```

| className | accessString | generated | index | jsonName  | name      | extendedType | typeName | type  | originPropertyName |
| --------- | ------------ | --------- | ----- | --------- | --------- | ------------ | -------- | ----- | ------------------ |
|           | id           | true      | 0     | id        | id        | undefined    | int      | Int   | i                  |
|           | partition    | true      | 1     | partition | partition | undefined    | long     | Int64 | undefined          |

| id  | partition |
| --- | --------- |
| 100 | 1         |
| 101 | 2         |
| 102 | 3         |
| 103 | 4         |
