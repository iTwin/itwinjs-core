---
publish: false
---
# NextVersion

<!-- prettier-ignore -->
- [NextVersion](#nextversion)
  - [Backend](#backend)
    - [Cloud SQLite query timings](#cloud-sqlite-query-timings)

## Backend

### Cloud SQLite query timings

Set `collectCloudSqliteStats: true` in `IModelHost.startup(...)` to enable collection for all asynchronous ECSQL readers served by that host, with no per-request override. Readers expose optional `reader.stats.backendDownloadTime` and `backendExecutionTime`, in fractional milliseconds, plus `backendDownloadBlocks` and `backendDownloadBlockSizes` (logical bytes per waited acquisition). Collection defaults to off and covers the **main database only**. Timings separate each request's wait for required Cloud SQLite blocks from active execution, including waits on downloads shared with other requests. Cache hits report zero download time and count, with an empty sizes array; unsupported native/daemon versions, a local-only main database, or incomplete measurements omit the fields. Repeated acquisitions after eviction or retries count again. `withQueryReader` does not collect or expose these statistics. Native collection uses request-boundary `bcv_stat` snapshots, not per-row daemon queries.

Collection requires the upstream `nqueryus` counter with shared-download and prefetch wait accounting. These counters account for successful downloads; failed-download waits may remain in the execution remainder. Requests crossing application JavaScript callbacks omit the optional fields because those waits cannot be separated reliably. Logical block sizes are not inferred from downloaded byte totals.

Asynchronous query timing now includes previously omitted first retry attempts, discarded metadata-cache executions, and available native timings on initial failures. Client elapsed time uses a monotonic clock and includes rejected calls. Native timing reporting preserves fractional milliseconds. Reported totals can therefore increase; consumers should accept fractional values and must not interpret `backendCpuTime` as actual CPU usage or add overlapping timing fields together. Deprecated reader resets continue retaining lifetime statistics. Query quotas and error delivery are unchanged.

See [Query timing statistics](../learning/backend/ExecutingECSQL.md#query-timing-statistics) for measurement boundaries, compatibility, and examples.
