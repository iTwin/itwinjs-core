# Select ECDb schemas from ECDbMeta using tables

- dataset: AllProperties.bim

```sql
Select s.Name, s.Alias from meta.ECSchemaDef s WHERE s.Name LIKE 'ECDb%' LIMIT 4;
```

| AccessString | Type    |
|--------------|---------|
| Name         | String  |
| Alias        | String  |

| Name              | Alias   |
|-------------------|---------|
| ECDbFileInfo      | ecdbf   |
| ECDbMap           | ecdbmap |
| ECDbMeta          | meta    |
| ECDbSchemaPolicies| ecdbpol |

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
      "propertyName": "ECClassId",
      "originPropertyName": "ECClassId",
      "rootClassAlias": "e",
      "rootClassName": "AllProperties.TestElement",
      "rootClassTableSpace": "main",
      "type":"Id",
      "isEnum": false,
      "isGeneratedProperty": false,
      "isSystemProperty": true,
      "isDynamicProp": false
    },
    {
      "accessString": "DirectStr",
      "propertyName": "DirectStr",
      "originPropertyName": "DirectStr",
      "rootClassAlias": "e",
      "rootClassName": "AllProperties.TestElement",
      "rootClassTableSpace": "main",
      "type":"String",
      "isEnum": false,
      "isGeneratedProperty": false,
      "isSystemProperty": false,
      "isDynamicProp": false
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
