# An overly complicated statement

> This file is the readme and at the same time would be a valid test. All files ending in .ecdbtest.md in the directory will be used.

> A header indicates a new test and is at the same time the title of the test. A file may contain multiple tests
> Regular text, blockquotes or html comments can be used to describe the test, they do not affect test execution
> properties go into list and follow the format: - key: value
> the dataset property specifies the bim file to open

- dataset: AllProperties.bim

> the .bim file can have a .props file alongside holding json, for example here AllProperties.bim.props
> The properties inside that json can be used in binders, statements and code blocks using this syntax: $(propName)

> first sql code block found after a header indicates the sql to execute

```sql
WITH RECURSIVE
  f0(i) AS (SELECT 1 UNION SELECT i+1 FROM f0 WHERE i < 10 ORDER BY 1),
  f1(i) AS (SELECT 3.14159265358),
  f2(i) AS (SELECT IIF((1 != 2) OR (4 = 5) AND ( 4 > 8 ) OR (4 < 5) OR (4 <= 5) AND ( 4 >= 6 ), 'True', 'False') i),
  f3(i) AS (SELECT 1 FROM bis.Element t0 JOIN bis.Element t1 USING bis.ElementOwnsChildElements FORWARD),
  f4(i) AS (SELECT 1 FROM bis.Element t0 JOIN bis.Element t1 USING bis.ElementOwnsChildElements BACKWARD),
  f5(i) AS (
    SELECT 1 FROM meta.ECClassDef
      JOIN meta.ECPropertyDef ON ECPropertyDef.Class.Id = ECClassDef.ECInstanceId
      WHERE ECClassDef.ECInstanceId = :param1
  )
  SELECT
    (1 & 2 ) | (3 << 4 ) >> (5/ 6) * (7 + 8) + (4 % 9) + (-10) + (+20) - (~45) c0,
    TIMESTAMP '2013-02-09T12:00:00' c1,
    DATE '2012-01-18' c2,
    TIME '13:35:16' c3,
    TRUE c4,
    FALSE c5,
    3.14159265358 c6,
    314159 c7,
    'Hello, World' c8,
    'Hello'|| ',' || 'World' c9,
    IIF((1 != 2) OR (4 = 5) AND ( 4 > 8 ) OR (4 < 5) OR (4 <= 5) AND ( 4 >= 6 ), 'True', 'False') c10,
    CASE WHEN 4>5 THEN NULL WHEN 1 IS NOT NULL THEN 'Hello' ELSE 'Bye' END  c11,
    IIF(('Hello, World' LIKE '\\%World' escape '\\') , 2, 3)  c12,
    IIF(('Hello, World' LIKE '%World') , 2, 3)  c13,
    IIF(('Hello, World' NOT LIKE '%World') , 2, 3)  c14,
    IIF( 3 IN (SELECT 1 AS N UNION SELECT 2), 'True', 'False')  c15,
    IIF( 3 IN (1,2,3), 'True', 'False') c16,
    IIF( 3 NOT IN (1,2,3), 'True', 'False')  c17,
    IIF( NULL IS NULL, 'True', 'False')  c18,
    IIF( NULL IS NOT NULL, 'True', 'False')  c19,
    IIF( 1 IS NOT NULL, 'True', 'False')  c20,
    IIF( 3 IS (ALL meta.ECClassDef, ONLY meta.ECPropertyDef), 'True', 'False') c21,
    IIF( 3 IS NOT (ALL meta.ECClassDef, ONLY meta.ECPropertyDef), 'True', 'False') c22,
    IIF(NOT 3, 'True', 'False') c23,
    IIF( (NOT (NOT (NOT (NOT 3)))), 'True', 'False') c24,
    IIF(EXISTS(SELECT 1), 'True', 'False') c25,
    IIF(NOT EXISTS(SELECT 1), 'True', 'False') c26,
    CAST(1 AS TEXT) c27,
    CAST(1 AS INTEGER) c28,
    CAST(1 AS REAL) c29,
    CAST(1 AS BLOB) c30,
    CAST(1 AS TIMESTAMP) c31,
    INSTR('First', 'Second') c32,
    f0.i  c33,
    f1.i  c34,
    f2.i  c35,
    k0.ECInstanceId c36
  FROM f0, f1, f2, f3, f4, f5, meta.ECClassDef k0, (
    SELECT ECInstanceId FROM meta.ECClassDef
    UNION
    SELECT DISTINCT ECInstanceId FROM meta.ECClassDef
    UNION ALL
    SELECT ALL ECInstanceId FROM meta.ECClassDef
    EXCEPT
    SELECT SUM(DISTINCT ECInstanceId) FROM meta.ECClassDef
    INTERSECT
    SELECT SUM(ECInstanceId) FROM meta.ECClassDef GROUP BY ECClassId HAVING COUNT(*)> 1
  ) k1
  WHERE f0.i = f1.i AND k0.ECInstanceId = ? + 2
  GROUP BY k0.ECClassId,k0.DisplayLabel HAVING COUNT(*)> 1
  ORDER BY k0.Name ASC, k0.ECInstanceId DESC
  LIMIT 33 OFFSET ? + :param2
  ECSQLOPTIONS NoECClassIdFilter ReadonlyPropertiesAreUpdatable X=3`
