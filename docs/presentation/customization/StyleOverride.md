# Style override

> **Note:** This rule is deprecated. Use [extended data](./ExtendedDataUsage.md#customize-tree-node-item-style) instead.

> TypeScript type: [StyleOverride]($presentation-common).

Style override rules allow customizing display style of specific types of ECInstances.

## Attributes

| Name                                              | Required? | Type                                                                 | Default     |
| ------------------------------------------------- | --------- | -------------------------------------------------------------------- | ----------- |
| *Filtering*                                       |
| [`requiredSchemas`](#attribute-requiredschemas)   | No        | [`RequiredSchemaSpecification[]`](../RequiredSchemaSpecification.md) | `[]`        |
| [`priority`](#attribute-priority)                 | No        | `number`                                                             | `1000`      |
| [`onlyIfNotHandled`](#attribute-onlyifnothandled) | No        | `boolean`                                                            | `false`     |
| [`condition`](#attribute-condition)               | No        | [ECExpression](./ECExpressions.md#rule-condition)                    | `""`        |
| *Overrides*                                       |
| [`foreColor`](#attribute-forecolor)               | No        | [ECExpression](./ECExpressions.md#override-value)                    | `""`        |
| [`backColor`](#attribute-backcolor)               | No        | [ECExpression](./ECExpressions.md#override-value)                    | `""`        |
| [`fontStyle`](#attribute-fontstyle)               | No        | [ECExpression](./ECExpressions.md#override-value)                    | `"Regular"` |

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

### Attribute: `foreColor`

An expression whose result evaluates to a [color value](#color-value-formats).

|                   |                                                   |
| ----------------- | ------------------------------------------------- |
| **Type**          | [ECExpression](./ECExpressions.md#override-value) |
| **Is Required**   | No                                                |
| **Default Value** | `""`                                              |

### Attribute: `backColor`

An expression whose result evaluates to a [color value](#color-value-formats).

|                   |                                                   |
| ----------------- | ------------------------------------------------- |
| **Type**          | [ECExpression](./ECExpressions.md#override-value) |
| **Is Required**   | No                                                |
| **Default Value** | `""`                                              |

### Attribute: `fontStyle`

An expression whose result evaluates to a [font style value](#font-styles).

|                   |                                                   |
| ----------------- | ------------------------------------------------- |
| **Type**          | [ECExpression](./ECExpressions.md#override-value) |
| **Is Required**   | No                                                |
| **Default Value** | `"Regular"`                                       |

#### Font styles

Font style in `fontStyle` attribute may be evaluated to one of the following values:

- `Bold`
- `Italic`
- `Italic,Bold`
- `Regular`

### Color value formats

Colors in `foreColor` and `backColor` attributes may be evaluated to one of the following formats:

- color name: `Red`, `Blue`, etc.
- RGB: `rgb(100, 200, 255)`
- HEX: `#0f0f0f`

## Example

```JSON
{
  "ruleType": "ImageIdOverride",
  "requiredSchemas": [{ "name": "MySchema", "minVersion": "1.2.3" }],
  "priority": 999,
  "stopFurtherProcessing": true,
  "condition": "ThisNode.IsOfClass(\"MyItem\", \"MySchema\")",
  "foreColor": "\"Black\"",
  "backColor": "iif(this.MyProperty, \"#ff0000\", \"rgb(0,255,255)\")",
  "fontStyle": "\"Italic,Bold\""
}
```
