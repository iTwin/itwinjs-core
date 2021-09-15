# ECExpressions

## Rule Condition

Symbols available in Customization rule conditions:

| Symbol     | Type                                                          | Value                                                                           |
| ---------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| ParentNode | [Node context](../Advanced/ECExpressions.md#navnode)          | The parent NavNode expression context.                                          |
| ThisNode   | [Node context](../Advanced/ECExpressions.md#navnode)          | NavNode expression context of the ECInstance that's currently being handled.    |
| this       | [ECInstance context](../Advanced/ECExpressions.md#ecinstance) | ECInstance expression context of the ECInstance that's currently being handled. |

Additionally, [User Settings symbols](../Advanced/ECExpressions.md#symbols-in-global-context) are available as well.

## Override Value

Symbols available in Customization rule override values:

| Symbol   | Type                                                          | Value                                                                           |
| -------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| ThisNode | [Node context](../Advanced/ECExpressions.md#navnode)          | NavNode expression context of the ECInstance that's currently being handled.    |
| this     | [ECInstance context](../Advanced/ECExpressions.md#ecinstance) | ECInstance expression context of the ECInstance that's currently being handled. |

Additionally, [User Settings symbols](../Advanced/ECExpressions.md#symbols-in-global-context) are available as well.
