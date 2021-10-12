# Grouping Customization Rule

> TypeScript type: [GroupingRule]($presentation-common).

Grouping rules provide advanced ways to group instances when creating hierarchies.

It allows to define these types of groupings:

- Group by base class.
- Group by any property of the instance by a common value or a range of values.
- Group multiple instances with the same label in to one ECInstance node. This can be used in cases when these instances represent the same object for the user.

The rule works in conjunction with other grouping options available in [navigation specifications](./ChildNodeRule.md#attribute-specifications): `groupByClass` and `groupByLabel`. The grouping hierarchy looks like this:

- Base ECClass grouping node (specified by [base class grouping specification](#base-class-grouping))
  - ECClass grouping node (specified by `groupByClass` property)
    - ECProperty grouping node 1 (specified by 1st [property grouping specification](#property-grouping))
      - ECProperty grouping node 2 (specified by 2nd [property grouping specification](#property-grouping))
        - ECProperty grouping node n (specified by n-th [property grouping specification](#property-grouping))
          - Display label grouping node (specified by `groupByLabel` property)
            - ECInstance nodes (may be grouped under a single node by [same label instance grouping specification](#same-label-instance-grouping))

The rule itself works in a similar way as hierarchy rules - *rule* identifies *what* to group and it has *specifications* which tell *how*
to do that.

## Attributes

| Name               | Required? | Type                                                                 | Default | Meaning                                                                                  |
| ------------------ | --------- | -------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------- |
| *Filtering*        |
| `requiredSchemas`  | No        | [`RequiredSchemaSpecification[]`](../Advanced/SchemaRequirements.md) | `[]`    | Specifications that define schema requirements for the rule to take effect.              |
| `priority`         | No        | `number`                                                             | `1000`  | Defines the order in which presentation rules are evaluated.                             |
| `onlyIfNotHandled` | No        | `boolean`                                                            | `false` | Should this rule be ignored if there is already an existing rule with a higher priority. |
| `condition`        | No        | [ECExpression](./ECExpressions.md#rule-condition)                    | `""`    | Defines a condition for the rule, which needs to be met in order to execute it.          |
| `class`            | Yes       | `SingleSchemaClassSpecification`                                     |         | Specification of ECClass which should be grouped using this rule.                        |
| *Grouping*         |
| `groups`           | Yes       | `GroupingSpecification[]`                                            |         | Specifications of grouping which should be applied to matching ECInstances.              |

## Grouping Specifications

There are 3 types of supported grouping: [base class grouping](#base-class-grouping), [property grouping](#property-grouping) and [same label instance grouping](#same-label-instance-grouping).

### Base Class Grouping

Base class grouping allows grouping ECInstance nodes by their base class.

#### Attributes

| Name                       | Required? | Type                             | Default        | Meaning                                                                      |
| -------------------------- | --------- | -------------------------------- | -------------- | ---------------------------------------------------------------------------- |
| `createGroupForSingleItem` | No        | `boolean`                        | `false`        | Should the grouping node be created if there is only one item in that group. |
| `baseClass`                | No        | `SingleSchemaClassSpecification` | Rule's `class` | Specification of the base ECClass to group by.                               |

### Property Grouping

Property grouping allows grouping by property of the instance by a value or by ranges of values.

#### Attributes

| Name                              | Required? | Type                                                                               | Default          | Meaning                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------------------- | --------- | ---------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createGroupForSingleItem`        | No        | `boolean`                                                                          | `false`          | Should the grouping node be created if there is only one item in that group.                                                                                                                                                                                                                                                                                                                      |
| `createGroupForUnspecifiedValues` | No        | `boolean`                                                                          | `true`           | Should a separate grouping node be created for nodes whose grouping value is not set.                                                                                                                                                                                                                                                                                                             |
| `propertyName`                    | Yes       | `string`                                                                           |                  | Name of the ECProperty which is used for grouping.                                                                                                                                                                                                                                                                                                                                                |
| `imageId`                         | No        | `string`                                                                           | `""`             | ID of an image to use for the grouping node.                                                                                                                                                                                                                                                                                                                                                      |
| `groupingValue`                   | No        | `"PropertyValue" \| "DisplayLabel"`                                                | `"DisplayLabel"` | Should the instances be grouped on display label or the grouping property value. **Note:** Grouping by property value is required if the display label is overridden to display grouped instances count. **Warning:** Grouping by label and sorting by property value is not possible.                                                                                                            |
| `sortingValue`                    | No        | `"PropertyValue" \| "DisplayLabel"`                                                | `"DisplayLabel"` | Should the nodes be sorted by display label or the grouping property value. In most cases the result is the same, unless [LabelOverride]($presentation-common) rule is used to change the display label. **Note:** Sorting by property value only makes sense when instances are grouped by property value as well. **Warning:** Grouping by label and sorting by property value is not possible. |
| `ranges`                          | No        | [`PropertyRangeGroupSpecification[]`](#propertyrangegroupspecification-attributes) | `[]`             | Ranges into which the grouping values are divided. Instances are grouped by value if no ranges are specified.                                                                                                                                                                                                                                                                                     |

#### PropertyRangeGroupSpecification Attributes

| Name        | Required? | Type     | Default                                                             | Meaning                                                               |
| ----------- | --------- | -------- | ------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `imageId`   | No        | `string` | `imageId` of the [property group specification](#property-grouping) | ID of an image to use for the grouping node.                          |
| `label`     | No        | `string` | `"{from value} - {to value}"`                                       | Grouping node label. May be [localized](../Advanced/Localization.md). |
| `fromValue` | Yes       | `string` |                                                                     | Value that defines the range start (inclusive)                        |
| `toValue`   | Yes       | `string` |                                                                     | Value that defines the range end (inclusive)                          |

### Same Label Instance Grouping

Allows grouping multiple instances with the same label into one ECInstance node. Similar to display label grouping, but instead of showing a grouping node with multiple grouped nodes, it shows a single ECInstances node which represents multiple ECInstances.

#### Attributes

| Name               | Required? | Type                                     | Default   | Meaning                                                   |
| ------------------ | --------- | ---------------------------------------- | --------- | --------------------------------------------------------- |
| `applicationStage` | No        | `SameLabelInstanceGroupApplicationStage` | `"Query"` | Stage of hierarchy creation at which the rule is applied. |

## Example

```JSON
{
  "ruleType": "Grouping",
  "priority": 999,
  "requiredSchemas": [{ "name": "MySchema", "minVersion": "1.2.3" }],
  "class": { "schemaName": "MySchema", "className": "MyClass" },
  "groups": [{
    "specType": "Property",
    "propertyName": "MyProperty",
    "imageId": "MyImage",
    "createGroupForSingleItem": true,
    "createGroupForUnspecifiedValues": false
  }]
}
```
