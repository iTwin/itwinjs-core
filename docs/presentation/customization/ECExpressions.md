# ECExpressions

## Rule condition

Symbols available in Customization rule conditions:

| Symbol     | Type                                                          | Value                                                                           |
| ---------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| ParentNode | [Node context](../advanced/ECExpressions.md#navnode)          | The parent NavNode expression context.                                          |
| ThisNode   | [Node context](../advanced/ECExpressions.md#navnode)          | NavNode expression context of the ECInstance that's currently being handled.    |
| this       | [ECInstance context](../advanced/ECExpressions.md#ecinstance) | ECInstance expression context of the ECInstance that's currently being handled. |

Additionally, [User Settings symbols](../advanced/ECExpressions.md#symbols-in-global-context) are available as well.

## Override value

Symbols available in Customization rule override values:

| Symbol   | Type                                                          | Value                                                                           |
| -------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| ThisNode | [Node context](../advanced/ECExpressions.md#navnode)          | NavNode expression context of the ECInstance that's currently being handled.    |
| this     | [ECInstance context](../advanced/ECExpressions.md#ecinstance) | ECInstance expression context of the ECInstance that's currently being handled. |

Additionally, [User Settings symbols](../advanced/ECExpressions.md#symbols-in-global-context) are available as well.
