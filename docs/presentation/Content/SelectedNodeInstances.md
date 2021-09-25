# SelectedNodeInstances Specification

> TypeScript type: [SelectedNodeInstancesSpecification]($presentation-common).

Returns content for selected (input) instances.

## Attributes

| Name                        | Required? | Type                                                                                | Default | Meaning                                                                                                                                                                                                                                                    |
| --------------------------- | --------- | ----------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| *Filtering*                 |
| `acceptableSchemaName`      | No        | `string`                                                                            | `""`    | Filter selected nodes by specified schema name. All schemas are accepted if not specified.                                                                                                                                                                 |
| `acceptableClassNames`      | No        | `string[]`                                                                          | `[]`    | Filter selected nodes by specified class names. All classes are accepted if not specified.                                                                                                                                                                 |
| `acceptablePolymorphically` | No        | `boolean`                                                                           | `false` | Should `acceptableClassNames` property be checked polymorphically. If true, all derived classes are accepted as well.                                                                                                                                      |
| `onlyIfNotHandled`          | No        | boolean                                                                             | `false` | Identifies whether we should ignore this specification if there is already an existing specification with higher `priority` that already provides content.                                                                                                 |
| *Ordering*                  |
| `priority`                  | No        | `number`                                                                            | `1000`  | Changes the order of specifications.                                                                                                                                                                                                                       |
| *Content Modifiers*         |
| `relatedProperties`         | No        | `RelatedPropertiesSpecification[]`                                                  | `[]`    | Specifications of [related properties](./Terminology.md#related-properties) which are included in the generated content. *See [this page](./RelatedPropertiesSpecification.md) for more details*                                                           |
| `calculatedProperties`      | No        | `CalculatedPropertiesSpecification[]`                                               | `[]`    | Specifications of calculated properties whose values are generated using provided ECExpressions. *See [this page](./CalculatedPropertiesSpecification.md) for more details*                                                                                |
| `propertyCategories`        | No        | `PropertyCategorySpecification[]`                                                   | `[]`    | Specifications for custom categories. Simply defining the categories does nothing - they have to be referenced from `PropertySpecification` defined in `propertyOverrides` by `id`. *See [this page](./PropertyCategorySpecification.md) for more details* |
| `propertyOverrides`         | No        | `PropertySpecification[]`                                                           | `[]`    | Specifications for various property overrides. *See [this page](./PropertySpecification.md) for more details*                                                                                                                                              |
| `showImages`                | No        | `boolean`                                                                           | `false` | Should image IDs be calculated for the returned instances. When `true`, [ImageIdOverride](../customization/ImageIdOverride.md) rules get applied when creating content.                                                                                    |
| *Misc.*                     |
| `relatedInstances`          | No        | [`RelatedInstanceSpecification[]`](../Common-Rules/RelatedInstanceSpecification.md) | `[]`    | Specifications of [related instances](../Common-Rules/RelatedInstanceSpecification.md) that can be used in content creation.                                                                                                                               |

## Example

```JSON
{
  "specType": "SelectedNodeInstances",
  "acceptableSchemaName": "MySchema",
  "acceptableClassNames": ["MyClass1", "MyClass2"],
  "acceptablePolymorphically": true
}
```
