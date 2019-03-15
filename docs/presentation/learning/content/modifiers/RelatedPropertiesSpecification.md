# RelatedProperties Content Modifier

This content modifier allows including related instance properties into the selected instance content.

## Attributes

Name | Required? | Type | Default | Meaning
-|-|-|-|-|-
`relationships` | No* | `MultiSchemaClassesSpecification | MultiSchemaClassesSpecification[]` | `[]` | Specifications for relationships to follow when looking for related instances.
`relatedClasses` | No* | `MultiSchemaClassesSpecification | MultiSchemaClassesSpecification[]` | `[]` | Specifications for related instance classes.
`isPolymorphic` | No | `boolean` | `false` | Should `relationships` and `relatedClasses` be handled polymorphically.
`requiredDirection` | No | `"Forward" | "Backward" | "Both"` | `"Both"` | Relationship directions to follow when looking for related instances.
`relationshipMeaning` | No | `"SameInstance" | "RelatedInstance"` | `"RelatedInstance"` | Meaning of the relationship. This is really just a cue for UI for how to display the property.
`propertyNames` | No | `string[] | "_none_"` | All properties in related classes | List of names of related class properties that should be included in the content.
`nestedRelatedProperties` | No | `RelatedPropertiesSpecification[]` | `[]` | Nested related properties specifications. Often used with `propertyNames = "_none_"` when traversing through several relationships to access related properties.

## Example

```JSON
{
  "relationships": {"schemaName": "BisCore", "classNames": ["ElementOwnsUniqueAspect"]},
  "relatedClasses": {"schemaName": "BisCore", "classNames": ["ElementUniqueAspect"]},
  "requiredDirection": "Forward",
  "isPolymorphic": true,
  "relationshipMeaning": "SameInstance"
}
```
