# RelatedInstance Specification

> Based on [RelatedInstanceSpecification]($presentation-common) interface.

Related instance specification can be used in conjunction with both content
and hierarchy related rules. It's primary purpose is to *join* primary instance
with some related instance and allow using them both for:

- filtering
- labeling
- grouping

## Attributes

Name | Required? | Type | Default | Meaning
-|-|-|-|-|-
`relationshipPath` | Yes | `RelationshipPathSpecification` | | [Specification of the relationship path](./RelationshipPathSpecification.md) to use for joining the related instance.
`alias` | Yes | `string` | | The alias to give for the joined related instance. Used to reference the related instance in instance filter and customization rules. **The value must be unique per-specification.**
`isRequired` | No | `boolean` | `false` | Is the related instance required to exist. If yes, primary instance won't be returned if the related instance doesn't exist. If not, primary instance will be returned, but related instance will be null. In SQL terms in can be compared to INNER JOIN vs OUTER JOIN.

## Example

```JSON
{
  "relationshipPath": {
    "relationship": { "schemaName": "BisCore", "className": "ModelModelsElement" },
    "direction": "Forward",
    "targetClass": { "schemaName": "BisCore", "className": "Element" }
  },
  "alias": "modeledElement"
}
```
