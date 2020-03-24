# IModelConnection

The frontend of an app does not open an iModel directly. Instead, it remotely "connects" to an [IModelDb]($backend) that is managed by a [backend](../backend/index.md).

[IModelConnection]($frontend) is the main class used by frontends to access iModels. It encapsulates the [IModelReadRpcInterface]($common) and [IModelWriteRpcInterface]($common) interfaces and provides the mechanism  easy for frontend code to access an iModel to read and write element and model properties.

The following subclasses of [IModelConnection]($frontend) are used depending on the type of connection desired:

- [BriefcaseConnection]($frontend)
- [SnapshotConnection]($frontend)
- [BlankConnection]($frontend)

To open a [BriefcaseConnection]($frontend), you must obtain an [AccessToken](../common/AccessToken.md). [BriefcaseConnection.open]($frontend) takes that as an argument.

A [SnapshotConnection]($frontend) is intended for desktop and mobile (aka *native*) applications and should not be used for web applications.

You can create a [Blank IModelConnection](./BlankConnection.md) to show Views of information from sources other than an iModel.
