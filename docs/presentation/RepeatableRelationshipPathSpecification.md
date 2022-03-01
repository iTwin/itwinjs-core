# Repeatable Relationship Path Specification

> TypeScript type: [RepeatableRelationshipPathSpecification]($presentation-common).

Repeatable relationship path specification is used to define a relationship path to an ECClass, optionally traversing through the same relationship
multiple times or recursively.

The specification is always used in a context where source class already exists, so it only requires the relationship and direction. The
target class can be inferred from the two required attributes or specified with the [`targetClass` attribute](#attribute-targetclass). In case of a
multi-step path, target of the current step is used as the source of the next step.

## Attributes

| Name                                      | Required? | Type                             | Default                       |
| ----------------------------------------- | --------- | -------------------------------- | ----------------------------- |
| [`relationship`](#attribute-relationship) | Yes       | `SingleSchemaClassSpecification` |                               |
| [`direction`](#attribute-direction)       | Yes       | `"Forward" \| "Backward"`        |                               |
| [`targetClass`](#attribute-targetclass)   | No        | `SingleSchemaClassSpecification` | Other end of the relationship |
| [`count`](#attribute-count)               | No        | `number \| "*"`                  | `1`                           |

### Attribute: `relationship`

This attribute specifies the ECRelationship that should be used to traverse to target class.

### Attribute: `direction`

This attribute specifies the direction in which the [relationship](#attribute-relationship) should be followed:

- `"Forward"` - the relationship is traversed from source to target of the relationship.
- `"Backward"` - the relationship is traversed from target to source of the relationship.

### Attribute: `targetClass`

> **Default value:** Target ECClass of the [relationship](#attribute-relationship) if the [direction](#attribute-direction) is `"Forward"` or
> source ECClass if the [direction](#attribute-direction) is `"Backward"`.

This attribute may be used to specialize the target of the relationship. E.g. when relationship points to a class like `bis.Element`, this
attribute allows specializing it to `bis.PhysicalElement` or some other `bis.Element` subclass.

### Attribute: `count`

> **Default value:** `1`

This attribute specifies the number of times the relationship should be traversed.

The special `"*"` value makes the step recursive, which means the relationship is traversed as long as new instances are found by
using output of the previous step as input for the current step. Outputs of each step traversal are accumulated, combined with outputs
of the previous step (if any) and passed as input to the next step or used as path output if there are no more steps.

## Examples

When the [`count` attribute](#attribute-count) is omitted or set to `1`, the specification works similarly to [RelationshipPathSpecification](./RelationshipPathSpecification.md). See its [examples section](./RelationshipPathSpecification.md#examples) for those simpler cases.

### Jumping through the same relationship recursively fixed number of times

```ts
[[include:RepeatableRelationshipPathSpecification.SingleStepWithCount.Ruleset]]
```

![Content of the grand-parent element](./media/repeatablerelationshippathspecification-singlestep-with-count.png)

### Jumping through the relationship recursively unbounded number of times

```ts
[[include:RepeatableRelationshipPathSpecification.RecursiveSingleStep.Ruleset]]
```

When the root subject is provided as input, content for all its child elements is returned:

![Content of all root subject's child elements](./media/repeatablerelationshippathspecification-recursivesinglestep.png)

### Combining recursive and non-recursive steps

```ts
[[include:RepeatableRelationshipPathSpecification.RecursiveAndNonRecursiveSpecificationsCombination.Ruleset]]
```

When a physical model is provided as input, categories' content of all its elements and their children is returned:

![Categories' content of model elements and their children](./media/repeatablerelationshippathspecification-combinedsteps.png)

### Combining multiple unbounded recursive steps

```ts
[[include:RepeatableRelationshipPathSpecification.MultipleRecursiveSpecificationsCombination.Ruleset]]
```

![Content of multiple recursive relationship steps](./media/repeatablerelationshippathspecification-combinedrecursivesteps.png)
