# IModelConnection

The frontend of an app does not open a briefcase directly. Instead, it remotely "connects" to a briefcase that is managed by a [backend](../backend/index.md).

[IModelConnection]($frontend) is the main class used by frontends to access iModels. It is a handy wrapper around [IModelReadRpcInterface]($common) and [IModelWriteRpcInterface]($common). It makes it easy for frontend code to get access to a particular iModel and then read and write element and model properties.

The frontend must obtain an [AccessToken](../common/AccessToken.md) to open an IModelConnection. [IModelConnection.open]($frontend) takes that as an argument.