# json_extract

- dataset: AllProperties.bim

```sql
SELECT
  te.ECInstanceId,
  json_extract(te.j, '$.A') AS A_value
FROM
  aps.TestElement te
WHERE
  json_extract(te.j, '$.A') IS NOT NULL;
```

```json
{
  "columns": [
    {
      "className": "",
      "accessString": "ECInstanceId",
      "generated": false,
      "index": 0,
      "jsonName": "id",
      "name": "ECInstanceId",
      "extendedType": "Id",
      "typeName": "long",
      "type": "Id",
      "originPropertyName": "ECInstanceId"
    },
    {
      "className": "",
      "accessString": "A_value",
      "generated": true,
      "index": 1,
      "jsonName": "a_value",
      "name": "A_value",
      "typeName": "string",
      "type": "String"
    }
  ]
}
```

```json
[
  {
    "ECInstanceId": "0x14",
    "A_value": "0"
  }
]
```

# json_extract more columns

- dataset: AllProperties.bim

```sql
SELECT
  te.ECInstanceId,
  json_extract(te.j, '$.A') AS A_value,
  json_extract(te.j, '$.B') AS B_value,
  json_extract(te.j, '$.C') AS C_value,
  json_extract(te.j, '$.D') AS D_value
FROM
  aps.TestElement te
LIMIT
  5;
```

```json
{
  "columns": [
    {
      "className": "",
      "accessString": "ECInstanceId",
      "generated": false,
      "index": 0,
      "jsonName": "id",
      "name": "ECInstanceId",
      "extendedType": "Id",
      "typeName": "long",
      "type": "Id",
      "originPropertyName": "ECInstanceId"
    },
    {
      "className": "",
      "accessString": "A_value",
      "generated": true,
      "index": 1,
      "jsonName": "a_value",
      "name": "A_value",
      "typeName": "string",
      "type": "String"
    },
    {
      "className": "",
      "accessString": "B_value",
      "generated": true,
      "index": 2,
      "jsonName": "b_value",
      "name": "B_value",
      "typeName": "string",
      "type": "String"
    },
    {
      "className": "",
      "accessString": "C_value",
      "generated": true,
      "index": 3,
      "jsonName": "c_value",
      "name": "C_value",
      "typeName": "string",
      "type": "String"
    },
    {
      "className": "",
      "accessString": "D_value",
      "generated": true,
      "index": 4,
      "jsonName": "d_value",
      "name": "D_value",
      "typeName": "string",
      "type": "String"
    }
  ]
}
```

```json
[
  {
    "ECInstanceId": "0x14",
    "A_value": "0"
  },
  {
    "ECInstanceId": "0x15",
    "B_value": "1"
  },
  {
    "ECInstanceId": "0x16",
    "C_value": "2"
  },
  {
    "ECInstanceId": "0x17",
    "D_value": "3"
  },
  {
    "ECInstanceId": "0x18"
  }
]
```

# json_each with hardcoded JSON stirng

- dataset: AllProperties.bim

```sql
SELECT * FROM json1.json_each('{foo:1, goo:2}');
```

```json
{
  "columns": [
    {
      "className": "json1:json_each",
      "accessString": "key",
      "generated": false,
      "index": 0,
      "jsonName": "key",
      "name": "key",
      "typeName": "string",
      "type": "String",
      "originPropertyName": "key"
    },
    {
      "className": "json1:json_each",
      "accessString": "value",
      "generated": false,
      "index": 1,
      "jsonName": "value",
      "name": "value",
      "typeName": "string",
      "type": "String",
      "originPropertyName": "value"
    },
    {
      "className": "json1:json_each",
      "accessString": "type",
      "generated": false,
      "index": 2,
      "jsonName": "type",
      "name": "type",
      "typeName": "string",
      "type": "String",
      "originPropertyName": "type"
    },
    {
      "className": "json1:json_each",
      "accessString": "atom",
      "generated": false,
      "index": 3,
      "jsonName": "atom",
      "name": "atom",
      "typeName": "string",
      "type": "String",
      "originPropertyName": "atom"
    },
    {
      "className": "json1:json_each",
      "accessString": "parent",
      "generated": false,
      "index": 4,
      "jsonName": "parent",
      "name": "parent",
      "typeName": "int",
      "type": "Int",
      "originPropertyName": "parent"
    },
    {
      "className": "json1:json_each",
      "accessString": "fullkey",
      "generated": false,
      "index": 5,
      "jsonName": "fullkey",
      "name": "fullkey",
      "typeName": "string",
      "type": "String",
      "originPropertyName": "fullkey"
    },
    {
      "className": "json1:json_each",
      "accessString": "path",
      "generated": false,
      "index": 6,
      "jsonName": "path",
      "name": "path",
      "typeName": "string",
      "type": "String",
      "originPropertyName": "path"
    }
  ]
}
```

```json
[
  {
    "key": "foo",
    "value": "1",
    "type": "integer",
    "atom": "1",
    "fullkey": "$.foo",
    "path": "$"
  },
  {
    "key": "goo",
    "value": "2",
    "type": "integer",
    "atom": "2",
    "fullkey": "$.goo",
    "path": "$"
  }
]
```

