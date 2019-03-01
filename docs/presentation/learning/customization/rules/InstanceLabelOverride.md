# InstanceLabelOverride Customization Rule

Instance label override rule provides a way to set instance label to one of its property values. If more advanced labels are necessary, there's also a [LabelOverride rule](./LabelOverride.md) which uses [ECExpressions](../ECExpressions.md) to create the label, but costs more performance-wise.

## Attributes

Name | Required? | Type | Default | Meaning
-|-|-|-|-
*Filtering* |
`priority` | No | `number` | `1000` | Defines the order in which presentation rules are evaluated.
`onlyIfNotHandled` | No | `boolean` | `false` | Should this rule be ignored if there is already an existing rule with a higher priority.
`class` | Yes | `SingleSchemaClassSpecification` | | Specification of the ECClass to apply this rule to.
*Overrides* |
`propertyNames` | Yes | `string[]` | | Names of properties which should be used as instance label. The first property that has a value is used as the actual label.

## Example

```JSON
{
  "ruleType": "InstanceLabelOverride",
  "priority": 999,
  "class": { "schemaName": "MySchema", "className": "MyClass" },
  "propertyNames": ["MyProperty1", "MyProperty2"],
}
```
