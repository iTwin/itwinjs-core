# Calculated Properties Specification

> TypeScript type: [CalculatedPropertiesSpecification]($presentation-common).

This content modifier allows including additional calculated properties into the content.

## Attributes

| Name                              | Required? | Type                                         | Default |
| --------------------------------- | --------- | -------------------------------------------- | ------- |
| [`label`](#attribute-label)       | Yes       | `string`                                     |         |
| [`value`](#attribute-value)       | Yes       | [ECExpression](../Advanced/ECExpressions.md) |         |
| [`priority`](#attribute-priority) | No        | `number`                                     | `1000`  |

### Attribute: `label`

Specifies label of the calculated property. Supports [localization](../Advanced/Localization.md).

```ts
[[include:Content.Customization.CalculatedPropertiesSpecification.Label.Ruleset]]
```

![Example of using "label" attribute](./media/calculatedpropertiesspecification-with-label-attribute.png)

### Attribute: `value`

Defines an expression to calculate the value. The expression can use [ECInstance](../Advanced/ECExpressions.md#ecinstance)
and [Ruleset Variables](../Advanced/ECExpressions.md#ruleset-variables-user-settings) symbol contexts.

```ts
[[include:Content.Customization.CalculatedPropertiesSpecification.Value.Ruleset]]
```

![Example of using "value" attribute](./media/calculatedpropertiesspecification-with-value-attribute.png)

### Attribute: `priority`

> **Default value:** `1000`

Assign a custom [Field.priority]($presentation-common) to the property. It's up to the UI component to make sure that priority
is respected - properties with higher priority should appear before or above properties with lower priority.

```ts
[[include:Content.Customization.CalculatedPropertiesSpecification.Priority.Ruleset]]
```

| `priority: 9999`                                                                                                                 | `priority: -9999`                                                                                                                |
| -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| ![Example of using "priority" attribute set to 9999](./media/calculatedpropertiesspecification-with-priority-attribute-high.png) | ![Example of using "priority" attribute set to -9999](./media/calculatedpropertiesspecification-with-priority-attribute-low.png) |
