# ImageIdOverride Customization Rule

> TypeScript type: [ImageIdOverride]($presentation-common).

ImageId override rules allow setting an image ID to specific types of ECInstances.

## Attributes

| Name                | Required? | Type                                                                 | Default | Meaning                                                                                  |
| ------------------- | --------- | -------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------- |
| *Filtering*         |
| `requiredSchemas`   | No        | [`RequiredSchemaSpecification[]`](../Advanced/SchemaRequirements.md) | `[]`    | Specifications that define schema requirements for the rule to take effect.              |
| `priority`          | No        | `number`                                                             | `1000`  | Defines the order in which presentation rules are evaluated.                             |
| `onlyIfNotHandled`  | No        | `boolean`                                                            | `false` | Should this rule be ignored if there is already an existing rule with a higher priority. |
| `condition`         | No        | [ECExpression](./ECExpressions.md#rule-condition)                    | `""`    | Defines a condition for the rule, which needs to be met in order to execute it.          |
| *Overrides*         |
| `imageIdExpression` | Yes       | [ECExpression](./ECExpressions.md#override-value)                    |         | An expression whose result becomes the image ID.                                         |

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
