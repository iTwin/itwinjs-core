# IModelConnection

The frontend of an app does not open a briefcase directly. Instead, it remotely "connects" to a briefcase that is managed by a [backend](../backend/index.md).

[IModelConnection]($frontend) is the main class used by frontends to access iModels. It encapsulates the [IModelReadRpcInterface]($common) and [IModelWriteRpcInterface]($common) interfaces and provides the mechanism  easy for frontend code to access an iModel to read and write element and model properties.

You can create a [Blank IModelConnection](./BlankConnection.md) to show Views of information from sources other than an iModel.

To open a non-blank IModelConnections, you must obtain an [AccessToken](../common/AccessToken.md). [IModelConnection.open]($frontend) takes that as an argument.
