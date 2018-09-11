# Content-related ECExpressions

## Instance Filter

ECExpressions that are specified in InstanceFilter specification properties are
converted to ECSQL WHERE clause, so they have some limitations - ony a subset of
all the ECExpression symbols are available.

The below table lists all of them:

| Symbol | Type                                                 | Value                                                                      |
|--------|------------------------------------------------------|----------------------------------------------------------------------------|
| `this` | [ECInstance context](../ECExpressions.md#ecinstance) | ECInstance expression context of ECInstance that's currently being handled |

Additionally, [User Setting symbols](../ECExpressions.md#symbols-in-global-context) are
available as well.