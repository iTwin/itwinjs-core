# Defining ECSchema Requirements for Presentation Rules

Presentation rules may need to be modified as different ECSchemas evolve - new classes and properties may be added and they may require adding additional rules,
or, after a major schema release, some classes or properties may even get removed, in which case some rules may need to also be removed or adjusted.

In any case, the rules are not tightly bound to the ECSchema used by an iModel - an application that knows about schema X version 2 will still want to open older iModels
that use schema X version 1. This introduces a need to define not only schemas used by the ruleset as a whole, but to define them at rule level, and with ability to specify
which version of schema is required for specific rules.

The `requiredSchemas` attribute is designed specifically for that purpose and is available on [Rule]($presentation-common) and [SubCondition]($presentation-common)
interfaces. The attribute accepts a list of ECSchema names along with optional minimum required and maximum allowed versions.

## Examples

### Specifying required schemas for the ruleset

The below ruleset contains a content modifier for `Functional.FunctionalElement` class - we need to make sure the iModel supports all the ECSchemas that are
used in it.

```JSON
{
  "id": "my-ruleset",
  "requiredSchemas": [{
    "name": "Functional"
  }],
  "rules": [{
    "ruleType": "ContentModifier",
    "class": { "schemaName": "Functional", "className": "FunctionalElement" },
    // ... some overrides for Functional.FunctionalElement
  }]
}
```

### Specifying required schema in hierarchy rule

The below rule requests `FunctionalElement` instances to be loaded from `Functional` schema. We want to make sure the `Functional` schema is available in the iModel,
so we specify it as a required schema. The `FunctionalElement` class is available in all schema versions, so no need to specify versions range.

```JSON
{
  "ruleType": "RootNodes",
  "requiredSchemas": [{
    "name": "Functional"
  }],
  "specifications": [{
    "specType": "InstanceNodesOfSpecificClasses",
    "classes": { "schemaName": "Functional", "classNames": ["FunctionalElement"] }
  }]
}
```

### Specifying required schema in content modifier

The below rule requests `ExternalSource` properties to be loaded when loading content for related `Element` instances. The `ExternalSource` class was only
introduces in `BisCore` version `1.0.13`, so we're setting that as a requirement to avoid issues when iModels with older `BisCore` versions are opened.

```JSON
{
  "ruleType": "ContentModifier",
  "requiredSchemas": [{
    "name": "BisCore",
    "minVersion": "1.0.13"
  }],
  "class": { "schemaName": "BisCore", "className": "Element" },
  "relatedProperties": [{
    "propertiesSource": [{
      "relationship": { "schemaName": "BisCore", "className": "ExternalSourceAspect" },
      "requiredDirection": "Forward"
    }, {
      "relationship": { "schemaName": "BisCore", "className": "ElementIsFromSource" },
      "targetClass": { "schemaName": "BisCore", "className": "ExternalSource" },
      "requiredDirection": "Forward"
    }],
    "properties": ["ConnectorName"]
  }]
}
```
