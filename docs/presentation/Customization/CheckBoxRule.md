# CheckBox rule

> **Note:** This rule is deprecated. Use [extended data](./ExtendedDataUsage.md#customize-tree-node-item-checkbox) instead.

> TypeScript type: [CheckBoxRule]($presentation-common).

CheckBox rules provide a way to create a checkbox for specific types of ECInstance's.

## Attributes

| Name                                                              | Required? | Type                                                                 | Default     |
| ----------------------------------------------------------------- | --------- | -------------------------------------------------------------------- | ----------- |
| *Filtering*                                                       |
| [`requiredSchemas`](#attribute-requiredschemas)                   | No        | [`RequiredSchemaSpecification[]`](../RequiredSchemaSpecification.md) | `[]`        |
| [`priority`](#attribute-priority)                                 | No        | `number`                                                             | `1000`      |
| [`onlyIfNotHandled`](#attribute-onlyifnothandled)                 | No        | `boolean`                                                            | `false`     |
| [`condition`](#attribute-condition)                               | No        | [ECExpression](./ECExpressions.md#rule-condition)                    | `""`        |
| *CheckBox Attributes*                                             |
| [`propertyName`](#attribute-propertyname)                         | No        | `string`                                                             | `undefined` |
| [`useInversedPropertyValue`](#attribute-useinversedpropertyvalue) | No        | `boolean`                                                            | `false`     |
| [`defaultValue`](#attribute-defaultvalue)                         | No        | `boolean`                                                            | `false`     |
| [`isEnabled`](#attribute-isenabled)                               | No        | `boolean`                                                            | `true`      |

### Attribute: `requiredSchemas`

Specifications that define [ECSchema requirements](../RequiredSchemaSpecification.md) for the rule to take effect.

|                   |                                                                      |
| ----------------- | -------------------------------------------------------------------- |
| **Type**          | [`RequiredSchemaSpecification[]`](../RequiredSchemaSpecification.md) |
| **Is Required**   | No                                                                   |
| **Default Value** | `[]`                                                                 |

### Attribute: `priority`

Defines the order in which presentation rules are evaluated.

|                   |          |
| ----------------- | -------- |
| **Type**          | `number` |
| **Is Required**   | No       |
| **Default Value** | `1000`   |

### Attribute: `onlyIfNotHandled`

Should this rule be ignored if there is already an existing rule with a higher priority.

|                   |           |
| ----------------- | --------- |
| **Type**          | `boolean` |
| **Is Required**   | No        |
| **Default Value** | `false`   |

### Attribute: `condition`

Defines a condition for the rule, which needs to be met in order to execute it.

|                   |                                                   |
| ----------------- | ------------------------------------------------- |
| **Type**          | [ECExpression](./ECExpressions.md#rule-condition) |
| **Is Required**   | No                                                |
| **Default Value** | `""`                                              |

### Attribute: `propertyName`

Name of boolean type ECProperty which is bound with the check box state. When set, property value gets bound to checkbox state.

|                   |             |
| ----------------- | ----------- |
| **Type**          | `string`    |
| **Is Required**   | No          |
| **Default Value** | `undefined` |

### Attribute: `useInversedPropertyValue`

Should property value be inversed for the check box state. **Note:** Only makes sense when bound to an ECProperty.

|                   |           |
| ----------------- | --------- |
| **Type**          | `boolean` |
| **Is Required**   | No        |
| **Default Value** | `false`   |

### Attribute: `defaultValue`

Default value to use for the check box state. **Note:** Only makes sense when *not* bound to an ECProperty.

|                   |           |
| ----------------- | --------- |
| **Type**          | `boolean` |
| **Is Required**   | No        |
| **Default Value** | `false`   |

### Attribute: `isEnabled`

Indicates whether check box is enabled or disabled.

|                   |           |
| ----------------- | --------- |
| **Type**          | `boolean` |
| **Is Required**   | No        |
| **Default Value** | `true`    |

## Example

```JSON
{
  "ruleType": "CheckBox",
  "priority": 999,
  "stopFurtherProcessing": true,
  "requiredSchemas": [{ "name": "MySchema", "minVersion": "1.2.3" }],
  "condition": "ThisNode.IsOfClass(\"MyItem\", \"MySchema\")",
  "propertyName": "MyProperty",
  "useInversedPropertyValue": true,
  "isEnabled": false
}
```