```

> Add possible binders:
>
> - bindBoolean
> - bindBlob
> - bindDouble
> - bindId
> - bindIdSet
> - bindInt
> - bindStruct
> - bindLong
> - bindString
> - bindNull
> - bindPoint2d
> - bindPoint3d

- bindInt 1, 23
- bindInt param2, 3

> If we expect prepare to fail use:
>
> - errorDuringPrepare: "Statement failed to prepare"
> If we expect a status other than OK/Done, use:
> - stepStatus: BE_SQLITE_DONE

> The first table asserts column infos after the first step. It is optional and can be omitted. First column header must be "AccessString"

| AccessString | OriginalName | Type    | ExtendedType |
|--------------|--------------|---------|--------------|
| c26          | c26          | Boolean | -            |
| c27          | c27          | Integer | -            |
| c28          | c28          | Integer | -            |
| c29          | c29          | Float   | -            |
| c30          | c30          | Integer | -            |
| c31          | c31          | Date    | -            |

> As an alternative, column infos can be formatted as json in a code block like this:

```json
{
  "columns": [
    {
      "name": "c26",
      "originalName": "c26",
      "type": "Boolean",
      "extendedType": "-"
    },
    {
      "name": "c27",
      "originalName": "c27",
      "type": "Integer",
      "extendedType": "-"
    },
    {
      "name": "c28",
      "originalName": "c28",
      "type": "Integer",
      "extendedType": "-"
    },
    {
      "name": "c29",
      "originalName": "c29",
      "type": "Float",
      "extendedType": "-"
    },
    {
      "name": "c30",
      "originalName": "c30",
      "type": "Integer",
      "extendedType": "-"
    },
    {
      "name": "c31",
      "originalName": "c31",
      "type": "Date",
      "extendedType": "-"
    }
  ]
}
```

> The result rows can be represented as a table

| c26   | c27 | c28 | c29 | c30 | c31       |
|-------|-----|-----|-----|-----|-----------|
| True  | 1   | 1   | 1.0 | 1   | 2021-01-01|
| False | 1   | 1   | 1.0 | 1   | 2021-01-02|
| True  | 1   | 1   | 1.0 | 1   | 2021-01-03|

> As an alternative, json can be used, whatever is preferred or more readable

```json
[
  {
    "c26": true,
    "c27": 1,
    "c28": 1,
    "c29": 1.0,
    "c30": 1,
    "c31": "2021-01-01"
  },
  {
    "c26": false,
    "c27": 1,
    "c28": 1,
    "c29": 1.0,
    "c30": 1,
    "c31": "2021-01-02"
  },
  {
    "c26": true,
    "c27": 1,
    "c28": 1,
    "c29": 1.0,
    "c30": 1,
    "c31": "2021-01-03"
  }
]
```
