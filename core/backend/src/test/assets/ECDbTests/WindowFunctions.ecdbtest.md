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
| AllProperties:IPrimitive | s            | false     | 1     | s         | s         |              | string   | String   | s                  |
|                          | Date         | true      | 2     | date      | Date      |              | dateTime | DateTime | dt                 |
|                          | RowNumber    | true      | 3     | rowNumber | RowNumber |              | long     | Int64    | undefined          |

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
| AllProperties:IPrimitive | i            | false     | 0     | i        | i    |              | int      | Int   | i                  |
|                          | rank         | true      | 1     | rank     | rank |              | long     | Int64 | undefined          |

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
| AllProperties:IPrimitive | i            | false     | 0     | i        | i    |              | int      | Int   | i                  |
|                          | rank         | true      | 1     | rank     | rank |              | long     | Int64 | undefined          |

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

| className | accessString | generated | index | jsonName   | name       | extendedType | typeName | type  |
| --------- | ------------ | --------- | ----- | ---------- | ---------- | ------------ | -------- | ----- |
|           | i            | true      | 0     | i          | i          |              | int      | Int   |
|           | rank         | true      | 1     | rank       | rank       |              | long     | Int64 |
|           | copyOfRank   | true      | 2     | copyOfRank | copyOfRank |              | long     | Int64 |

| i   | rank | copyOfRank |
| --- | ---- | ---------- |
| 100 | 2    | 2          |
| 102 | 2    | 2          |
| 101 | 1    | 1          |
