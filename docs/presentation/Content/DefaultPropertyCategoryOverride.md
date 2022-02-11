# Default Property Category Override

> TypeScript type: [DefaultPropertyCategoryOverride]($presentation-common).

A rule that allows overriding the default property category.

The default property category is a category that gets assigned to properties that otherwise have no category.

## Attributes

| Name                                            | Required? | Type                                                                  | Default |
| ----------------------------------------------- | --------- | --------------------------------------------------------------------- | ------- |
| *Picking attributes*                            |
| [`requiredSchemas`](#attribute-requiredschemas) | No        | [`RequiredSchemaSpecification[]`](../Advanced/SchemaRequirements.md)  | `[]`    |
| [`priority`](#attribute-priority)               | No        | `number`                                                              | `1000`  |
| *Content Modifiers*                             |
| [`specification`](#attribute-specification)     | Yes       | [`PropertyCategorySpecification`](./PropertyCategorySpecification.md) |         |

### Attribute: `requiredSchemas`

> **Default value:** `[]`

Lists schema requirements that need to be met for the rule to take effect. See more details in [Defining ECSchema Requirements for Presentation Rules](../Advanced/SchemaRequirements.md).

```ts
[[include:Content.Customization.DefaultPropertyCategoryOverride.RequiredSchemas.Ruleset]]
```

![Example of using "required schemas" attribute](./media/defaultpropertycategoryoverride-with-requiredschemas-attribute.png)

### Attribute: `priority`

> **Default value:** `1000`

Controls rule priority. Because there can only be one default category, default category override with the highest priority value will override all other rules of the same type.

```ts
[[include:Content.Customization.DefaultPropertyCategoryOverride.Priority.Ruleset]]
```

![Example of using "priority" attribute](./media/defaultpropertycategoryoverride-with-priority-attribute.png)

### Attribute: `specification`

Specification for the custom property category.

```ts
[[include:Content.Customization.DefaultPropertyCategoryOverride.Specification.Ruleset]]
```

![Example of using "specification" attribute](./media/defaultpropertycategoryoverride-with-specification-attribute.png)
