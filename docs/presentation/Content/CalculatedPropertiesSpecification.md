# CalculatedProperties Content Modifier

> TypeScript type: [CalculatedPropertiesSpecification]($presentation-common).

This content modifier allows including additional calculated properties into the content.

## Attributes

| Name       | Required? | Type                                         | Default | Meaning                                                                                                                                                                                                                |
| ---------- | --------- | -------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `label`    | Yes       | `string`                                     |         | Label of the calculated property. Supports [localization](../Advanced/Localization.md).                                                                                                                                |
| `value`    | Yes       | [ECExpression](../Advanced/ECExpressions.md) |         | Expression to calculate the value. The expression can use [ECInstance](../Advanced/ECExpressions.md#ecinstance) and [Ruleset Variables](../Advanced/ECExpressions.md#ruleset-variables-user-settings) symbol contexts. |
| `priority` | No        | `number`                                     | `1000`  | Priority of the property. Determines the position of this property in UI components - higher priority means the property should be more visible.                                                                       |

## Example

```JSON
{
  "priority": 9999,
  "label": "@MyApp:Volume@",
  "value": "this.Width * this.Height * this.Depth"
}
```
