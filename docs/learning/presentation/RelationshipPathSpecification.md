# RelationshipPath Specification

Relationship path specification and it's *repeatable* counterpart are used to define paths from one ECClass to another, optionally traversing through multiple relationships.

## Attributes

Name | Required? | Type | Default | Meaning
-|-|-|-|-|-
`relationship` | Yes | `SingleSchemaClassSpecification` | | Specification of the relationship to follow.
`direction` | Yes | `"Forward" \| "Backward"` | | Direction in which the relationship should be followed.
`targetClass` | No | `SingleSchemaClassSpecification` | Other end of relationship | Specification of the related class.
`count` | No | `number \| "*"` | 1 | Number of times the relationship should be traversed.

## Example

A single-step relationship path which simply jumps from *current* ECClass to *BisCore.PhysicalElement* through *BisCore.ModelModelsElement* relationship:

```JSON
{
  "relationship": { "schemaName": "BisCore", "className": "ModelModelsElement" },
  "direction": "Forward",
  "targetClass": { "schemaName": "BisCore", "className": "PhysicalElement" }
}
```

A multi-step relationship path which jumps from *current* ECClass through *BisCore.ElementOwnsChildElements* relationship two times in a backward direction:

```JSON
{
  "relationship": { "schemaName": "BisCore", "className": "ElementOwnsChildElements" },
  "direction": "Backward",
  "count": 2
}
```

A two-step relationship path that first jumps from *current* ECClass through *BisCore.ModelModelsElement* and then through *BisCore.ElementOwnsUniqueAspects*:

```JSON
[{
  "relationship": { "schemaName": "BisCore", "className": "ModelModelsElement" },
  "direction": "Forward"
}, {
  "relationship": { "schemaName": "BisCore", "className": "ElementOwnsUniqueAspects" },
  "direction": "Forward"
}]
```

A recursive relationship path which recursively walks through a relationship and accumulates all ECInstances it finds:

```JSON
{
  "relationship": { "schemaName": "BisCore", "className": "ElementOwnsChildElements" },
  "direction": "Forward",
  "count": "*"
}
```

A two-step relationship path that first jumps from *current* ECClass through *BisCore.ModelModelsElement*, then recursively walks through *BisCore.ElementOwnsChildElements* relationship and then finds all related *BisCore.ElementUniqueAspect*s:

```JSON
[{
  "relationship": { "schemaName": "BisCore", "className": "ModelModelsElement" },
  "direction": "Forward"
}, {
  "relationship": { "schemaName": "BisCore", "className": "ElementOwnsChildElements" },
  "direction": "Forward",
  "count": "*"
}, {
  "relationship": { "schemaName": "BisCore", "className": "ElementOwnsUniqueAspects" },
  "direction": "Forward",
  "targetClass": { "schemaName": "BisCore", "className": "ElementUniqueAspect" }
}]
```
