Copyright © Bentley Systems, Incorporated. All rights reserved. See [LICENSE.md](../../../../LICENSE.md) for license terms and full copyright notice.

# Select ECDb schemas from ECDbMeta using tables

- mode: Statement
- dataset: AllProperties.bim

```sql
Select s.Name, s.Alias from meta.ECSchemaDef s WHERE s.Name LIKE 'ECDb%' LIMIT 4;
```

| name  | type   |
| ----- | ------ |
| Name  | String |
| Alias | String |

| Name               | Alias   |
| ------------------ | ------- |
| ECDbFileInfo       | ecdbf   |
| ECDbMap            | ecdbmap |
| ECDbMeta           | meta    |
| ECDbSchemaPolicies | ecdbpol |

# Select Test elements from sample dataset using Json

- dataset: AllProperties.bim

```sql
SELECT ec_classname(e.ECClassId) as ClassName, e.DirectStr FROM aps.TestElement e WHERE e.DirectLong > 1005 ORDER BY e.DirectLong LIMIT 2
```

```json
{
  "columns": [
    {
      "className": "",
      "accessString": "ClassName",
      "generated": true,
      "index": 0,
      "jsonName": "className",
      "name": "ClassName",
      "typeName": "string",
      "type": "String"
    },
    {
      "className": "AllProperties:TestElement",
      "accessString": "DirectStr",
      "generated": false,
      "index": 1,
      "jsonName": "directStr",
      "name": "DirectStr",
      "typeName": "string",
      "type": "String",
      "originPropertyName": "DirectStr"
    }
  ]
}
```

```json
[
  {
    "ClassName": "AllProperties:TestElement",
    "DirectStr": "str6"
  },
  {
    "ClassName": "AllProperties:TestElement",
    "DirectStr": "str7"
  }
]
```

# Select Test elements from sample dataset with convertClassIdsToClassNames flag using Json

- dataset: AllProperties.bim
- convertClassIdsToClassNames: true

```sql
SELECT e.ECClassId, e.DirectStr FROM aps.TestElement e WHERE e.DirectLong > 1005 ORDER BY e.DirectLong LIMIT 2
```

```json
{
  "columns": [
    {
      "accessString": "ECClassId",
      "name": "ECClassId",
      "type": "Id",
      "typeName": "long",
      "generated": false,
      "extendedType": "ClassId"
    },
    {
      "accessString": "DirectStr",
      "name": "DirectStr",
      "type": "String",
      "typeName": "string",
      "generated": false
    }
  ]
}
```

```json
[
  {
    "ECClassId": "AllProperties.TestElement",
    "DirectStr": "str6"
  },
  {
    "ECClassId": "AllProperties.TestElement",
    "DirectStr": "str7"
  }
]
```
