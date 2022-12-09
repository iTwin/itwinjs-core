# Label override

> **Note:** This rule is deprecated. Use [InstanceLabelOverride](./InstanceLabelOverride.md) rule instead.

> TypeScript type: [LabelOverride]($presentation-common).

Label override rules provide advanced ways to override instance labels and descriptions in
exchange of some performance penalty.

## Attributes

| Name                                              | Required? | Type                                                                 | Default |
| ------------------------------------------------- | --------- | -------------------------------------------------------------------- | ------- |
| *Filtering*                                       |
| [`requiredSchemas`](#attribute-requiredschemas)   | No        | [`RequiredSchemaSpecification[]`](../RequiredSchemaSpecification.md) | `[]`    |
| [`priority`](#attribute-priority)                 | No        | `number`                                                             | `1000`  |
| [`onlyIfNotHandled`](#attribute-onlyifnothandled) | No        | `boolean`                                                            | `false` |
| [`condition`](#attribute-condition)               | No        | [ECExpression](./ECExpressions.md#rule-condition)                    | `""`    |
| *Overrides*                                       |
| [`label`](#attribute-label)                       | No        | [ECExpression](./ECExpressions.md#override-value)                    | `""`    |
| [`description`](#attribute-description)           | No        | [ECExpression](./ECExpressions.md#override-value)                    | `""`    |

### Attribute: `requiredSchemas`

Specifications that define [ECSchema requirements](../RequiredSchemaSpecification.md) for the rule to take effect.

|                   |                                                                      |
| ----------------- | -------------------------------------------------------------------- |
| **Type**          | [`RequiredSchemaSpecification[]`](../RequiredSchemaSpecification.md) |
| **Is Required**   | No                                                                   |
| **Default Value** | `[]`                                                                 |

### Attribute: `priority`

Defines the order in which presentation rules are evaluated.

|                   |          |
| ----------------- | -------- |
| **Type**          | `number` |
| **Is Required**   | No       |
| **Default Value** | `1000`   |

### Attribute: `onlyIfNotHandled`

Should this rule be ignored if there is already an existing rule with a higher priority.

|                   |           |
| ----------------- | --------- |
| **Type**          | `boolean` |
| **Is Required**   | No        |
| **Default Value** | `false`   |

### Attribute: `condition`

Defines a condition for the rule, which needs to be met in order to execute it.

|                   |                                                   |
| ----------------- | ------------------------------------------------- |
| **Type**          | [ECExpression](./ECExpressions.md#rule-condition) |
| **Is Required**   | No                                                |
| **Default Value** | `""`                                              |

### Attribute: `label`

An expression whose result becomes the label.

|                   |                                                   |
| ----------------- | ------------------------------------------------- |
| **Type**          | [ECExpression](./ECExpressions.md#override-value) |
| **Is Required**   | No                                                |
| **Default Value** | `""`                                              |

### Attribute: `description`

An expression whose result becomes the description.

|                   |                                                   |
| ----------------- | ------------------------------------------------- |
| **Type**          | [ECExpression](./ECExpressions.md#override-value) |
| **Is Required**   | No                                                |
| **Default Value** | `""`                                              |

## Example

```JSON
{
  "ruleType": "LabelOverride",
  "requiredSchemas": [{ "name": "MySchema", "minVersion": "1.2.3" }],
  "priority": 999,
  "stopFurtherProcessing": true,
  "condition": "ThisNode.IsOfClass(\"MyItem\", \"MySchema\")",
  "label": "\"Volume: \" & (this.Height * this.Width * this.Length)",
  "description": "\"Physical item\""
}
```

## Known issues

The rule should be avoided in favor of [InstanceLabelOverride](./InstanceLabelOverride) due to:

- `InstanceLabelOverride` rules **always** take precedence over `LabelOverride`, no matter what their priorities are.
A possible workaround is to avoid having `InstanceLabelOverride` rules for the class targeted by specific
`LabelOverride`. If `InstanceLabelOverride` rules come from a supplemental schema, that can't be controlled, there's an
option to add such an `InstanceLabelOverride` to reset overrides in supplemental ruleset:

  ```JSON
  {
    "ruleType": "InstanceLabelOverride",
    "priority": 9999,
    "class": { "schemaName": "MySchema", "className": "MyClass" },
    "values": []
  }
  ```

- Nested `LabelOverride` rules (specified anywhere else other than at the root rules level) have no effect.
A possible workaround is to move them to the root rules level.
