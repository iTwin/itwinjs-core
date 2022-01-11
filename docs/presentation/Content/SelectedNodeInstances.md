# Selected Node Instances Specification

> TypeScript type: [SelectedNodeInstancesSpecification]($presentation-common).

Returns content for selected (input) instances.

## Attributes

| Name                                                                | Required? | Type                                                                                | Default |
| ------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------- | ------- |
| *Filtering*                                                         |
| [`acceptableSchemaName`](#attribute-acceptableschemaname)           | No        | `string`                                                                            | `""`    |
| [`acceptableClassNames`](#attribute-acceptableclassnames)           | No        | `string[]`                                                                          | `[]`    |
| [`acceptablePolymorphically`](#attribute-acceptablepolymorphically) | No        | `boolean`                                                                           | `false` |
| [`onlyIfNotHandled`](#attribute-onlyifnothandled)                   | No        | boolean                                                                             | `false` |
| *Ordering*                                                          |
| [`priority`](#attribute-priority)                                   | No        | `number`                                                                            | `1000`  |
| *Content Modifiers*                                                 |
| [`relatedProperties`](#attribute-relatedproperties)                 | No        | `RelatedPropertiesSpecification[]`                                                  | `[]`    |
| [`calculatedProperties`](#attribute-calculatedproperties)           | No        | `CalculatedPropertiesSpecification[]`                                               | `[]`    |
| [`propertyCategories`](#attribute-propertycategories)               | No        | `PropertyCategorySpecification[]`                                                   | `[]`    |
| [`propertyOverrides`](#attribute-propertyoverrides)                 | No        | `PropertySpecification[]`                                                           | `[]`    |
| [`showImages`](#attribute-showimages)                               | No        | `boolean`                                                                           | `false` |
| *Misc.*                                                             |
| [`relatedInstances`](#attribute-relatedinstances)                   | No        | [`RelatedInstanceSpecification[]`](../Common-Rules/RelatedInstanceSpecification.md) | `[]`    |

### Attribute: `acceptableSchemaName`

Filter selected nodes by specified schema name. All schemas are accepted if not specified.

### Attribute: `acceptableClassNames`

Filter selected nodes by specified class names. All classes are accepted if not specified.

### Attribute: `acceptablePolymorphically`

Should `acceptableClassNames` property be checked polymorphically. If true, all derived classes are accepted as well.

### Attribute: `onlyIfNotHandled`

Identifies whether we should ignore this specification if there is already an existing specification with higher `priority` that already provides content.

### Attribute: `priority`

Changes the order of specifications.

### Attribute: `relatedProperties`

Specifications of [related properties](./Terminology.md#related-properties) which are included in the generated content. *See [this page](./RelatedPropertiesSpecification.md) for more details*

### Attribute: `calculatedProperties`

Specifications of calculated properties whose values are generated using provided ECExpressions. *See [this page](./CalculatedPropertiesSpecification.md) for more details*

### Attribute: `propertyCategories`

Specifications for custom categories. Simply defining the categories does nothing - they have to be referenced from `PropertySpecification` defined in `propertyOverrides` by `id`. *See [this page](./PropertyCategorySpecification.md) for more details*

### Attribute: `propertyOverrides`

Specifications for various property overrides. *See [this page](./PropertySpecification.md) for more details*

### Attribute: `showImages`

Should image IDs be calculated for the returned instances. When `true`, [ImageIdOverride](../customization/ImageIdOverride.md) rules get applied when creating content.

### Attribute: `relatedInstances`

Specifications of [related instances](../Common-Rules/RelatedInstanceSpecification.md) that can be used in content creation.

## Example

```JSON
{
  "specType": "SelectedNodeInstances",
  "acceptableSchemaName": "MySchema",
  "acceptableClassNames": ["MyClass1", "MyClass2"],
  "acceptablePolymorphically": true
}
```
