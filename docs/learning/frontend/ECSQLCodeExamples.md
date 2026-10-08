# Frontend ECSQL Code Examples

For working directly with an iModel from the frontend, an [IModelConnection]($frontend) is used.

Use [IModelConnection.createQueryReader]($frontend) for asynchronous queries. The returned [ECSqlReader]($common) is consumed with asynchronous iteration or awaited calls to `step()` and `toArray()`.

See the [shared asynchronous query examples](../ECSQLCodeExamples.md). Their `iModel` variable can be an `IModelConnection`. The synchronous `withQueryReader` API is backend-only.
