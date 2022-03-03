# Repeatable Relationship Path Specification

> TypeScript type: [RepeatableRelationshipPathSpecification]($presentation-common).

This specification declares a step in a relationship path between a source and target ECInstances. A step can optionally be repeated a number of times to traverse the same relationship recursively. Multiple specifications of this type can be chained together to express complex indirect relationships.

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

When a number is specified, the relationship is traversed recursively the specified number of times.

When it is set to a special value `"*"`, the same relationship is traversed recursively unbounded number of times, starting from zero (the relationship is not followed). On each traversal iteration, Presentation rules engine accumulates all indirectly related ECInstances as defined by the remaining relationship path.

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
