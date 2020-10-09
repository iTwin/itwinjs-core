---
ignore: true
---
# NextVersion

## Presentation

### `hideNodesInHierarchy` and grouping

Behavior of `hideNodesInHierarchy` attribute was changed when used in combination with grouping.

Previously the attribute meant that all nodes produced by the specification it was used on would be hidden, including grouping nodes. That made the combination useless, because grouping had absolutely no effect when used with `hideNodesInHierarchy`.

Now, only the instance nodes are hidden, but their grouping nodes (if any) are displayed. This makes it possible to create hierarchies like the following:

**Schema:**
```xml
<ECEntityClass typeName="A" />
<ECEntityClass typeName="A1">
  <BaseClass>A</BaseClass>
</ECEntityClass>
<ECEntityClass typeName="A2">
  <BaseClass>A</BaseClass>
</ECEntityClass>
<ECEntityClass typeName="B" />
<ECRelationshipClass typeName="A_B" strength="referencing" modifier="None" description="">
    <Source multiplicity="(0..*)" roleLabel="contains" polymorphic="true">
        <Class class="A"/>
    </Source>
    <Target multiplicity="(0..*)" roleLabel="is contained by" polymorphic="true">
        <Class class="B" />
    </Target>
</ECRelationshipClass>
```

**Instances:**
```
Classes:                                  Relationship "A_B"
+-------+-------------+-------+           +-----------+-----------+
| Class | Instance ID | Label |           | Source ID | Target ID |
+-------+-------------+-------+           +-----------+-----------+
| A1    |           1 | One   |           |         1 |         3 |
| A2    |           2 | Two   |           |         2 |         3 |
| B     |           3 | Three |
```

**Presentation rules:**
```json
rules: [{
  "ruleType": "RootNodes",
  "specifications": [{
    "specType": "InstanceNodesOfSpecificClasses",
    "classes": { "schemaName": "MySchema", "classNames": ["A"] },
    "groupByClass": true,
    "groupByLabel": false,
    "hideNodesInHierarchy": true
  }]
}, {
  "ruleType": "ChildNodes",
  "condition": "ParentNode.ClassName = \"A\"",
  "specifications": [{
    "specType": "RelatedInstanceNodes",
    "relationshipPaths": [{
        "relationship": { "schemaName": "MySchema", "className": "A_B" },
        "direction": "Forward"
    }],
    "groupByClass": false,
    "groupByLabel": false
  }]
}, {
  "ruleType": "ChildNodes",
  "condition": "ParentNode.ClassName = \"B\"",
  "specifications": [{
    "specType": "RelatedInstanceNodes",
    "relationshipPaths": [{
        "relationship": { "schemaName": "MySchema", "className": "A_B" },
        "direction": "Backward"
    }],
    "groupByClass": false,
    "groupByLabel": false
  }]
}]
```

**Result:**
```
+ A1          (class "A" grouping node)
+-+ Three     (instance node of class "B", ECInstanceId = 3)
| +-+ One     (instance node of class "A", ECInstanceId = 1)
+ A2          (class "A" grouping node)
+-+ Three     (instance node of class "B", ECInstanceId = 3)
  +-+ Two     (instance node of class "A", ECInstanceId = 2)
```

### Nodes' duplication when using `RelatedInstanceNodes` specification

Behavior of `RelatedInstanceNodes` specification when used with many-to-x relationships was changed.

Previously, when traversing from a parent node, that is based on multiple instances on the "many" side of the relationship where the other side of the relationship points to the same other instance, we would see duplication.

Now, in the situation described above, there will be no more duplication.
