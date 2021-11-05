# Extended Data Rule

> TypeScript type: [ExtendedDataRule]($presentation-common).

Extended data rule is used to inject some arbitrary data into presentation data objects (nodes, content records).

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

| Name               | Required? | Type                                                                 | Default | Meaning                                                                                  |
| ------------------ | --------- | -------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------- |
| *Filtering*        |
| `requiredSchemas`  | No        | [`RequiredSchemaSpecification[]`](../Advanced/SchemaRequirements.md) | `[]`    | Specifications that define schema requirements for the rule to take effect.              |
| `priority`         | No        | `number`                                                             | `1000`  | Defines the order in which presentation rules are evaluated.                             |
| `onlyIfNotHandled` | No        | `boolean`                                                            | `false` | Should this rule be ignored if there is already an existing rule with a higher priority. |
| `condition`        | No        | [ECExpression](./ECExpressions.md#rule-condition)                    | `""`    | Defines a condition for the rule, which needs to be met in order to execute it.          |
| *Extended Data*    |
| `items`            | No        | `{ [key: string]: ECExpression }`                                    |         | A map of ECExpressions whose evaluation results are used as extended data values         |

## Example

```JSON
{
  "ruleType": "ExtendedData",
  "requiredSchemas": [{ "name": "MySchema", "minVersion": "1.2.3" }],
  "items": {
    "isModel": "this.IsOfClass(\"Model\", \"BisCore\")"
  }
}
```
