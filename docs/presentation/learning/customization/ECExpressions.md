# ECExpressions

## Rule Condition

Symbols available in Customization rule conditions:

| Symbol | Type | Value
|---|---|---
| ParentNode | [Node context](../ECExpressions.md#navnode) | The parent NavNode expression context.
| ThisNode | [Node context](../ECExpressions.md#navnode) | NavNode expression context of the ECInstance that's currently being handled. Not available in grouping rules and sorting rules.
| this | [ECInstance context](../ECExpressions.md#ecinstance) | ECInstance expression context of the ECInstance that's currently being handled. Not available in grouping rules and sorting rules.

Additionally, [User Settings symbols](../ECExpressions.md#symbols-in-global-context) are available as well.

## Override Value

Symbols available in Customization rule override values:

| Symbol | Type | Value
|---|---|---
| ThisNode | [Node context](../ECExpressions.md#navnode) | NavNode expression context of the ECInstance that's currently being handled.
| this | [ECInstance context](../ECExpressions.md#ecinstance) | ECInstance expression context of the ECInstance that's currently being handled. Not available in grouping rules and sorting rules.

Additionally, [User Settings symbols](../ECExpressions.md#symbols-in-global-context) are available as well.
