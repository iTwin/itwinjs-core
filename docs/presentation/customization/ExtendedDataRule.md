# Extended data rule

> TypeScript type: [ExtendedDataRule]($presentation-common).

Extended data rule is used to inject some arbitrary data into presentation data objects (nodes, content records). See [Extended data usage](../customization/ExtendedDataUsage.md) page for information on how to use injected data in our UI components.

## Typical use case

Table is showing *Models* and *Elements* polymorphically and application wants to handle these two types
of rows differently.

### Problem

Each content record knows only it's exact ECClass, but there's no way to tell if that class is a subclass
of a *Model* or an *Element*.

### Solution

Extended data rule can be used to inject some flag that tells whether table row represents a model or an element. The
flag can then be accessed on the frontend and used to determine how the row should be handled.

## Attributes

| Name                                            | Required? | Type                                                                 | Default |
| ----------------------------------------------- | --------- | -------------------------------------------------------------------- | ------- |
| *Filtering*                                     |
| [`requiredSchemas`](#attribute-requiredschemas) | No        | [`RequiredSchemaSpecification[]`](../RequiredSchemaSpecification.md) | `[]`    |
| [`condition`](#attribute-condition)             | No        | [ECExpression](./ECExpressions.md#rule-condition)                    | `""`    |
| *Extended Data*                                 |
| [`items`](#attribute-items)                     | Yes       | `{ [key: string]: ECExpression }`                                    |         |

### Attribute: `requiredSchemas`

A list of [ECSchema requirements](../RequiredSchemaSpecification.md) that need to be met for the rule to be used.

|                   |                                                                      |
| ----------------- | -------------------------------------------------------------------- |
| **Type**          | [`RequiredSchemaSpecification[]`](../RequiredSchemaSpecification.md) |
| **Is Required**   | No                                                                   |
| **Default Value** | `[]`                                                                 |

```ts
[[include:Presentation.ExtendedDataRule.RequiredSchemas.Ruleset]]
```

### Attribute: `condition`

Defines a condition which needs to be met in order for the rule to be used. The condition is an [ECExpression](./ECExpressions.md#rule-condition) which has to evaluate to a boolean value.

|                   |                                                   |
| ----------------- | ------------------------------------------------- |
| **Type**          | [ECExpression](./ECExpressions.md#rule-condition) |
| **Is Required**   | No                                                |
| **Default Value** | `""`                                              |

```ts
[[include:Presentation.ExtendedDataRule.Condition.Ruleset]]
```

```ts
[[include:Presentation.ExtendedDataRule.Condition.Result]]
```

### Attribute: `items`

A map of [ECExpressions](./ECExpressions.md#rule-condition) whose evaluation results are used as extended data values.

|                 |                                   |
| --------------- | --------------------------------- |
| **Type**        | `{ [key: string]: ECExpression }` |
| **Is Required** | Yes                               |

```ts
[[include:Presentation.ExtendedDataRule.Items.Ruleset]]
```

```ts
[[include:Presentation.ExtendedDataRule.Items.Result]]
```
