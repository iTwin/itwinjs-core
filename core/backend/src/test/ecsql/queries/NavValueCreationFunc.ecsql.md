Copyright © Bentley Systems, Incorporated. All rights reserved. See [LICENSE.md](../../../../LICENSE.md) for license terms and full copyright notice.

# With all 3 arguments and hex ids

- dataset: AllProperties.bim

```sql
select navigation_value(aps.TestFeature.FeatureUsesElement, 0x1d, 0x155)
```

```json
{
  "columns": [
    {
      "className": "",
      "accessString": "FeatureUsesElement",
      "generated": true,
      "index": 0,
      "jsonName": "FeatureUsesElement",
      "name": "FeatureUsesElement",
      "typeName": "navigation",
      "type": "Navigation",
      "originPropertyName": "FeatureUsesElement"
    }
  ]
}
```

```json
[
  {
    "FeatureUsesElement": {
      "Id": "0x1d",
      "RelECClassId": "0x155"
    }
  }
]
```

# With only navigation property and hex instance id

- dataset: AllProperties.bim

```sql
select navigation_value(aps.TestFeature.FeatureUsesElement, 0x1c)
```

```json
{
  "columns": [
    {
      "className": "",
      "accessString": "FeatureUsesElement",
      "generated": true,
      "index": 0,
      "jsonName": "FeatureUsesElement",
      "name": "FeatureUsesElement",
      "typeName": "navigation",
      "type": "Navigation",
      "originPropertyName": "FeatureUsesElement"
    }
  ]
}
```

```json
[
  {
    "FeatureUsesElement": {
      "Id": "0x1c",
      "RelECClassId": "0x158"
    }
  }
]
```

# With all 3 arguments and decimal ids

- dataset: AllProperties.bim

```sql
select navigation_value(aps.TestFeature.FeatureUsesElement, 29, 341)
```

```json
{
  "columns": [
    {
      "className": "",
      "accessString": "FeatureUsesElement",
      "generated": true,
      "index": 0,
      "jsonName": "FeatureUsesElement",
      "name": "FeatureUsesElement",
      "typeName": "navigation",
      "type": "Navigation",
      "originPropertyName": "FeatureUsesElement"
    }
  ]
}
```

```json
[
  {
    "FeatureUsesElement": {
      "Id": "0x1d",
      "RelECClassId": "0x155"
    }
  }
]
```

# With only navigation property and decimal instance id arguments

- dataset: AllProperties.bim

```sql
select navigation_value(aps.TestFeature.FeatureUsesElement, 29)
```

```json
{
  "columns": [
    {
      "className": "",
      "accessString": "FeatureUsesElement",
      "generated": true,
      "index": 0,
      "jsonName": "FeatureUsesElement",
      "name": "FeatureUsesElement",
      "typeName": "navigation",
      "type": "Navigation",
      "originPropertyName": "FeatureUsesElement"
    }
  ]
}
```

```json
[
  {
    "FeatureUsesElement": {
      "Id": "0x1d",
      "RelECClassId": "0x158"
    }
  }
]
```

# With binders and hex ids

- dataset: AllProperties.bim

```sql
select navigation_value(aps.TestFeature.FeatureUsesElement, ?, ?)
```

- bindId 1, 0x1d
- bindId 2, 0x155

```json
{
  "columns": [
    {
      "className": "",
      "accessString": "FeatureUsesElement",
      "generated": true,
      "index": 0,
      "jsonName": "FeatureUsesElement",
      "name": "FeatureUsesElement",
      "typeName": "navigation",
      "type": "Navigation",
      "originPropertyName": "FeatureUsesElement"
    }
  ]
}
```

```json
[
  {
    "FeatureUsesElement": {
      "Id": "0x1d",
      "RelECClassId": "0x155"
    }
  }
]
```

# With binders and decimal ids

- dataset: AllProperties.bim

```sql
select navigation_value(aps.TestFeature.FeatureUsesElement, ?, ?)
```

- bindId 1, 29
- bindId 2, 341

```json
{
  "columns": [
    {
      "className": "",
      "accessString": "FeatureUsesElement",
      "generated": true,
      "index": 0,
      "jsonName": "featureUsesElement",
      "name": "FeatureUsesElement",
      "typeName": "navigation",
      "type": "Navigation",
      "originPropertyName": "FeatureUsesElement"
    }
  ]
}
```

```json
[
  {
    "FeatureUsesElement": {
      "Id": "0x1d",
      "RelECClassId": "0x155"
    }
  }
]
```

# With actual navigation property row values

- dataset: AllProperties.bim

```sql
SELECT
  navigation_value (
    aps.TestFeature.FeatureUsesElement,
    FeatureUsesElement.Id,
    FeatureUsesElement.RelECClassId
  )
FROM
  aps.TestFeature
```

```json
{
  "columns": [
    {
      "className": "",
      "accessString": "FeatureUsesElement",
      "generated": true,
      "index": 0,
      "jsonName": "featureUsesElement",
      "name": "FeatureUsesElement",
      "typeName": "navigation",
      "type": "Navigation",
      "originPropertyName": "FeatureUsesElement"
    }
  ]
}
```

```json
[
  {
    "FeatureUsesElement": {
      "Id": "0x1d",
      "RelECClassId": "0x158"
    }
  },
  {
    "FeatureUsesElement": {
      "Id": "0x1c",
      "RelECClassId": "0x158"
    }
  }
]
```

# With duplicate navigation properties

- dataset: AllProperties.bim

