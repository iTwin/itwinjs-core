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

## Asynchronous paging

Concurrent queries can retain an unfinished worker statement after a batch reaches its memory or time quota between rows. The next contiguous batch from the same reader can continue stepping that statement instead of re-running the query and discarding all preceding rows. This avoids repeated scans and, for queries that need a sorter, repeated sorting.

Reuse is automatic for eligible queries, but opportunistic rather than a persistent server-side cursor contract. The reader must continue with the next contiguous batch of the same query and parameters. If the owning worker is busy, the request briefly waits in the queue while other eligible requests can proceed, then falls back to another available worker. Queued requests remain cancellable. Cache pressure, expiration, or an observed committed data change also returns paging to the existing LIMIT/OFFSET path. Queries interrupted while stepping cannot resume.

Use a deterministic `ORDER BY` when page ordering matters. Nondeterministic expressions may be evaluated once for a retained execution rather than once per batch; do not rely on batch boundaries to re-evaluate them. Reuse does not guarantee a single read snapshot for the lifetime of the reader, since a later batch can fall back to re-execution.

Primary-connection requests, databases not using WAL, and worker connections with attached data databases do not retain cursors. The WAL requirement also applies to read-only handles: another process can still modify the file, and an unfinished rollback-journal reader could block that writer's commit.

A retained statement can hold sorter memory, temporary files, and a read snapshot between batches. Retention is bounded, idle statements expire automatically, and observed external commits invalidate retained statements. Retained WAL snapshots can temporarily delay checkpoint progress. These resource costs are a tradeoff for avoiding repeated query execution, not a promise of lower overall memory use.

Result conversion reduces repeated metadata lookups and temporary JSON allocations for supported scalars, navigation properties, points, structs, and arrays. Point-coordinate reuse and more efficient ID formatting reduce per-row work. Unsupported result shapes continue using the existing conversion path. The documented [row-format](../ECSQLRowFormat.md) and null-handling rules are unchanged.

## Examples

- [Asynchronous query examples](../ECSQLCodeExamples.md) — recommended starting point for frontend and backend queries.
- [Synchronous backend query examples](./WithQueryReaderCodeExamples.md) — callback-scoped execution with `withQueryReader`.
- [Migrating backend query code](./ECSQLCodeExamples.md) — parameter and result-shape differences from `withPreparedStatement`.
- [Frequently used ECSQL queries](./ECSQL-queries.md) — queries for common application tasks.

## Data modification

For iModels, use ECSQL SELECT statements to query data and the iModel APIs to modify it, such as [IModelDb.Elements.updateElement]($backend).

For a standalone [ECDb]($backend), use [ECDb.withCachedWriteStatement]($backend) or [ECDb.withWriteStatement]($backend) for ECSQL INSERT, UPDATE, and DELETE statements.

See [ECSQL](../ECSQL.md) for the query language and [ECSQL parameters](../ECSQL.md#ecsql-parameters) for parameter syntax.
