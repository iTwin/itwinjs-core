# CheckBox Customization Rule

> TypeScript type: [CheckBoxRule]($presentation-common).

CheckBox rules provide a way to create a checkbox for specific types of ECInstance's.

## Attributes

| Name                       | Required? | Type                                                                 | Default     | Meaning                                                                                                                         |
| -------------------------- | --------- | -------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------- |
| *Filtering*                |
| `requiredSchemas`          | No        | [`RequiredSchemaSpecification[]`](../Advanced/SchemaRequirements.md) | `[]`        | Specifications that define schema requirements for the rule to take effect.                                                     |
| `priority`                 | No        | `number`                                                             | `1000`      | Defines the order in which presentation rules are evaluated.                                                                    |
| `onlyIfNotHandled`         | No        | `boolean`                                                            | `false`     | Should this rule be ignored if there is already an existing rule with a higher priority.                                        |
| `condition`                | No        | [ECExpression](./ECExpressions.md#rule-condition)                    | `""`        | Defines a condition for the rule, which needs to be met in order to execute it.                                                 |
| *CheckBox Attributes*      |
| `propertyName`             | No        | `string`                                                             | `undefined` | Name of boolean type ECProperty which is bound with the check box state. When set, property value gets bound to checkbox state. |
| `useInversedPropertyValue` | No        | `boolean`                                                            | `false`     | Should property value be inversed for the check box state. **Note:** Only makes sense when bound to an ECProperty.              |
| `defaultValue`             | No        | `boolean`                                                            | `false`     | Default value to use for the check box state. **Note:** Only makes sense when *not* bound to an ECProperty.                     |
| `isEnabled`                | No        | `boolean`                                                            | `true`      | Indicates whether check box is enabled or disabled.                                                                             |

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
