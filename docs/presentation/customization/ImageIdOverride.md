# Image ID override

> **Note:** This rule is deprecated. Use [extended data](./ExtendedDataUsage.md#customize-tree-node-item-icon) instead.

> TypeScript type: [ImageIdOverride]($presentation-common).

ImageId override rules allow setting an image ID to specific types of ECInstances.

## Attributes

| Name                                                | Required? | Type                                                                 | Default |
| --------------------------------------------------- | --------- | -------------------------------------------------------------------- | ------- |
| *Filtering*                                         |
| [`requiredSchemas`](#attribute-requiredschemas)     | No        | [`RequiredSchemaSpecification[]`](../RequiredSchemaSpecification.md) | `[]`    |
| [`priority`](#attribute-priority)                   | No        | `number`                                                             | `1000`  |
| [`onlyIfNotHandled`](#attribute-onlyifnothandled)   | No        | `boolean`                                                            | `false` |
| [`condition`](#attribute-condition)                 | No        | [ECExpression](./ECExpressions.md#rule-condition)                    | `""`    |
| [`imageIdExpression`](#attribute-imageidexpression) | Yes       | [ECExpression](./ECExpressions.md#override-value)                    |         |

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

### Attribute: `imageIdExpression`

An expression whose result becomes the image ID.

|                 |                                                   |
| --------------- | ------------------------------------------------- |
| **Type**        | [ECExpression](./ECExpressions.md#override-value) |
| **Is Required** | Yes                                               |

## Example

```JSON
{
  "ruleType": "ImageIdOverride",
  "requiredSchemas": [{ "name": "MySchema", "minVersion": "1.2.3" }],
  "priority": 999,
  "stopFurtherProcessing": true,
  "condition": "ThisNode.IsOfClass(\"MyItem\", \"MySchema\")",
  "imageIdExpression": "\"ImageId_\" & this.MyProperty"
}
```
