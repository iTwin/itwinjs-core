# Hierarchies-related ECExpressions

## Rule Condition

Child node rules have a `condition` ECExpression property which defines which rules should
be applied for which parent nodes. The following ECExpression symbols are available there:

| Symbol       | Type                                           | Value                                  |
|--------------|------------------------------------------------|----------------------------------------|
| `ParentNode` | [NavNode context](../ECExpressions.md#navnode) | The parent NavNode expression context. |

Additionally, [Ruleset variable symbols](../ECExpressions.md#ruleset-variables-user-settings)
are available as well.

## Instance Filter

ECExpressions that are specified in `instanceFilter` specification properties
are converted to ECSQL WHERE clause, so they have some limitations - ony a subset
 of all the ECExpression symbols are available.

The below table lists all of them:

| Symbol   | Type                                                 |Value                                                                            |
|----------|------------------------------------------------------|---------------------------------------------------------------------------------|
| `parent` | [ECInstance context](../ECExpressions.md#ecinstance) | The parent ECInstance expression context.                                       |
| `this`   | [ECInstance context](../ECExpressions.md#ecinstance) | ECInstance expression context of the ECInstance that's currently being handled. |

Additionally, [Ruleset variable symbols](../ECExpressions.md#ruleset-variables-user-settings)
are available as well.