# json_each nested JSON
- dataset: AllProperties.bim

```sql
SELECT * FROM json1.json_each('{A: {nestedKey: 10}, B: 1}');
```

```json
{
  "columns": [
    {
      "className": "json1:json_each",
      "accessString": "key",
      "generated": false,
      "index": 0,
      "jsonName": "key",
      "name": "key",
      "typeName": "string",
      "type": "String",
      "originPropertyName": "key"
    },
    {
      "className": "json1:json_each",
      "accessString": "value",
      "generated": false,
      "index": 1,
      "jsonName": "value",
      "name": "value",
      "typeName": "string",
      "type": "String",
      "originPropertyName": "value"
    },
    {
      "className": "json1:json_each",
      "accessString": "type",
      "generated": false,
      "index": 2,
      "jsonName": "type",
      "name": "type",
      "typeName": "string",
      "type": "String",
      "originPropertyName": "type"
    },
    {
      "className": "json1:json_each",
      "accessString": "atom",
      "generated": false,
      "index": 3,
      "jsonName": "atom",
      "name": "atom",
      "typeName": "string",
      "type": "String",
      "originPropertyName": "atom"
    },
    {
      "className": "json1:json_each",
      "accessString": "parent",
      "generated": false,
      "index": 4,
      "jsonName": "parent",
      "name": "parent",
      "typeName": "int",
      "type": "Int",
      "originPropertyName": "parent"
    },
    {
      "className": "json1:json_each",
      "accessString": "fullkey",
      "generated": false,
      "index": 5,
      "jsonName": "fullkey",
      "name": "fullkey",
      "typeName": "string",
      "type": "String",
      "originPropertyName": "fullkey"
    },
    {
      "className": "json1:json_each",
      "accessString": "path",
      "generated": false,
      "index": 6,
      "jsonName": "path",
      "name": "path",
      "typeName": "string",
      "type": "String",
      "originPropertyName": "path"
    }
  ]
}
```

```json
[
  {
    "key": "A",
    "value": "{\"nestedKey\":10}",
    "type": "object",
    "fullkey": "$.A",
    "path": "$"
  },
  {
    "key": "B",
    "value": "1",
    "type": "integer",
    "atom": "1",
    "fullkey": "$.B",
    "path": "$"
  }
]
```

# json_tree nested JSON

- dataset: AllProperties.bim

- dataset: AllProperties.bim

```sql
SELECT * FROM json1.json_tree('{A: {nestedKey: 10}, B: 1}');
```

```json
{
  "columns": [
    {
      "className": "json1:json_tree",
      "accessString": "key",
      "generated": false,
      "index": 0,
      "jsonName": "key",
      "name": "key",
      "typeName": "string",
      "type": "String",
      "originPropertyName": "key"
    },
    {
      "className": "json1:json_tree",
      "accessString": "value",
      "generated": false,
      "index": 1,
      "jsonName": "value",
      "name": "value",
      "typeName": "string",
      "type": "String",
      "originPropertyName": "value"
    },
    {
      "className": "json1:json_tree",
      "accessString": "type",
      "generated": false,
      "index": 2,
      "jsonName": "type",
      "name": "type",
      "typeName": "string",
      "type": "String",
      "originPropertyName": "type"
    },
    {
      "className": "json1:json_tree",
      "accessString": "atom",
      "generated": false,
      "index": 3,
      "jsonName": "atom",
      "name": "atom",
      "typeName": "string",
      "type": "String",
      "originPropertyName": "atom"
    },
    {
      "className": "json1:json_tree",
      "accessString": "parent",
      "generated": false,
      "index": 4,
      "jsonName": "parent",
      "name": "parent",
      "typeName": "int",
      "type": "Int",
      "originPropertyName": "parent"
    },
    {
      "className": "json1:json_tree",
      "accessString": "fullkey",
      "generated": false,
      "index": 5,
      "jsonName": "fullkey",
      "name": "fullkey",
      "typeName": "string",
      "type": "String",
      "originPropertyName": "fullkey"
    },
    {
      "className": "json1:json_tree",
      "accessString": "path",
      "generated": false,
      "index": 6,
      "jsonName": "path",
      "name": "path",
      "typeName": "string",
      "type": "String",
      "originPropertyName": "path"
    }
  ]
}
```

```json
[
  {
    "value": "{\"A\":{\"nestedKey\":10},\"B\":1}",
    "type": "object",
    "fullkey": "$",
    "path": "$"
  },
  {
    "key": "A",
    "value": "{\"nestedKey\":10}",
    "type": "object",
    "parent": 0,
    "fullkey": "$.A",
    "path": "$"
  },
  {
    "key": "nestedKey",
    "value": "10",
    "type": "integer",
    "atom": "10",
    "parent": 2,
    "fullkey": "$.A.nestedKey",
    "path": "$.A"
  },
  {
    "key": "B",
    "value": "1",
    "type": "integer",
    "atom": "1",
    "parent": 0,
    "fullkey": "$.B",
    "path": "$"
  }
]
```