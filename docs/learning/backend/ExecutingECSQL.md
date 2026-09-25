# Executing ECSQL with the iTwin.js Backend

Use [IModelDb.createQueryReader]($backend) or [ECDb.createQueryReader]($backend) for asynchronous queries. When backend code requires synchronous execution, use [IModelDb.withQueryReader]($backend) or [ECDb.withQueryReader]($backend).

Both APIs accept an ECSQL string and a [QueryBinder]($common), and expose rows through a [QueryRowProxy]($common). Their execution, lifetime, and options differ:

## Choosing a query reader

| | `createQueryReader` — asynchronous | `withQueryReader` — synchronous |
| --- | --- | --- |
| Availability | Frontend and backend | Backend only; currently beta |
| Call shape | `createQueryReader(ecsql, params?, config?)` returns an [ECSqlReader]($common) | `withQueryReader(ecsql, callback, params?, config?)` invokes a callback with an [ECSqlSyncReader]($backend) and returns the callback's result |
| Execution | Starts when the reader is consumed; retrieves and buffers batches of rows | Prepares before invoking the callback; steps one row at a time without buffering result batches |
| Iteration | `for await...of`, `await reader.step()`, or `await reader.toArray()` | `for...of`, `reader.step()`, or `reader.toArray()` inside the callback |
| Connection | Uses concurrent-query worker connections by default | Uses the owning database connection |
| Unsaved changes | Set `usePrimaryConn: true` when the query needs to see unsaved changes on the owning connection | Can read unsaved changes on the owning connection |
| Options | [QueryOptions]($common), including paging limits and concurrent-query controls | [SynchronousQueryOptions]($backend), a subset for result formatting; no `limit`, `restartToken`, `priority`, `quota`, or `usePrimaryConn` |
| Lifetime | Consume the reader while its database/connection remains open | Finish using the reader before the callback completes; return materialized rows or computed values |

Asynchronous iteration can consume rows already buffered before an edit. Setting `usePrimaryConn` changes the connection used to execute the query; it does not remove result buffering. Use synchronous stepping when backend code needs to interleave row consumption with other synchronous operations. Synchronous query execution blocks the calling JavaScript thread.

Both readers default to indexed rows when collecting results with `reader.toArray()`. They share the [row-format rules](../ECSQLRowFormat.md) and [parameter-binding support](../ECSQLParameterTypes.md). Their prepared statements can be cached independently of result buffering.

## Examples

- [Asynchronous query examples](../ECSQLCodeExamples.md) — recommended starting point for frontend and backend queries.
- [Synchronous backend query examples](./WithQueryReaderCodeExamples.md) — callback-scoped execution with `withQueryReader`.
- [Migrating backend query code](./ECSQLCodeExamples.md) — parameter and result-shape differences from `withPreparedStatement`.
- [Frequently used ECSQL queries](./ECSQL-queries.md) — queries for common application tasks.

## Data modification

For iModels, use ECSQL SELECT statements to query data and the iModel APIs to modify it, such as [IModelDb.Elements.updateElement]($backend).

For a standalone [ECDb]($backend), use [ECDb.withCachedWriteStatement]($backend) or [ECDb.withWriteStatement]($backend) for ECSQL INSERT, UPDATE, and DELETE statements.

See [ECSQL](../ECSQL.md) for the query language and [ECSQL parameters](../ECSQL.md#ecsql-parameters) for parameter syntax.
