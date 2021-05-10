# StyleOverride Customization Rule

> Based on [StyleOverride]($presentation-common) interface.

Style override rules allow customizing display style of specific types of ECInstances.

## Attributes

Name | Required? | Type | Default | Meaning
-|-|-|-|-
*Filtering* |
`requiredSchemas` | No | [`RequiredSchemaSpecification[]`](../SchemaRequirements.md) | `[]` | Specifications that define schema requirements for the rule to take effect.
`priority` | No | `number` | `1000` | Defines the order in which presentation rules are evaluated.
`onlyIfNotHandled` | No | `boolean` | `false` | Should this rule be ignored if there is already an existing rule with a higher priority.
`condition` | No | [ECExpression](./ECExpressions.md#rule-condition) |`""` | Defines a condition for the rule, which needs to be met in order to execute it.
*Overrides* |
`foreColor` | No | [ECExpression](./ECExpressions.md#override-value) | `""` | An expression whose result evaluates to a [color value](#color-value-formats).
`backColor` | No | [ECExpression](./ECExpressions.md#override-value) | `""` | An expression whose result evaluates to a [color value](#color-value-formats).
`fontStyle` | No | [ECExpression](./ECExpressions.md#override-value) | `"Regular"` | An expression whose result evaluates to a [font style value](#font-styles).

### Color Value Formats

Colors in `foreColor` and `backColor` attributes may be evaluated to one of the following formats:

- color name: `Red`, `Blue`, etc.
- RGB: `rgb(100, 200, 255)`
- HEX: `#0f0f0f`

### Font Styles

Font style in `fontStyle` attribute may be evaluated to one of the following values:

- `Bold`
- `Italic`
- `Italic,Bold`
- `Regular`

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
