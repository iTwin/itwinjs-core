# LabelOverride Customization Rule

> Based on [LabelOverride]($presentation-common) interface.

Label override rules provide advanced ways to override instance labels and descriptions in
exchange of some performance penalty. When possible, it's advised to use
[InstanceLabelOverride](./InstanceLabelOverride.md) rules instead.

## Attributes

Name | Required? | Type | Default | Meaning
-|-|-|-|-
*Filtering* |
`requiredSchemas` | No | [`RequiredSchemaSpecification[]`](../SchemaRequirements.md) | `[]` | Specifications that define schema requirements for the rule to take effect.
`priority` | No | `number` | `1000` | Defines the order in which presentation rules are evaluated.
`onlyIfNotHandled` | No | `boolean` | `false` | Should this rule be ignored if there is already an existing rule with a higher priority.
`condition` | No | [ECExpression](./ECExpressions.md#rule-condition) |`""` | Defines a condition for the rule, which needs to be met in order to execute it.
*Overrides* |
`label` | No | [ECExpression](./ECExpressions.md#override-value) | `""` | An expression whose result becomes the label
`description` | No | [ECExpression](./ECExpressions.md#rule-condition) | `""` | An expression whose result becomes the description

## Example

```JSON
{
  "ruleType": "LabelOverride",
  "requiredSchemas": [{ "name": "MySchema", "minVersion": "1.2.3" }],
  "priority": 999,
  "stopFurtherProcessing": true,
  "condition": "ThisNode.IsOfClass(\"MyItem\", \"MySchema\")",
  "label": "\"Volume: \" & (this.Height * this.Width * this.Length)",
  "description": "\"Physical item\""
}
```

## Known Issues

The rule is deprecated in favor of [InstanceLabelOverride](./InstanceLabelOverride) and has several known issues:

- `InstanceLabelOverride` rules **always** take precedence over `LabelOverride`, no matter what their priorities are.
A possible workaround is to avoid having `InstanceLabelOverride` rules for the class targeted by specific
`LabelOverride`. If `InstanceLabelOverride` rules come from a supplemental schema, that can't be controlled, there's an
option to add such an `InstanceLabelOverride` to reset overrides in supplemental ruleset:

  ```JSON
  {
    "ruleType": "InstanceLabelOverride",
    "priority": 9999,
    "class": { "schemaName": "MySchema", "className": "MyClass" },
    "values": []
  },
  ```

- Nested `LabelOverride` rules (specified anywhere else other than at the root rules level) have no effect.
A possible workaround is to move them to the root rules level.
