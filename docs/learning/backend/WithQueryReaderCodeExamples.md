# Synchronous Backend ECSQL Queries with `withQueryReader`

Use [IModelDb.withQueryReader]($backend) or [ECDb.withQueryReader]($backend) when backend code requires synchronous query execution. These APIs are currently beta.

`withQueryReader` prepares a query, invokes a callback with an [ECSqlSyncReader]($backend), and returns the callback's result. The reader steps synchronously on the owning database connection, one row at a time, without buffering result batches. Query execution blocks the calling JavaScript thread.

For asynchronous queries on either the frontend or backend, use [createQueryReader](../ECSQLCodeExamples.md). Its reader is consumed asynchronously and buffers batches of results. See [Choosing a query reader](./ExecutingECSQL.md#choosing-a-query-reader) for the differences in execution, connection selection, options, and lifetime.

## The `withQueryReader` Function

```ts
withQueryReader<T>(ecsql: string, callback: (reader: ECSqlSyncReader) => T, params?: QueryBinder, config?: SynchronousQueryOptions): T
```

- `ecsql` is the ECSQL query to execute.
- `callback` consumes the reader and can return materialized rows or a computed value. Finish using the reader before the callback completes.
- `params` is a [QueryBinder]($common) containing any parameter bindings.
- `config` is a [SynchronousQueryOptions]($backend) object. It supports `rowFormat`, `abbreviateBlobs`, and `convertClassIdsToClassNames`. See [ECSQL Row Formats](../ECSQLRowFormat.md) for result formatting and class-name conversion.

The synchronous options do not include `usePrimaryConn`: this reader already uses the owning connection and can read its unsaved changes. They also omit concurrent-query controls such as `priority`, `restartToken`, and `quota`. To limit the result count, use an ECSQL `LIMIT` clause; the async reader's `config.limit` option is not available here.

## Iterating Over Query Results

### Synchronous iterator

Use `for...of` to step through the result. Each iteration exposes a [QueryRowProxy]($common):

```ts
[[include:ExecuteECSql_Sync_Iteration]]
```

### Manual stepping

`step()` returns `true` when a row is available through `reader.current`, or `false` when the result is exhausted:

```ts
[[include:ExecuteECSql_Sync_Step]]
```

### Collecting rows and returning a value

`reader.toArray()` collects all remaining rows. By default, each row is an array of values in SELECT-column order. Select `UseECSqlPropertyNames` to collect objects:

```ts
[[include:ExecuteECSql_Sync_ToArray]]
```

Materialized rows can be used after the callback completes. Collecting all rows uses memory proportional to the result size; prefer iteration for large results.

## Handling Row Values

The async and sync readers share the same [row formats and materialization methods](../ECSQLRowFormat.md):

- Use `row[index]` or `row.propertyName` to read the current row.
- Use `row.toRow()` to retain a plain object. It uses ECSQL names unless `UseJsPropertyNames` was selected.
- Use `row.toArray()` for the current row's raw values, or `reader.toArray()` for all remaining rows.

The proxy follows the reader's current row. Materialize a row before retaining it across calls to `step()` or iterator advances.

### JavaScript property names

Use `QueryRowFormat.UseJsPropertyNames` when results need JS property names and class-name values, such as `id`, `className`, and navigation `relClassName`:

```ts
[[include:ExecuteECSql_Sync_JsRow]]
```

See [property names and values](../ECSQLRowFormat.md#property-names) for the conversion rules and alias behavior.

## Parameter Bindings

Supply a [QueryBinder]($common) before execution. This example binds a class name and converts it to a class ID in the query with `ec_classid()`:

```ts
[[include:ExecuteECSql_Sync_Binding]]
```

The [shared binding examples](../ECSQLCodeExamples.md#parameter-bindings) also apply to this API. Pass the binder as the third argument to `withQueryReader`. Bind navigation and struct members individually; whole navigation/struct values and arbitrary ECSQL array parameters are not supported by the readers. See [ECSQL parameter types](../ECSQLParameterTypes.md).

## Getting Column Metadata

[ECSqlSyncReader.getMetaData]($backend) returns metadata for the selected columns and can be called inside the callback before or after stepping. The synchronous call returns the metadata directly; the async reader's `getMetaData()` returns a promise.

## Reader Lifetime

Keep the reader inside its callback. Return materialized rows or computed results rather than the reader or its current-row proxy. If the callback returns a `Promise`, the reader remains valid until that promise settles; each reader operation is still synchronous. After the callback completes, its statement is released and may be reused from the statement cache. Statement reuse does not buffer query results.

Do not close the database or call `clearCaches()` while using the reader; these actions invalidate its statement.

For migration from `withPreparedStatement`, see [Backend ECSQL Code Examples](./ECSQLCodeExamples.md#migrating-from-withpreparedstatement).
