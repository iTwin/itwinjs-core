# Readme for ECDb tests

> This file is the readme and at the same time would be a valid test. All files ending in .ecdbtest.md in the directory will be used.

> A header indicates a new test and is at the same time the title of the test. A file may contain multiple tests
> Regular text, blockquotes or html comments can be used to describe the test, they do not affect test execution
> properties go into list and follow the format: - key: value
> the dataset property specifies the bim file to open

- dataset: AllProperties.bim

> the .bim file can have a .props file alongside holding json, for example here AllProperties.bim.props
> The properties inside that json can be used in binders, statements and code blocks using this syntax: $(propName)

> To filter tests like the it.only feature in mocha, use this variable in your tests:
>
> - only: true

> first sql code block found after a header indicates the sql to execute

```sql
SELECT * from meta.ECSchemaDef LIMIT 5
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

| name     | type   |
| -------- | ------ |
| Name     | String |
| Alias    | String |

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
