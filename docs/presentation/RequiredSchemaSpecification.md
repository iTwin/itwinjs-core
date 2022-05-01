# Required schema specification

> TypeScript type: [RequiredSchemaSpecification]($presentation-common).

Presentation rules may need to be modified as different ECSchemas evolve - new classes and properties may be added and they may require adding additional rules,
or, after a major schema release, some classes or properties may even get removed, in which case some rules may need to also be removed or adjusted.

In any case, the rules are not tightly bound to the ECSchema used by an iModel - an application that knows about schema X version 2 will still want to open older iModels
that use schema X version 1. This introduces a need to define not only schemas used by the ruleset as a whole, but to define them at rule level, and with ability to specify
which version of schema is required for specific rules.

This specification is designed specifically for that purpose. It accepts a list of ECSchema names along with optional minimum required and maximum allowed versions.

## Attributes

| Name                                  | Required? | Type     | Default     |
| ------------------------------------- | --------- | -------- | ----------- |
| [`name`](#attribute-name)             | Yes       | `string` |             |
| [`minVersion`](#attribute-minversion) | No        | `string` | `undefined` |
| [`maxVersion`](#attribute-maxversion) | No        | `string` | `undefined` |

### Attribute: `name`

Specifies the schema to whom the requirement is being set.

|                 |          |
| --------------- | -------- |
| **Type**        | `string` |
| **Is Required** | Yes      |

### Attribute: `minVersion`

Minimum required schema version (inclusive). Format: `{read version}.{write version}.{minor version}`, e.g. `2.1.15`.

|                   |             |
| ----------------- | ----------- |
| **Type**          | `string`    |
| **Is Required**   | No          |
| **Default Value** | `undefined` |

### Attribute: `maxVersion`

Maximum allowed schema version (exclusive). Format: `{read version}.{write version}.{minor version}`, e.g. `2.1.15`.

|                   |             |
| ----------------- | ----------- |
| **Type**          | `string`    |
| **Is Required**   | No          |
| **Default Value** | `undefined` |

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

### Specifying required schema in a hierarchy rule

```ts
[[include:Presentation.Hierarchies.RequiredSchemas.Ruleset]]
```

### Specifying required schema in content modifier

```ts
[[include:Presentation.ContentModifier.RequiredSchemas.Ruleset]]
```
