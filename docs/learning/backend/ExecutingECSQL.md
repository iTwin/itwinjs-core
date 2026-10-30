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

A retained statement can hold sorter memory, temporary files, and a read snapshot between batches. Retention is bounded, idle statements expire automatically, and observed external commits invalidate retained statements. A reader that is abandoned or reset before reaching the end keeps its retained statement until it expires (`cursorIdleTimeout`), is evicted by newer statements, or is invalidated. A cancelled or interrupted batch releases the statements retained by its worker. Retained WAL snapshots can temporarily delay checkpoint progress. These resource costs are a tradeoff for avoiding repeated query execution, not a promise of lower overall memory use.

Result conversion reduces repeated metadata lookups and temporary JSON allocations for supported scalars, navigation properties, points, structs, and arrays. Point-coordinate reuse and more efficient ID formatting reduce per-row work. Unsupported result shapes continue using the existing conversion path. The documented [row-format](../ECSQLRowFormat.md) and null-handling rules are unchanged.

## Query timing statistics

Asynchronous `reader.stats` accumulates timing across pages, retries, and executions discarded after a metadata-cache invalidation. It retains available backend timings even when a query fails; client `totalTime` also includes rejected executor calls. Statistics cover the reader's lifetime: deprecated `reset()` and `resetBindings()` do not clear them. Create a new reader for fresh totals.

| Field | Unit | Scope |
| --- | --- | --- |
| `backendCpuTime` | Microseconds | Elapsed backend execution, including preparation and blocking waits, excluding queueing. Despite the name, not CPU usage. |
| `backendTotalTime` | Milliseconds | Time from request submission through native response construction, including queueing; excludes later cleanup and transport. |
| `prepareTime` | Milliseconds | Preparation or cached-statement acquisition and binding; already included in backend execution. |
| `totalTime` | Milliseconds | Monotonic elapsed time of executor calls, including failures; excludes application work between reader calls. |

These are overlapping measurements, not separate components to add together. Native versions supporting precise reporting retain fractional milliseconds. When an executor rejects without a native response, backend timings for that attempt are unknown, not inferred from client elapsed time.

### Cloud SQLite download waits

Pass `{ collectCloudSqliteStats: true }` to `createQueryReader` to collect:

- `backendDownloadTime`: elapsed time this reader's requests waited for required blocks of the **main** Cloud SQLite database, in fractional milliseconds.
- `backendExecutionTime`: active backend elapsed time excluding those waits, in fractional milliseconds. Includes preparation, binding, metadata, stepping, and native row conversion, but not queueing, RPC, or application work between calls. It is not CPU usage.
- `backendDownloadBlocks`: count of successful main-database block acquisitions that waited, including waits on shared downloads and excluding warm-cache hits.
- `backendDownloadBlockSizes`: one logical size in bytes per waited-block acquisition, in request order. These are not actual HTTP payload sizes. Acquiring the same block again after eviction or a retry counts again; the count is not a count of unique block identities.

Collection defaults to **off**; use `false` to disable it explicitly. These optional fields are absent when `main` is local-only, for unsupported native/daemon versions, or for incomplete measurements. Older timing-only responses can supply timings without block counts or sizes; incomplete block totals remain absent for the reader's lifetime. Supported Cloud SQLite cache hits report zero download time, zero waited blocks, and an empty sizes array. Check for `undefined` rather than treating absence as zero.

Both in-process and daemon/proxy Cloud SQLite files are supported, for `main` only. Attached-database waits are not measured; they remain part of the execution remainder. Each concurrent request counts its own wait on a shared download, so waits from different readers can overlap; a late-arriving request counts only its remaining wait. A request blocked on a prefetch counts that wait, but unrelated prefetch activity is excluded. Upstream counters account for successful downloads; failed downloads are not guaranteed to contribute wait time or block counts, and unaccounted waits remain in the execution remainder.

Native collection reads connection-specific `nqueryus`, `nqueryblock`, and `nquerybyte` together in one `bcv_stat` query before and after each active request/page, never per row. It uses the upstream Cloud SQLite fix that replaces `nqueryms` with monotonic microsecond timing and accounts for shared/prefetch waits. Microsecond deltas are converted to fractional milliseconds. Logical block sizes come from `PRAGMA main.bcv_blocksize`, not from average downloaded bytes. Snapshot overhead is excluded from the new execution remainder. Legacy daemons lacking `nqueryus` continue to execute queries without reporting these optional fields. A request crossing an application JavaScript callback also omits these fields because upstream counters cannot exclude callback work from an unfinished wait.

The sum of the two new fields is measured active backend elapsed time, not client `totalTime` or queue-inclusive `backendTotalTime`. Download waits still count against query time quotas. `withQueryReader` does not collect or expose these statistics.

```ts
[[include:ExecuteECSql_Cloud_Timing_Async]]
```

## Examples

- [Asynchronous query examples](../ECSQLCodeExamples.md) — recommended starting point for frontend and backend queries.
- [Synchronous backend query examples](./WithQueryReaderCodeExamples.md) — callback-scoped execution with `withQueryReader`.
- [Migrating backend query code](./ECSQLCodeExamples.md) — parameter and result-shape differences from `withPreparedStatement`.
- [Frequently used ECSQL queries](./ECSQL-queries.md) — queries for common application tasks.

## Data modification

For iModels, use ECSQL SELECT statements to query data and the iModel APIs to modify it, such as [IModelDb.Elements.updateElement]($backend).

For a standalone [ECDb]($backend), use [ECDb.withCachedWriteStatement]($backend) or [ECDb.withWriteStatement]($backend) for ECSQL INSERT, UPDATE, and DELETE statements.

See [ECSQL](../ECSQL.md) for the query language and [ECSQL parameters](../ECSQL.md#ecsql-parameters) for parameter syntax.
