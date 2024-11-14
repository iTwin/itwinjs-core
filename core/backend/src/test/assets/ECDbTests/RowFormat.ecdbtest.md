Copyright © Bentley Systems, Incorporated. All rights reserved. See [LICENSE.md](../../../../LICENSE.md) for license terms and full copyright notice.

# Select ECDb schemas from ECDbMeta using tables but using ECSqlPropertyIndexes

- Mode: ECSqlStatement
- dataset: AllProperties.bim

```sql
Select s.Name, s.Alias from meta.ECSchemaDef s WHERE s.Name LIKE 'ECDb%' LIMIT 4;
```

```json
{
  "rowOptions": {
    "rowFormat": "useecsqlpropertyindexes"
  }
}
```

| name     | type   |
| -------- | ------ |
| Name     | String |
| Alias    | String |

|                    |         |
| ------------------ | ------- |
| ECDbFileInfo       | ecdbf   |
| ECDbMap            | ecdbmap |
| ECDbMeta           | meta    |
| ECDbSchemaPolicies | ecdbpol |

# Select Test elements from sample dataset using Json using ECSqlPropertyIndexes row option

- dataset: AllProperties.bim

```sql
SELECT e.ECClassId, e.DirectStr FROM aps.TestElement e WHERE e.DirectLong > 1005 ORDER BY e.DirectLong LIMIT 2
```

```json
{
  "rowOptions": {
    "rowFormat": "useecsqlpropertyindexes"
  }
}
```

```json
{
  "columns": [
    {
      "accessString": "ECClassId",
      "name": "ECClassId",
      "type": "Id",
      "typeName": "long",
      "generated": false
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
  ["$(testElementClassId)", "str6"],
  ["$(testElementClassId)", "str7"]
]
```
