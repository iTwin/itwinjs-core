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
    "ECClassId": "0x152",
    "DirectStr": "str6"
  },
  {
    "ECClassId": "0x152",
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
