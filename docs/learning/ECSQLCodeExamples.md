# Asynchronous ECSQL Queries with `createQueryReader`

Use `createQueryReader` for asynchronous ECSQL queries on an [IModelDb]($backend), [ECDb]($backend), or frontend [IModelConnection]($frontend). In these examples, `iModel` can be any of those objects.

`createQueryReader` returns an [ECSqlReader]($common) immediately. Query execution starts when you consume the reader with asynchronous iteration, `step()`, or `toArray()`. The reader fetches and buffers batches of rows.

For synchronous backend execution, use [withQueryReader](./backend/WithQueryReaderCodeExamples.md). It supplies a callback-scoped reader that steps one row at a time. See [Choosing a query reader](./backend/ExecutingECSQL.md#choosing-a-query-reader) for differences in execution, connection selection, buffering, options, and lifetime.

- [Executing ECSQL in the frontend](./frontend/ExecutingECSQL.md) covers network-round-trip considerations.
- [Backend migration guidance](./backend/ECSQLCodeExamples.md) covers replacing `withPreparedStatement`.

See also:

- [About ECSQL](./ECSQL.md)
- [Frequently used ECSQL queries](./backend/ECSQL-queries.md)

## The `createQueryReader` Function

All of the iModel classes above provide a `createQueryReader` method for executing ECSQL statements on an iModel and reading the results of the query. The execution and results are handled by the returned [ECSqlReader]($common).

> For reference, here are all three `createQueryReader` methods.
>
> - [IModelDb.createQueryReader]($backend)
> - [ECDb.createQueryReader]($backend)
> - [IModelConnection.createQueryReader]($frontend)

Here is the TypeScript method signature for `createQueryReader`:

```ts
createQueryReader(ecsql: string, params?: QueryBinder, config?: QueryOptions): ECSqlReader
```

- The `ecsql` string is the query to execute, for example:

  ```sql
  SELECT ECInstanceId, ECClassId FROM BisCore.Element
  ```

- The `params` argument of type [QueryBinder]($common) contains any [bindings](./ECSQL.md#ecsql-parameters) for the ECSQL statement.

- The `config` argument of type [QueryOptions]($common) is for additional options for how the query will be executed. Some examples are:
  - `rowFormat` for determining how query results will look. For an explanation of the available formats, see [ECSQL Row Formats](./ECSQLRowFormat.md).
  - `limit` for specifying how many rows can be returned at most.
  - `restartToken` for canceling a previous query with the same token and starting a new one.
  - `usePrimaryConn` for queries that need to see unsaved changes on the owning backend connection. By default, concurrent queries use separate worker connections. This option does not remove result buffering.

## Iterating Over Query Results

Use the [ECSqlReader]($common) created by the `createQueryReader` function to iterate over query results. There are three primary ways to do so:

1\. Stream them using ECSqlReader as an asynchronous iterator.

```ts
[[include:ExecuteECSql_ECSqlReaderIteration_AsynchronousIterator]]
```

Results are [QueryRowProxy]($common) objects. See [Handling a Row of Query Results](#handling-a-row-of-query-results) for how to handle the results.

2\. Iterate over them manually using [ECSqlReader.step]($common).

```ts
[[include:ExecuteECSql_ECSqlReaderIteration_ManualIteration]]
```

Results are [QueryRowProxy]($common) objects. See [Handling a Row of Query Results](#handling-a-row-of-query-results) for how to handle the results.

3\. Collect all remaining results using [ECSqlReader.toArray]($common).

```ts
[[include:ExecuteECSql_ECSqlReaderIteration_ToArray]]
```

Each result is an array by default, or an object when a named row format is selected. Collecting all rows uses memory proportional to the result size; prefer iteration for large results.

## Handling a Row of Query Results

Iteration and `step()` expose a [QueryRowProxy]($common) for the current row. Access values by column index or by name. The proxy follows the reader's current row; materialize a row before retaining it across reader advances.

The `rowFormat` option controls materialized row shape and some value conversions. See [ECSQL Row Formats](./ECSQLRowFormat.md).

### Accessing Row Values By Index

When iterating with a for loop:

```ts
[[include:ExecuteECSql_HandlingRows_ForLoopAccessByIndex]]
```

When iterating with `step`:

```ts
[[include:ExecuteECSql_HandlingRows_StepAccessByIndex]]
```

> Column indexes follow SELECT-column order in every row format. The queries below place ECInstanceId and ECClassId at indexes 0,1 and 1,0 respectively. The value representation can still depend on the format; for example, JS formatting converts unaliased class IDs to class names.
>
> ```sql
> SELECT ECInstanceId, ECClassId FROM bis.Element
> SELECT ECClassId, ECInstanceId FROM bis.Element
> ```

### Accessing Row Values By Name

When iterating with a for loop:

```ts
[[include:ExecuteECSql_HandlingRows_ForLoopAccessByName]]
```

When iterating with `step`:

```ts
[[include:ExecuteECSql_HandlingRows_StepAccessByName]]
```

### Using Types with the Row Results

See [property value types](./ECSQLRowFormat.md#property-value-types) for result types. Properties can be absent when their value is null, as with `Parent` in this example:

```ts
[[include:ExecuteECSql_HandlingRows_Types]]
```

### Working with Rows as JavaScript Literals

Call `row.toRow()` to materialize the current row as a plain object. It uses ECSQL names unless the deprecated `UseJsPropertyNames` format was selected, including when the reader uses the default index format. Store these objects rather than the reusable row proxy.

`row.toArray()` returns only the current row's raw values. `reader.toArray()` collects all remaining rows, using the selected row format. See [ECSQL Row Formats](./ECSQLRowFormat.md) for the distinctions.

When iterating with a for loop:

```ts
[[include:ExecuteECSql_HandlingRows_ForLoopJsLiteral]]
```

When iterating with `step`:

```ts
[[include:ExecuteECSql_HandlingRows_StepJsLiteral]]
```

Select an object format when collecting all rows with `reader.toArray()`:

```ts
[[include:ExecuteECSql_HandlingRows_ToArrayJsLiteral]]
```

### Specifying Row Formats

Set `config.rowFormat` to a [QueryRowFormat]($common) value. These examples show the three formats; [ECSQL Row Formats](./ECSQLRowFormat.md) defines naming, class-ID conversion, and null handling.

#### QueryRowFormat.UseECSqlPropertyIndexes

This is the default format. `reader.toArray()` produces arrays of values in SELECT-column order.

```ts
[[include:ExecuteECSql_QueryRowFormat_UseECSqlPropertyIndexes]]
```

Here is an example using `.toArray`:

```ts
[[include:ExecuteECSql_QueryRowFormat_UseECSqlPropertyIndexes_ToArray]]
```

**Example Output:**
> Notice that the individual rows are returned as arrays.

```json
[
  [
    "0x17",
    "0x8d",
    null,
    "2017-07-25T20:44:59.711Z"
  ],
  [
    "0x18",
    "0x67",
    { "Id": "0x17", "RelECClassId": "0x66" },
    "2017-07-25T20:44:59.711Z"
  ]
]
```

#### QueryRowFormat.UseECSqlPropertyNames

`reader.toArray()` produces objects keyed by ECSQL column names or aliases.

```ts
[[include:ExecuteECSql_QueryRowFormat_UseECSqlPropertyNames]]
```

Here is an example using `.toArray`:

```ts
[[include:ExecuteECSql_QueryRowFormat_UseECSqlPropertyNames_ToArray]]
```

**Example Output:**

```json
[
  {
    "ECInstanceId": "0x17",
    "ECClassId": "0x8d",
    "LastMod": "2017-07-25T20:44:59.711Z"
  },
  {
    "ECInstanceId": "0x18",
    "ECClassId": "0x67",
    "Parent": {
      "Id": "0x17",
      "RelECClassId": "0x66"
    },
    "LastMod": "2017-07-25T20:44:59.711Z"
  }
]
```

#### Deprecated QueryRowFormat.UseJsPropertyNames

This legacy format converts unaliased class-ID values to class names and maps property keys to names such as `id`, `className`, and navigation `relClassName`. It is deprecated; use it only while preserving an existing result contract. New queries should use `UseECSqlPropertyNames`, explicit aliases, and `ec_classname()` projections. See [ECSQL Row Formats](./ECSQLRowFormat.md#property-names).

```ts
[[include:ExecuteECSql_QueryRowFormat_UseJsPropertyNames]]
```

Here is an example using `.toArray`:

```ts
[[include:ExecuteECSql_QueryRowFormat_UseJsPropertyNames_ToArray]]
```

**Example Output:**

```json
[
  {
    "id": "0x17",
    "className": "BisCore.SpatialCategory",
    "lastMod": "2017-07-25T20:44:59.711Z"
  },
  {
    "id": "0x18",
    "className": "BisCore.SubCategory",
    "parent": {
      "id": "0x17",
      "relClassName": "BisCore.CategoryOwnsSubCategories"
    },
    "lastMod": "2017-07-25T20:44:59.711Z"
  }
]
```

> `ECInstanceId` becomes `id`, and `ECClassId` becomes `className` with a qualified class-name value.

## Parameter Bindings

> See [ECSQL Parameter Types](./ECSQLParameterTypes.md) to learn which types to use for the parameters when binding.

### Positional parameters

```ts
[[include:ExecuteECSql_Binding_Positional]]
```

### Named parameters

```ts
[[include:ExecuteECSql_Binding_Named]]
```

### Navigation properties

Filter [navigation properties](./ECSQL.md#navigation-properties) by their members. For example, bind the related instance ID to a predicate on `Parent.Id`. Whole navigation-value bindings are not supported by the query readers.

```ts
[[include:ExecuteECSql_Binding_NavigationId]]
```

### Struct properties

Parameterize individual struct members. Whole-struct bindings are not supported by the query readers. This example uses the sample schema in [Struct properties in ECSQL](./ECSQL.md#structs).

```ts
[[include:ExecuteECSql_Binding_StructMembers]]
```

### ID sets

Use `QueryBinder.bindIdSet` to bind a set of Id64 values for `InVirtualSet`:

```ts
[[include:ExecuteECSql_Binding_IdSet]]
```

### Array properties

The query readers do not support arbitrary ECSQL array-property parameters. ID-set bindings are a separate facility. See [parameter support](./ECSQLParameterTypes.md#navigation-struct-and-array-parameters) and [legacy statement bindings](./backend/ECSQLCodeExamples.md#legacy-statement-bindings).
