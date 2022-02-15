# Property Specification

> TypeScript type: [PropertySpecification]($presentation-common).

This specification allows overriding some attributes of specific ECProperty or define how it's displayed.

## Attributes

| Name                                                                                                | Required? | Type                                                              | Default     |
| --------------------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------- | ----------- |
| [`name`](#attribute-name)                                                                           | Yes       | `string`                                                          |             |
| [`overridesPriority`](#attribute-overridespriority)                                                 | No        | `number`                                                          | `1000`      |
| [`labelOverride`](#attribute-labeloverride)                                                         | No        | `string`                                                          | `undefined` |
| [`categoryId`](#attribute-categoryid)                                                               | No        | `string \| CategoryIdentifier`                                    | `undefined` |
| [`isDisplayed`](#attribute-isdisplayed)                                                             | No        | `boolean`                                                         | `undefined` |
| [`doNotHideOtherPropertiesOnDisplayOverride`](#attribute-donothideotherpropertiesondisplayoverride) | No        | `boolean`                                                         | `false`     |
| [`renderer`](#attribute-renderer)                                                                   | No        | [`RendererSpecification`](./RendererSpecification.md)             | `undefined` |
| [`editor`](#attribute-editor)                                                                       | No        | [`PropertyEditorSpecification`](./PropertyEditorSpecification.md) | `undefined` |

### Attribute: `name`

Name of the ECProperty to apply overrides to. A `"*"` may be specified to match all properties in current context. The current context is determined based on where the override is specified:

- When used in a [content modifier](./ContentModifier.md#attribute-propertyoverrides), the properties of the ECClass specified by the [`class` attribute](./ContentModifier.md#attribute-class) are used.
- When used in one of the [content specifications](./ContentRule.md#attribute-specifications), properties produced by that specification are used.

### Attribute: `overridesPriority`

> **Default value:** `1000`

There may be multiple property specifications that apply to a single property and there may be conflicts between different attributes. The `overridesPriority` attribute is here to help
solve the problem - if multiple specifications attempt to override the same attribute, the override of specification with highest `overridesPriority` value is used. The order of overrides
from specification with the same `overridesPriority` is defined by the order they appear in the overrides list.

```ts
[[include:Content.Customization.PropertySpecification.OverridesPriority.Ruleset]]
```

![Example of using a "overrides priority" attribute](./media/propertyspecification-with-overridespriority-attribute.png)

### Attribute: `labelOverride`

> **Default value:** `undefined`

This is an attribute that allows overriding the property label. May be [localized](../Advanced/Localization.md).

```ts
[[include:Content.Customization.PropertySpecification.LabelOverride.Ruleset]]
```

![Example of using a "label override" attribute](./media/propertyspecification-with-labeloverride-attribute.png)

### Attribute: `categoryId`

> **Default value:** `undefined`

The attribute allows moving the property into a different category. There are several options:

- Reference a category by ID used in [`PropertyCategorySpecification`](./PropertyCategorySpecification.md) in the current context.
  The current context contains categories specified in the same [content specification](./index.md#specifications) or the same
  [content modifier](./ContentModifier.md), depending on where the property override is used.

- Move to `DefaultParent` category. This is useful when using with [related properties](./RelatedPropertiesSpecification.md), to
  avoid putting them inside a special related class category and instead show them next to properties of the source class.

- Move to `Root` category. This is useful when using with [related properties](./RelatedPropertiesSpecification.md), to
  avoid putting them inside a special related class category and instead show them in the root category.

See [property categorization page](./PropertyCategorization.md) for more details.

```ts
[[include:Content.Customization.PropertySpecification.CategoryId.Ruleset]]
```

![Example of using a "category id" attribute](./media/propertyspecification-with-categoryid-attribute.png)

### Attribute: `isDisplayed`

> **Default value:** `undefined`

This attribute controls whether the particular property is present in the result, even when it is marked as hidden in the ECShcema. The allowed settings are:

- Omitted or `undefined`: property visibility is controlled by the ECSchema.
- `true`: property is made visible. **Warning:** this will automatically hide all other properties of the same class. If this behavior is not desirable, set [`doNotHideOtherPropertiesOnDisplayOverride` attribute](#attribute-donothideotherpropertiesondisplayoverride) to `true`.
- `false`: property is made hidden.

```ts
[[include:Content.Customization.PropertySpecification.IsDisplayed.Ruleset]]
```

![Example of using a "is displayed" attribute](./media/propertyspecification-with-isdisplayed-attribute.png)

### Attribute: `doNotHideOtherPropertiesOnDisplayOverride`

> **Default value:** `false`

This attribute controls whether making the property visible using [`isDisplayed`](#attribute-isdisplayed) should automatically hide all other properties of the same class. When `true`, this behavior is disabled.

```ts
[[include:Content.Customization.PropertySpecification.DoNotHideOtherPropertiesOnDisplayOverride.Ruleset]]
```

| `doNotHideOtherPropertiesOnDisplayOverride: false`                                                                                                                                                | `doNotHideOtherPropertiesOnDisplayOverride: true`                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ![Example of using "do not hide other properties on display override" attribute set to "false"](./media/propertyspecification-with-donothideotherpropertiesondisplayoverride-attribute-false.png) | ![Example of using "do not hide other properties on display override" attribute set to "true"](./media/propertyspecification-with-donothideotherpropertiesondisplayoverride-attribute-true.png) |

### Attribute: `renderer`

> **Default value:** `undefined`

Custom property [renderer specification](./RendererSpecification.md) that allows assigning a custom value renderer to be used in UI. The
specification is used to set up [Field.renderer]($presentation-common) for this property and it's up to the UI component to make sure
appropriate renderer is used to render the property.

See [Custom property value renderers](../Customization/PropertyValueRenderers.md) page for a list of available renderers or how to register a custom one.

```ts
[[include:Content.Customization.PropertySpecification.Renderer.Ruleset]]
```

```ts
[[include:Content.Customization.PropertySpecification.Renderer.Result]]
```

### Attribute: `editor`

> **Default value:** `undefined`

Custom [property editor specification](./PropertyEditorSpecification) that allows assigning a custom value editor
to be used in UI.

```ts
[[include:Content.Customization.PropertySpecification.Editor.Ruleset]]
```

```ts
[[include:Content.Customization.PropertySpecification.Editor.Result]]
```
