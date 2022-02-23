# Sorting Customization Rule

> TypeScript type: [SortingRule]($presentation-common).

Sorting rules provide a way to either disable sorting or sort instances my specific properties. There are 2 types of sorting rules for both of these scenarios.

## Property Sorting Rule

Rule to configure sorting for certain ECInstances in the hierarchy and/or content. It is possible to configure different sorting for different types of ECInstances.

Multiple sorting rules may be applied for the same instances - in this case the
instances are first sorted by the highest priority rule and then the lower priority ones.

> **Note:** This rule is not meant to be used to sort grouping nodes, custom nodes or other non ECInstance type of nodes.

### Attributes

| Name               | Required? | Type                                                                 | Default                        |
| ------------------ | --------- | -------------------------------------------------------------------- | ------------------------------ |
| *Filtering*        |
| `requiredSchemas`  | No        | [`RequiredSchemaSpecification[]`](../Advanced/SchemaRequirements.md) | `[]`                           |
| `priority`         | No        | `number`                                                             | `1000`                         |
| `condition`        | No        | [ECExpression](../hierarchies/ECExpressions.md#rule-condition)       | `""`                           |
| `class`            | No        | `SingleSchemaClassSpecification`                                     | All classes in current context |
| `isPolymorphic`    | No        | `boolean`                                                            | `false`                        |
| *Sorting*          |
| `propertyName`     | Yes       | `string`                                                             |                                |
| `sortAscending`    | No        | `boolean`                                                            | `true`                         |

### Attribute: `requiredSchemas`

> **Default value:** `[]`

A list of ECSchema requirements that need to be met for the rule to be used. See more details in [Defining ECSchema Requirements for Presentation Rules](../Advanced/SchemaRequirements.md).

```ts
[[include:Sorting.RequiredSchemas.Ruleset]]
```

### Attribute: `priority`

> **Default value:** `1000`

Defines the order in which rules are handled - higher priority means the rule is handled first. If priorities are equal, the rules are handled in the order they're defined.

```ts
[[include:PropertySortingRule.Priority.Ruleset]]
```

### Attribute: `condition`

> **Default value:** `""`

Defines a condition which needs to be met in order for the rule to be used. The condition is an [ECExpression](./ECExpressions.md#rule-condition) which has to evaluate to a boolean value.

```ts
[[include:SortingRule.Condition.Ruleset]]
```

### Attribute: `class`

Specifies ECClass whose ECInstances should be sorted.

```ts
[[include:SortingRule.Class.Ruleset]]
```

### Attribute: `isPolymorphic`

> **Default value:** `false`

Specifies that `class` attribute defined in this rule should be handled polymorphically.

```ts
[[include:SortingRule.IsPolymorphic.Ruleset]]
```

### Attribute: `propertyName`

Specifies name of the property which should be used for sorting.

```ts
[[include:PropertySortingRule.PropertyName.Ruleset]]
```

### Attribute: `sortAscending`

> **Default value:** `true`

Specifies whether instances should be sorted in ascending order or descending.

```ts
[[include:PropertySortingRule.SortAscending.Ruleset]]
```

## Disabled Sorting Rule

Rule to disable sorting for certain ECInstances in the hierarchy and/or content.

> **Note:** Disabling sorting increases performance

> **Note:** This rule is not meant to be used to sort grouping nodes, custom nodes or
other non ECInstance type of nodes.

### Attributes

| Name               | Required? | Type                                                                 | Default                        |
| ------------------ | --------- | -------------------------------------------------------------------- | ------------------------------ |
| *Filtering*        |
| `requiredSchemas`  | No        | [`RequiredSchemaSpecification[]`](../Advanced/SchemaRequirements.md) | `[]`                           |
| `priority`         | No        | `number`                                                             | `1000`                         |
| `condition`        | No        | [ECExpression](../hierarchies/ECExpressions.md#rule-condition)       | `""`                           |
| `class`            | No        | `SingleSchemaClassSpecification`                                     | All classes in current context |
| `isPolymorphic`    | No        | `boolean`                                                            | false                          |

### Attribute: `requiredSchemas`

> **Default value:** `[]`

A list of ECSchema requirements that need to be met for the rule to be used. See more details in [Defining ECSchema Requirements for Presentation Rules](../Advanced/SchemaRequirements.md).

```ts
[[include:Sorting.RequiredSchemas.Ruleset]]
```

### Attribute: `priority`

> **Default value:** `1000`

Defines the order in which rules are handled - higher priority means the rule is handled first. If priorities are equal, the rules are handled in the order they're defined.

```ts
[[include:DisabledSortingRule.Priority.Ruleset]]
```

### Attribute: `condition`

> **Default value:** `""`

Defines a condition which needs to be met in order for the rule to be used. The condition is an [ECExpression](./ECExpressions.md#rule-condition) which has to evaluate to a boolean value.

```ts
[[include:SortingRule.Condition.Ruleset]]
```

### Attribute: `class`

Specifies ECClass whose instances should not be sorted.

```ts
[[include:SortingRule.Class.Ruleset]]
```

### Attribute: `isPolymorphic`

> **Default value:** `false`

Specifies that `class` attribute defined in this rule should be handled polymorphically.

```ts
[[include:SortingRule.IsPolymorphic.Ruleset]]
```
