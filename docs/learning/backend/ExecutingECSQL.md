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

Reuse is opportunistic, not a persistent server-side cursor contract. It requires matching ECSQL, typed parameters, offset, and remaining count, and an available owning worker connection. Cache pressure, expiration, or an observed committed data change returns paging to the existing LIMIT/OFFSET path. Queries interrupted while stepping cannot resume. Use a deterministic `ORDER BY` when page ordering matters; do not depend on re-evaluation of nondeterministic expressions for each batch.

Backend concurrent-query configuration provides `enableCursors` (default `true`), `maxCursorsPerWorker`, and `cursorIdleTimeout` (default 30 seconds). A cap of `-1` uses the statement-cache size for a read-only primary or four cursors per worker for a writable WAL database. An explicit non-negative cap is bounded by `statementCacheSizePerWorker`; zero disables retention. `enableCursors: false` restores re-execution for every batch. Primary-connection requests, databases not using WAL, and worker connections with attached data databases do not retain cursors.

A parked statement retains SQLite execution state, which can include sorter memory or temporary files and a read snapshot. Read-only handles do not guarantee that another process cannot modify the file. Retention requires WAL even for read-only handles, since an unfinished rollback-journal reader can block an external writer's commit. An independent connection observes external commits, and idle cursors expire on the monitor's next poll after their timeout. Parked WAL snapshots can delay checkpoint progress, so keep the cursor cap and timeout appropriate for the application's write activity.

Worker queries use their own connection for class-name and navigation-property rendering and geometry-stream decompression, even when statements are prepared using the shared schema-source connection. This keeps those rendering operations off the shared connection's mutex. Primary-connection requests continue rendering against the primary.

Row rendering uses request-local JSON scratch with a reusable 4 KiB buffer and heap overflow for larger rows; cached statements do not retain that scratch. The native C++ reader replaces its batch document when fetching another batch, reclaiming the previous batch's JSON allocations. Native row views must not be retained across batch boundaries.

`memoryMapFileSize` sets the requested memory-mapped I/O limit in bytes when worker connections are opened; zero disables mmap. SQLite and the file's VFS can restrict or disable mmap, and the requested limit is not a promise of mapped or resident memory. This setting does not change the primary connection. To apply a changed limit to an existing pool, call `ConcurrentQuery.shutdown` and configure the new limit before issuing the next query.

## Examples

- [Asynchronous query examples](../ECSQLCodeExamples.md) — recommended starting point for frontend and backend queries.
- [Synchronous backend query examples](./WithQueryReaderCodeExamples.md) — callback-scoped execution with `withQueryReader`.
- [Migrating backend query code](./ECSQLCodeExamples.md) — parameter and result-shape differences from `withPreparedStatement`.
- [Frequently used ECSQL queries](./ECSQL-queries.md) — queries for common application tasks.

## Data modification

For iModels, use ECSQL SELECT statements to query data and the iModel APIs to modify it, such as [IModelDb.Elements.updateElement]($backend).

For a standalone [ECDb]($backend), use [ECDb.withCachedWriteStatement]($backend) or [ECDb.withWriteStatement]($backend) for ECSQL INSERT, UPDATE, and DELETE statements.

See [ECSQL](../ECSQL.md) for the query language and [ECSQL parameters](../ECSQL.md#ecsql-parameters) for parameter syntax.
