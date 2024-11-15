# Readme for ECDb tests

This file is the readme for the ECDB SQL test runner. All files ending in .ecdbtest.md in the directory will be used.

A h1-header (#) indicates a new test and is at the same time the title of the test. A file may contain multiple tests
Regular text, blockquotes or html comments can be used to describe the test, they do not affect test execution

## Properties

Properties go into list and follow the format: - key: value
These are the available properties:

- dataset: AllProperties.bim

Required. The dataset property specifies the bim file to open
The .bim file can have a .props file alongside holding json, for example here AllProperties.bim.props
The properties inside that json can be used in binders, statements and code blocks using this syntax: $(propName)

- only: true

Optional. Tests marked by this will be filtered so only those tests run. (Translates into it.only())

- mode: Both

Optional, defaults to Both
Specifies whether to run only statement, concurrent query or both. Values are: Statement, ConcurrentQuery, Both

- rowFormat: ECSqlNames

Optional, defaults to ECSqlNames.
Specifies the row format option given to ECDb. Possible values are: ECSqlNames, ECSqlIndexes, JsNames

- abbreviateBlobs: true

Optional, defaults to false
It abbreviate blobs to single bytes.

- convertClassIdsToClassNames: true

Optional, defaults to false
Convert ECClassId, SourceECClassId, TargetECClassId and RelClassId to respective name.

## SQL

The first sql code block found after a header indicates the sql to execute

```sql
SELECT * from meta.ECSchemaDef LIMIT 5
```

> Add possible binders:
> (they can use a param index or parameter name as shown below)
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

## Asserting results

The first table asserts column infos after the first step. It is optional and can be omitted. It is recognized from other tables by matching ColumnInfo property names

| name     | type   |
| -------- | ------ |
| Name     | String |
| Alias    | String |

Possible column names are:

  name: string;
  className?: string;
  accessString?: string;
  generated?: boolean;
  index?: number;
  jsonName?: string;
  extendedType?: string;
  type?: string; // type is used on ECSqlStatement because it can differ from TypeName
  typeName?: string; // typeName is used on ConcurrentQuery only
  originPropertyName?: string // currently only used by statement (concurrent query does not provide the data)

As an alternative, column infos can be formatted as json in a code block like this:

```json
{
  "columns": [
    {
      "name": "c26",
      "originPropertyName": "c26",
      "type": "Boolean",
      "extendedType": "-"
    },
    {
      "name": "c27",
      "originPropertyName": "c27",
      "type": "Integer",
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

Check out the Examples.ecdbtest.md or other files in this directory.

## Test generator

There is a script which takes a statement as input and generates a test from it.
Check ECDbMarkdownTestGenerator.ts, it can be called like this:
`node lib\cjs\test\ecdb\ECDbMarkdownTestGenerator.js AllProperties.bim "SELECT * FROM meta.ECSchemaDef LIMIT 2" -t`
