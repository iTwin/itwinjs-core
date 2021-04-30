# InstanceLabelOverride Customization Rule

> Based on [InstanceLabelOverride]($presentation-common) interface.

Instance label override rule provides a way to set instance label to one of its property values, other attributes and/or combination of them. If more
advanced labels are necessary, there's also a [LabelOverride rule](./LabelOverride.md) which uses [ECExpressions](../ECExpressions.md) to create the
label, but costs more performance-wise.

## Attributes

Name | Required? | Type | Default | Meaning
-|-|-|-|-
*Filtering* |
`requiredSchemas` | No | [`RequiredSchemaSpecification[]`](../SchemaRequirements.md) | `[]` | Specifications that define schema requirements for the rule to take effect.
`priority` | No | `number` | `1000` | Defines the order in which presentation rules are evaluated.
`onlyIfNotHandled` | No | `boolean` | `false` | Should this rule be ignored if there is already an existing rule with a higher priority.
`class` | Yes | `SingleSchemaClassSpecification` | | Specification of the ECClass to apply this rule to.
*Overrides* |
`values` | Yes | `InstanceLabelOverrideValueSpecification[]` | |  Specifications for the label value. The first non-empty value is used as the actual label.

## InstanceLabelOverrideValueSpecification Types and Attributes

### Composite

`InstanceLabelOverrideCompositeValueSpecification` allows creating a label value composited using multiple other specifications.

Name | Required? | Type | Default | Meaning
-|-|-|-|-
`parts` | Yes | `Array<{ spec: InstanceLabelOverrideValueSpecification; isRequired?: boolean }>` | | Parts of the value. If any of the parts with `isRequired` flag evaluate to an empty string, the result of this specification is also an empty string.
`separator` | No | `string` | Space character | Separator to use when joining the parts.

### Property

`InstanceLabelOverridePropertyValueSpecification` uses property value as the label content.

Name | Required? | Type | Default | Meaning
-|-|-|-|-
`propertyName` | Yes | `string` | | Name of the property whose value should be used.
`propertySource` | No | `RelationshipPathSpecification` | Empty path | [Specification of the relationship path](../RelationshipPathSpecification.md) from `InstanceLabelOverride.class` to class of the property.

### String

`InstanceLabelOverrideStringValueSpecification` uses the specified value as the label content.

Name | Required? | Type | Default | Meaning
-|-|-|-|-
`value` | Yes | `string` | | The value to use as the label content.

### ClassName

`InstanceLabelOverrideClassNameSpecification` uses ECClass name as the label content.

Name | Required? | Type | Default | Meaning
-|-|-|-|-
`full` | No | `boolean` | `false` | Should full (`{schemaName}.{className}`) class name be used.

### ClassLabel

`InstanceLabelOverrideClassLabelSpecification` uses ECClass display label as the label content. It has no additional attributes.

### BriefcaseId

`InstanceLabelOverrideBriefcaseIdSpecification` returns ECInstance's briefcase ID in base36 format. It has no additional attributes.

### LocalId

`InstanceLabelOverrideLocalIdSpecification` returns ECInstance's local ID in base36 format. It has no additional attributes.

### RelatedInstanceLabel

`InstanceLabelOverrideRelatedInstanceLabelSpecification` uses label of another related instance as the label content.

Name | Required? | Type | Default | Meaning
-|-|-|-|-
`pathToRelatedInstance` | Yes | `RelationshipPathSpecification` | | [Specification of the relationship path](../RelationshipPathSpecification.md) from `InstanceLabelOverride.class` to class of the related instance.

## Example

The above override takes effect on all `MySchema.MyClass` ECInstances. First, it attempts to use `MyProperty1` value as the label. If that's not
set, then it uses `{class_label} [{briefcase_id}-{local_id}]` label.

```JSON
{
  "ruleType": "InstanceLabelOverride",
  "priority": 999,
  "requiredSchemas": [{ "name": "MySchema", "minVersion": "1.2.3" }],
  "class": { "schemaName": "MySchema", "className": "MyClass" },
  "values": [{
    "specType": "Property",
    "propertyName": "MyProperty1"
  }, {
    "specType": "Composite",
    "separator": " ",
    "parts": [
      {
        "spec": {
          "specType": "ClassLabel"
        },
        "isRequired": true
      },
      {
        "spec": {
          "specType": "Composite",
          "separator": "",
          "parts": [
            {
              "spec": {
                "specType": "String",
                "value": "["
              }
            },
            {
              "spec": {
                "specType": "BriefcaseId"
              }
            },
            {
              "spec": {
                "specType": "String",
                "value": "-"
              }
            },
            {
              "spec": {
                "specType": "LocalId"
              }
            },
            {
              "spec": {
                "specType": "String",
                "value": "]"
              }
            }
          ]
        }
      }
    ]
  }]
}
```
