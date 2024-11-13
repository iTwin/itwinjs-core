Copyright © Bentley Systems, Incorporated. All rights reserved. See [LICENSE.md](../../../../LICENSE.md) for license terms and full copyright notice.

# Select ECDb schemas from ECDbMeta using tables

- Mode: ECSqlStatement
- dataset: AllProperties.bim

```sql
Select s.Name, s.Alias from meta.ECSchemaDef s WHERE s.Name LIKE 'ECDb%' LIMIT 4;
```

```json
{
  "rowOptions": {
    "rowFormat": "useECsqlPropertyNames"
  }
}
```

| PropName | Type   |
| -------- | ------ |
| Name     | String |
| Alias    | String |

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
  "rowOptions": {
    "rowFormat": "useECsqlPropertyNames"
  }
}
```

```json
{
  "columns": [
    {
      "accessString": "ECClassId",
      "propName": "ECClassId",
      "type": "Id",
      "typeName": "long",
      "isGeneratedProperty": false
    },
    {
      "accessString": "DirectStr",
      "propName": "DirectStr",
      "type": "String",
      "typeName": "string",
      "isGeneratedProperty": false
    }
  ]
}
```

```json
[
  {
    "ECClassId": "$(testElementClassId)",
    "DirectStr": "str6"
  },
  {
    "ECClassId": "$(testElementClassId)",
    "DirectStr": "str7"
  }
]
```