```sql
SELECT
  NAVIGATION_VALUE (aps.TestFeature.FeatureUsesElement, 0x1c, 0x155),
  NAVIGATION_VALUE (aps.TestFeature.FeatureUsesElement, 28, 341)
```

```json
{
  "columns": [
    {
      "className": "",
      "accessString": "FeatureUsesElement",
      "generated": true,
      "index": 0,
      "jsonName": "FeatureUsesElement",
      "name": "FeatureUsesElement",
      "typeName": "navigation",
      "type": "Navigation",
      "originPropertyName": "FeatureUsesElement"
    },
    {
      "className": "",
      "accessString": "FeatureUsesElement_1",
      "generated": true,
      "index": 1,
      "jsonName": "FeatureUsesElement_1",
      "name": "FeatureUsesElement_1",
      "typeName": "navigation",
      "type": "Navigation",
      "originPropertyName": "FeatureUsesElement"
    }
  ]
}
```

```json
[
  {
    "FeatureUsesElement": {
      "Id": "0x1c",
      "RelECClassId": "0x155"
    },
    "FeatureUsesElement_1": {
      "Id": "0x1c",
      "RelECClassId": "0x155"
    }
  }
]
```

# Check fields directly

- dataset: AllProperties.bim

```sql
SELECT
  FeatureUsesElement,
  FeatureUsesElement.Id,
  FeatureUsesElement.RelECClassId
FROM
  aps.TestFeature
```

```json
{
  "columns": [
    {
      "className": "AllProperties:TestFeature",
      "accessString": "FeatureUsesElement",
      "generated": false,
      "index": 0,
      "jsonName": "featureUsesElement",
      "name": "FeatureUsesElement",
      "typeName": "navigation",
      "type": "Navigation",
      "originPropertyName": "FeatureUsesElement"
    },
    {
      "className": "",
      "accessString": "FeatureUsesElement.Id",
      "generated": false,
      "index": 1,
      "jsonName": "featureUsesElement.id",
      "name": "Id",
      "extendedType": "NavId",
      "typeName": "long",
      "type": "Id",
      "originPropertyName": "Id"
    },
    {
      "className": "",
      "accessString": "FeatureUsesElement.RelECClassId",
      "generated": false,
      "index": 2,
      "jsonName": "featureUsesElement.relClassName",
      "name": "RelECClassId",
      "extendedType": "NavRelClassId",
      "typeName": "long",
      "type": "Id",
      "originPropertyName": "RelECClassId"
    }
  ]
}
```

```json
[
  {
    "FeatureUsesElement": {
      "Id": "0x1d",
      "RelECClassId": "0x158"
    },
    "Id": "0x1d",
    "RelECClassId": "0x158"
  },
  {
    "FeatureUsesElement": {
      "Id": "0x1c",
      "RelECClassId": "0x158"
    },
    "Id": "0x1c",
    "RelECClassId": "0x158"
  }
]
```

# With navigation value function in from clause

- dataset: AllProperties.bim

```sql
SELECT
  FeatureUsesElement,
  FeatureUsesElement.Id AS featureId,
  FeatureUsesElement.RelECClassId AS featureRelClassId
FROM
  (
    SELECT
      navigation_value (aps.TestFeature.FeatureUsesElement, 0x1d, 0x155)
  )
WHERE
  FeatureUsesElement.RelECClassId = 0x155
```

```json
{
  "columns": [
    {
      "className": "",
      "accessString": "FeatureUsesElement",
      "generated": true,
      "index": 0,
      "jsonName": "featureUsesElement",
      "name": "FeatureUsesElement",
      "typeName": "navigation",
      "type": "Navigation"
    },
    {
      "className": "",
      "accessString": "featureId",
      "generated": true,
      "index": 1,
      "jsonName": "featureId",
      "name": "featureId",
      "extendedType": "NavId",
      "typeName": "long",
      "type": "Id"
    },
    {
      "className": "",
      "accessString": "featureRelClassId",
      "generated": true,
      "index": 2,
      "jsonName": "featureRelClassId",
      "name": "featureRelClassId",
      "extendedType": "NavRelClassId",
      "typeName": "long",
      "type": "Id"
    }
  ]
}
```

```json
[
  {
    "FeatureUsesElement": {
      "Id": "0x1d",
      "RelECClassId": "0x155"
    },
    "featureId": "0x1d",
    "featureRelClassId": "0x155"
  }
]
```

# With navigation value function with subquery as arguments

- dataset: AllProperties.bim

```sql
SELECT
  NAVIGATION_VALUE (
    aps.TestFeature.FeatureUsesElement,
    (
      SELECT
        FeatureUsesElement.Id
      FROM
        aps.TestFeature
      WHERE
        FeatureUsesElement.RelECClassId = 0x158
      LIMIT
        1
      OFFSET
        1
    ),
    (
      SELECT
        FeatureUsesElement.RelECClassId
      FROM
        aps.TestFeature
      WHERE
        FeatureUsesElement.Id = 0x1d
    )
  )
```

```json
{
  "columns": [
    {
      "className": "",
      "accessString": "FeatureUsesElement",
      "generated": true,
      "index": 0,
      "jsonName": "FeatureUsesElement",
      "name": "FeatureUsesElement",
      "typeName": "navigation",
      "type": "Navigation",
      "originPropertyName": "FeatureUsesElement"
    }
  ]
}
```

```json
[
  {
    "FeatureUsesElement": {
      "Id": "0x1c",
      "RelECClassId": "0x158"
    }
  }
]
```
