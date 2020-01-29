# RelatedProperties Content Modifier

This content modifier allows including related instance properties into the selected instance content.

## Attributes

Name | Required? | Type | Default | Meaning
-|-|-|-|-
`propertiesSource` | Yes | `RelationshipPathSpecification` | | [Specification of the relationship path](../RelationshipPathSpecification.md) to follow when looking for related properties.
`handleTargetClassPolymorphically` | No | `boolean` | `false` | Should the target class specified in `propertiesSource` be handled polymorphically. This means properties of not only the target class, but also all its subclasses are loaded.
`relationshipMeaning` | No | `"SameInstance" \| "RelatedInstance"` | `"RelatedInstance"` | Meaning of the relationship. This is really just a cue for UI for how to display the property.
`properties` | No | `Array<string \| PropertySpecification> \| "_none_"` | All properties in target class | List of names or definitions of related class properties that should be included in the content.
`autoExpand` | No | `boolean` | `false` | Should field containing related properties be automatically expanded. Only takes effect when related properties are displayed as a struct.

## Example

```JSON
{
  "propertiesSource": {
    "relationship": {"schemaName": "BisCore", "className": "ElementOwnsUniqueAspect"},
    "direction": "Forward",
    "targetClass": {"schemaName": "BisCore", "className": "ElementUniqueAspect"}
  },
  "handleTargetClassPolymorphically": true,
  "relationshipMeaning": "SameInstance",
  "properties": [{
    "name": "MyProperty1",
    "labelOverride": "My Custom Related Property Label"
  }]
}
```
