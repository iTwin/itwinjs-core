# Content-related ECExpressions

## Rule Condition

Content rules have a `condition` ECExpression property which defines which rules should
be applied for which instances. The following ECExpression symbols are available there:

| Symbol                  | Type                                           | Value                                                             |
|-------------------------|------------------------------------------------|-------------------------------------------------------------------|
| `SelectedNode`          | [NavNode context](../ECExpressions.md#navnode) | Expression context of NavNode the content is being requested for. |
| `ContentDisplayType`    | string | Preferred display type of the content. It identifies which component will be used to show the content.    |
| `SelectionProviderName` | string | Name of the selection handler that last changed the selection.                                            |
| `IsSubSelection`        | bool   | Indicates whether the last selection event changed the main selection or sub selection.                   |

Additionally, [Ruleset variable symbols](../ECExpressions.md#ruleset-variables-user-settings)
are available as well.

## Instance Filter

ECExpressions that are specified in `instanceFilter` specification properties are
converted to ECSQL WHERE clause, so they have some limitations - ony a subset of
all the ECExpression symbols are available.

The below table lists all of them:

| Symbol | Type                                                 | Value                                                                      |
|--------|------------------------------------------------------|----------------------------------------------------------------------------|
| `this` | [ECInstance context](../ECExpressions.md#ecinstance) | ECInstance expression context of ECInstance that's currently being handled |

Additionally, [User Setting symbols](../ECExpressions.md#symbols-in-global-context) are
available as well.
