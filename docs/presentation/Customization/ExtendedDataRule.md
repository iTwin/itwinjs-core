# Extended Data Rule

> TypeScript type: [ExtendedDataRule]($presentation-common).

Extended data rule is used to inject some arbitrary data into presentation data objects (nodes, content records). See [Extended data usage](../Customization/ExtendedDataUsage.md) page for information on how to use injected data in our UI components.

## Typical Use Case

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
| [`requiredSchemas`](#attribute-requiredschemas) | No        | [`RequiredSchemaSpecification[]`](../Advanced/SchemaRequirements.md) | `[]`    |
| [`condition`](#attribute-condition)             | No        | [ECExpression](./ECExpressions.md#rule-condition)                    | `""`    |
| *Extended Data*                                 |
| [`items`](#attribute-items)                     | No        | `{ [key: string]: ECExpression }`                                    |         |

### Attribute: `requiredSchemas`

> **Default value:** `[]`

A list of ECSchema requirements that need to be met for the rule to be used. See more details in [Defining ECSchema Requirements for Presentation Rules](../Advanced/SchemaRequirements.md).

```ts
[[include:ExtendedDataRule.RequiredSchemas.Ruleset]]
```

### Attribute: `condition`

> **Default value:** `""`

Defines a condition which needs to be met in order for the rule to be used. The condition is an [ECExpression](./ECExpressions.md#rule-condition) which has to evaluate to a boolean value.

```ts
[[include:ExtendedDataRule.Condition.Ruleset]]
```

```ts
[[include:ExtendedDataRule.Condition.Result]]
```

### Attribute: `items`

A map of ECExpressions whose evaluation results are used as extended data values.

```ts
[[include:ExtendedDataRule.Items.Ruleset]]
```

```ts
[[include:ExtendedDataRule.Items.Result]]
```
