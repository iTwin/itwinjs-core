# Property Category Specification

> TypeScript type: [PropertyCategorySpecification]($presentation-common).

Content modifier for defining custom property categories. Custom categories are not present in the result unless they contain at least one property. One way to assign a property to the category is by using [property overrides](./PropertySpecification.md).

See [property categorization page](./PropertyCategorization.md) for more details.

## Attributes

| Name                                    | Required? | Type                                                  | Default     |
| --------------------------------------- | --------- | ----------------------------------------------------- | ----------- |
| [`id`](#attribute-id)                   | Yes       | `string`                                              |             |
| [`parentId`](#attribute-parentid)       | No        | `string \| CategoryIdentifier`                        |             |
| [`label`](#attribute-label)             | Yes       | `string`                                              |             |
| [`description`](#attribute-description) | No        | `string`                                              | `""`        |
| [`priority`](#attribute-priority)       | No        | `number`                                              | `1000`      |
| [`autoExpand`](#attribute-autoexpand)   | No        | `boolean`                                             | `false`     |
| [`renderer`](#attribute-renderer)       | No        | [`RendererSpecification`](./RendererSpecification.md) | `undefined` |

### Attribute: `id`

Category identifier used to reference the category definition from property overrides or other category definitions. The identifier has to be unique
within the list of category definitions where this specification is used.

```ts
[[include:Content.Customization.PropertyCategorySpecification.Id.Ruleset]]
```

![Example of referencing category by "id"](./media/propertycategoryspecification-with-id-attribute.png)

### Attribute: `parentId`

> **Default value:** no parent

Identifier of a parent category. When specifying the parent category by ID, it has to be available in the scope of this category definition.

```ts
[[include:Content.Customization.PropertyCategorySpecification.ParentId.Ruleset]]
```

![Example of using "parent id" attribute](./media/propertycategoryspecification-with-parentid-attribute.png)

### Attribute: `label`

Display label of the category. May be [localized](../Advanced/Localization.md).

```ts
[[include:Content.Customization.PropertyCategorySpecification.Label.Ruleset]]
```

![Example of using "label" attribute](./media/propertycategoryspecification-with-label-attribute.png)

### Attribute: `description`

> **Default value:** `""`

Extensive description of the category. The description is assigned to the category object that's set on content fields and
it's up to UI component to decide how the description is displayed.

```ts
[[include:Content.Customization.PropertyCategorySpecification.Description.Ruleset]]
```

```ts
[[include:Content.Customization.PropertyCategorySpecification.Description.Result]]
```

### Attribute: `priority`

> **Default value:** `1000`

Assign a custom [CategoryDescription.priority]($presentation-common) to the category. It's up to the UI component to make sure that priority is respected - categories with higher
priority should appear before or above categories with lower priority.

```ts
[[include:Content.Customization.PropertyCategorySpecification.Priority.Ruleset]]
```

```ts
[[include:Content.Customization.PropertyCategorySpecification.Priority.Result]]
```

![Example of using "priority" attribute](./media/propertycategoryspecification-with-priority-attribute.png)

### Attribute: `autoExpand`

> **Default value:** `false`

Controls the value of [CategoryDescription.expand]($presentation-common) which tells the UI component displaying the category
to auto-expand the category.

```ts
[[include:Content.Customization.PropertyCategorySpecification.AutoExpand.Ruleset]]
```

```ts
[[include:Content.Customization.PropertyCategorySpecification.AutoExpand.Result]]
```

| `autoExpand: false`                                                                                                                   | `autoExpand: true`                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| ![Example of using "auto expand" attribute set to "false"](./media/propertycategoryspecification-with-autoexpand-attribute-false.png) | ![Example of using "auto expand" attribute set to "true"](./media/propertycategoryspecification-with-autoexpand-attribute-true.png) |

### Attribute: `renderer`

> **Default value:** `undefined`

Custom category [renderer specification](./RendererSpecification.md) that allows assigning a custom category renderer to be used
in UI. This specification is used to set up [CategoryDescription.renderer]($presentation-common) for this category and it's up to
the UI component to make sure appropriate renderer is used to render the category.

See [Custom property category renderers](./PropertyCategoryRenderers.md) page for information on how custom categories
are handled in our UI components.

```ts
[[include:Content.Customization.PropertyCategorySpecification.Renderer.Ruleset]]
```

```ts
[[include:Content.Customization.PropertyCategorySpecification.Renderer.Result]]
```
