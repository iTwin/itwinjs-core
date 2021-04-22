# Sorting Customization Rule

> Based on [SortingRule]($presentation-common) interface.

Sorting rules provide a way to either disable sorting or sort instances my specific properties. There are 2 types of sorting rules for both of these scenarios.

## Property Sorting Rule

Rule to configure sorting for certain ECInstances in the hierarchy and/or content. It is possible to configure different sorting for different types of ECInstances.

Multiple sorting rules may be applied for the same instances - in this case the
instances are first sorted by the highest priority rule and then the lower priority ones.

**Note:** This rule is not meant to be used to sort grouping nodes, custom nodes or other non ECInstance type of nodes.

### Attributes

Name | Required? | Type | Default | Meaning
-|-|-|-|-
*Filtering* |
`requiredSchemas` | No | [`RequiredSchemaSpecification[]`](../SchemaRequirements.md) | `[]` | Specifications that define schema requirements for the rule to take effect.
`priority` | No | `number` | `1000` | Defines the order in which presentation rules are evaluated.
`onlyIfNotHandled` | No | `boolean` | `false` | Should this rule be ignored if there is already an existing rule with a higher priority.
`condition` | No | [ECExpression](../hierarchies/ECExpressions.md#rule-condition) |`""` | Defines a condition for the rule, which needs to be met in order to execute it.
`class` | No | `SingleSchemaClassSpecification` | All classes in current context | Specification of ECClass whose ECInstances should be sorted.
`isPolymorphic` | No | `boolean` | false | Should `class` defined in this rule be handled polymorphically.
*Sorting* |
`propertyName` | Yes | `string` | | Name of the property which should be used for sorting.
`sortAscending` | No | `boolean` | `true` | Should instances be sorted in ascending order.

### Example

```JSON
{
  "ruleType": "PropertySorting",
  "requiredSchemas": [{ "name": "MySchema", "minVersion": "1.2.3" }],
  "priority": 999,
  "class": { "schemaName": "MySchema", "className": "MyClass" },
  "isPolymorphic": true,
  "propertyName": "MyProperty"
}
```

## Disabled Sorting Rule

Rule to disable sorting for certain ECInstances in the hierarchy and/or content.

**Note:** Disabling sorting increases performance

**Note:** This rule is not meant to be used to sort grouping nodes, custom nodes or
other non ECInstance type of nodes.

### Attributes

Name | Required? | Type | Default | Meaning
-|-|-|-|-
*Filtering* |
`priority` | No | `number` | `1000` | Defines the order in which presentation rules are evaluated.
`onlyIfNotHandled` | No | `boolean` | `false` | Should this rule be ignored if there is already an existing rule with a higher priority.
`condition` | No | [ECExpression](../hierarchies/ECExpressions.md#rule-condition) |`""` | Defines a condition for the rule, which needs to be met in order to execute it.
`class` | No | `SingleSchemaClassSpecification` | All classes in current context | Specification of ECClass whose ECInstances should be sorted.
`isPolymorphic` | No | `boolean` | false | Should `class` defined in this rule be handled polymorphically.

### Example

```JSON
{
  "ruleType": "DisabledSorting",
  "requiredSchemas": [{ "name": "MySchema", "minVersion": "1.2.3" }],
  "priority": 999,
  "class": { "schemaName": "MySchema", "className": "MyClass" },
  "isPolymorphic": true
}
```
