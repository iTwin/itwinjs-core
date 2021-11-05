# Infinite Hierarchies Prevention

When creating hierarchies the presentation rules engine avoids getting into infinite loops by checking if the created node already has a similar ancestor node. If it does, the node is marked as hidden and creating the hierarchy further is stopped at that point.

For the above checks, two nodes are considered similar if:

- they're both based on the same specification
- they both have same type (ECInstance, ECClass Grouping, ECProperty Grouping, Label Grouping, Custom)
- based on node type, they represent the same thing (same ECInstance, same ECClass, etc.)

## Suppressing

In some specific cases the algorithm described above might assume we got into an infinite hierarchy when we didn't. Here's an example:

```JSON
[{
  "ruleType": "ChildNodes",
  "condition": "ParentNode.IsOfClass(\"ISubModeledElement\", \"BisCore\")",
  "specifications": [{
    "specType": "RelatedInstanceNodes",
    "relationshipPaths": [{
      "relationship": { "schemaName": "BisCore", "className": "ModelModelsElement" },
      "direction": "Backward"
    }],
    "groupByClass": false,
    "groupByLabel": false
  }]
}, {
  "ruleType": "ChildNodes",
  "condition": "ParentNode.IsOfClass(\"GeometricModel3d\", \"BisCore\")",
  "specifications": [ {
    "specType": "RelatedInstanceNodes",
    "relationshipPaths": [[{
      "relationship": { "schemaName": "BisCore", "className": "ModelContainsElements" },
      "direction": "Forward",
      "targetClass": { "schemaName": "BisCore", "className": "GeometricElement3d" }
    }, {
      "relationship": { "schemaName": "BisCore", "className": "GeometricElement3dIsInCategory" },
      "direction": "Forward",
      "targetClass": { "schemaName": "BisCore", "className": "SpatialCategory" }
    }]],
    "groupByClass": false,
    "groupByLabel": false
  }]
}, {
  "ruleType": "ChildNodes",
  "condition": "ParentNode.IsOfClass(\"SpatialCategory\", \"BisCore\")",
  "specifications": [{
    "specType": "RelatedInstanceNodes",
    "relationshipPaths": [{
        "relationship": { "schemaName": "BisCore", "className": "GeometricElement3dIsInCategory" },
        "direction": "Backward"
    }],
    "instanceFilter": "this.Model.Id = parent.parent.ECInstanceId",
    "groupByClass": false,
    "groupByLabel": false
  }]
}]
```

In the above example we have a hierarchy of *Model -> Category -> Element -> Model -> Category -> Element -> ...*. But this is not an infinite hierarchy, because every time the *Model* is different, although *Categories* might be repeated. However, because the *Categories* are repeated, our algorithm thinks this is an finite hierarchy and breaks the hierarchy as soon as the second *Category* node is created.

To avoid the above problem, there's a `suppressSimilarAncestorsCheck` attribute that can be set on [one of the hierarchy specifications](./ChildNodeRule.md#attribute-specifications). With that attribute applied we allow the node to be repeated in hierarchy up to 10 times.
