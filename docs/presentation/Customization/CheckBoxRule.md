# CheckBox Customization Rule

> **Note** This rule is deprecated. Use [extended data](./ExtendedDataUsage.md#customize-tree-node-item-checkbox) instead.

> TypeScript type: [CheckBoxRule]($presentation-common).

CheckBox rules provide a way to create a checkbox for specific types of ECInstance's.

## Attributes

| Name                                                              | Required? | Type                                                                 | Default     |
| ----------------------------------------------------------------- | --------- | -------------------------------------------------------------------- | ----------- |
| *Filtering*                                                       |
| [`requiredSchemas`](#attribute-requiredschemas)                   | No        | [`RequiredSchemaSpecification[]`](../Advanced/SchemaRequirements.md) | `[]`        |
| [`priority`](#attribute-priority)                                 | No        | `number`                                                             | `1000`      |
| [`onlyIfNotHandled`](#attribute-onlyifnothandled)                 | No        | `boolean`                                                            | `false`     |
| [`condition`](#attribute-condition)                               | No        | [ECExpression](./ECExpressions.md#rule-condition)                    | `""`        |
| *CheckBox Attributes*                                             |
| [`propertyName`](#attribute-propertyname)                         | No        | `string`                                                             | `undefined` |
| [`useInversedPropertyValue`](#attribute-useinversedpropertyvalue) | No        | `boolean`                                                            | `false`     |
| [`defaultValue`](#attribute-defaultvalue)                         | No        | `boolean`                                                            | `false`     |
| [`isEnabled`](#attribute-isenabled)                               | No        | `boolean`                                                            | `true`      |

### Attribute: `requiredSchemas`

> **Default value:** `[]`

Specifications that define schema requirements for the rule to take effect.

### Attribute: `priority`

> **Default value:** `1000`

Defines the order in which presentation rules are evaluated.

### Attribute: `onlyIfNotHandled`

> **Default value:** `false`

Should this rule be ignored if there is already an existing rule with a higher priority.

### Attribute: `condition`

> **Default value:** `""`

Defines a condition for the rule, which needs to be met in order to execute it.

### Attribute: `propertyName`

> **Default value:** `undefined`

Name of boolean type ECProperty which is bound with the check box state. When set, property value gets bound to checkbox state.

### Attribute: `useInversedPropertyValue`

> **Default value:** `false`

Should property value be inversed for the check box state. **Note:** Only makes sense when bound to an ECProperty.

### Attribute: `defaultValue`

> **Default value:** `false`

Default value to use for the check box state. **Note:** Only makes sense when *not* bound to an ECProperty.

### Attribute: `isEnabled`

> **Default value:** `true`

Indicates whether check box is enabled or disabled.

## Example

```JSON
{
  "ruleType": "CheckBox",
  "priority": 999,
  "stopFurtherProcessing": true,
  "requiredSchemas": [{ "name": "MySchema", "minVersion": "1.2.3" }],
  "condition": "ThisNode.IsOfClass(\"MyItem\", \"MySchema\")",
  "propertyName": "MyProperty",
  "useInversedPropertyValue": true,
  "isEnabled": false
}
```
