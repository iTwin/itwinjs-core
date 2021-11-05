# ContentRelatedInstances Specification

> TypeScript type: [ContentRelatedInstancesSpecification]($presentation-common).

Returns content for instances related to the selected (input) instances.

## Attributes

| Name                   | Required? | Type                                                                                  | Default | Meaning                                                                                                                                                                                                                                                    |
| ---------------------- | --------- | ------------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| *Filtering*            |
| `relationshipPaths`    | Yes       | [`RelationshipPathSpecification[]`](../Common-Rules/RelationshipPathSpecification.md) |         | List of [relationship path specifications](../Common-Rules/RelationshipPathSpecification.md) to follow when looking for related class instances.                                                                                                           |
| `instanceFilter`       | No        | [ECExpression](./ECExpressions.md#instance-filter)                                    | `""`    | Condition for filtering instances                                                                                                                                                                                                                          |
| *Ordering*             |
| `priority`             | No        | `number`                                                                              | `1000`  | Changes the order of specifications.                                                                                                                                                                                                                       |
| *Content Modifiers*    |
| `relatedProperties`    | No        | `RelatedPropertiesSpecification[]`                                                    | `[]`    | Specifications of [related properties](./Terminology.md#related-properties) which are included in the generated content. *See [this page](./RelatedPropertiesSpecification.md) for more details*                                                           |
| `calculatedProperties` | No        | `CalculatedPropertiesSpecification[]`                                                 | `[]`    | Specifications of calculated properties whose values are generated using provided ECExpressions. *See [this page](./CalculatedPropertiesSpecification.md) for more details*                                                                                |
| `propertyCategories`   | No        | `PropertyCategorySpecification[]`                                                     | `[]`    | Specifications for custom categories. Simply defining the categories does nothing - they have to be referenced from `PropertySpecification` defined in `propertyOverrides` by `id`. *See [this page](./PropertyCategorySpecification.md) for more details* |
| `propertyOverrides`    | No        | `PropertySpecification[]`                                                             | `[]`    | Specifications for various property overrides. *See [this page](./PropertySpecification.md) for more details*                                                                                                                                              |
| `showImages`           | No        | `boolean`                                                                             | `false` | Should image IDs be calculated for the returned instances. When `true`, [ImageIdOverride](../customization/ImageIdOverride.md) rules get applied when creating content.                                                                                    |
| *Misc.*                |
| `relatedInstances`     | No        | [`RelatedInstanceSpecification[]`](../Common-Rules/RelatedInstanceSpecification.md)   | `[]`    | Specifications of [related instances](../Common-Rules/RelatedInstanceSpecification.md) that can be used in content creation.                                                                                                                               |

## Example

```JSON
{
  "specType": "ContentRelatedInstances",
  "relationshipPaths": [{
    "relationship": { "schemaName": "BisCore", "className": "ModelContainsElements" },
    "direction": "Forward",
    "targetClass": { "schemaName": "BisCore", "className": "PhysicalElement" }
  }],
  "arePolymorphic": true
}
```
