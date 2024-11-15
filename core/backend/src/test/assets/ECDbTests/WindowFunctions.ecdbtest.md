# Window function partition by two date values

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
