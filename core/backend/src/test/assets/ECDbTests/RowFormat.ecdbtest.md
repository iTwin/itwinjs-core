Copyright © Bentley Systems, Incorporated. All rights reserved. See [LICENSE.md](./LICENSE.md) for license terms and full copyright notice.

# Select ECDb schemas from ECDbMeta using tables but using ECSqlPropertyIndexes

- dataset: AllProperties.bim

```sql
Select s.Name, s.Alias from meta.ECSchemaDef s WHERE s.Name LIKE 'ECDb%' LIMIT 4;
```

## ECSqlStatement

```json
{
  "rowOptions": {
    "rowFormat": "useecsqlpropertyindexes"
  }
}
```

| AccessString | Type   |
| ------------ | ------ |
| Name         | String |
| Alias        | String |

|                    |         |
| ------------------ | ------- |
| ECDbFileInfo       | ecdbf   |
| ECDbMap            | ecdbmap |
| ECDbMeta           | meta    |
| ECDbSchemaPolicies | ecdbpol |

# Select Test elements from sample dataset using Json using ECSqlPropertyIndexes row option and also using tables to validate column metadata

- dataset: AllProperties.bim

```sql
SELECT e.ECClassId, e.DirectStr FROM aps.TestElement e WHERE e.DirectLong > 1005 ORDER BY e.DirectLong LIMIT 2
```

## ECSqlStatement

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
      "propertyName": "ECClassId",
      "originPropertyName": "ECClassId",
      "rootClassAlias": "e",
      "rootClassName": "AllProperties.TestElement",
      "rootClassTableSpace": "main",
      "type": "Id",
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
      "type": "String",
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
  ["$(testElementClassId)", "str6"],
  ["$(testElementClassId)", "str7"]
]
```

## Concurrent Query

```json
{
  "rowOptions": {
    "rowFormat": "useecsqlpropertyindexes"
  }
}
```

| Name      | ClassName                 | AccessString | JsonName  | TypeName | Generated | Index |
| --------- | ------------------------- | ------------ | --------- | -------- | --------- | ----- |
| ECClassId |                           | ECClassId    | className | long     | false     | 0     |
| DirectStr | AllProperties:TestElement | DirectStr    | directStr | string   | false     | 1     |

|       |      |
| ----- | ---- |
| 0x152 | str6 |
| 0x152 | str7 |
