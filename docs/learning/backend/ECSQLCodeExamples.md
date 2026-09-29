# Migrating Backend ECSQL Code

Use [IModelDb.createQueryReader]($backend) or [ECDb.createQueryReader]($backend) for asynchronous queries. Use [IModelDb.withQueryReader]($backend) or [ECDb.withQueryReader]($backend) when backend code requires synchronous execution.

- [Asynchronous query examples](../ECSQLCodeExamples.md) apply to both backend classes and to frontend [IModelConnection]($frontend) objects.
- [Synchronous query examples](./WithQueryReaderCodeExamples.md) show callback-scoped, row-by-row execution on the backend.
- [Choosing a query reader](./ExecutingECSQL.md#choosing-a-query-reader) compares execution, buffering, connection selection, options, and lifetime.
- [Frequently used ECSQL queries](./ECSQL-queries.md) contains recipes for common application tasks.

## Migrating from `withPreparedStatement`

`withPreparedStatement` and [ECSqlStatement]($backend) are deprecated. For SELECT queries, choose the asynchronous or synchronous reader according to the needs of the calling code. Account for these differences when migrating:

| Existing statement code | Reader equivalent or consideration |
| --- | --- |
| Bind parameters inside the callback | Build a [QueryBinder]($common) and pass it to the reader API. See [parameter bindings](../ECSQLCodeExamples.md#parameter-bindings). |
| `stmt.step() === DbResult.BE_SQLITE_ROW` | `await reader.step()` for the async reader; `reader.step()` for the sync reader. Both return a boolean. |
| `stmt.getRow()` | `reader.current` is a reusable row proxy. Call `reader.current.toRow()` to retain an object for that row. |
| Default JS-shaped results from `stmt.getRow()` | Prefer `UseECSqlPropertyNames` with explicit aliases and `ec_classname()` projections. If an existing caller requires the exact legacy shape, deprecated `UseJsPropertyNames` can preserve it temporarily. The readers otherwise default to indexed rows for `reader.toArray()`. |
| Read class IDs with `stmt.getValue(index).getId()` | Use index access or ECSQL-name access with the default options, which preserve class IDs. See [row formats](../ECSQLRowFormat.md). |
| Read unsaved edits on the owning database connection | `withQueryReader` uses that connection. With `createQueryReader`, specify `usePrimaryConn: true` when required. Async results are still buffered. |
| `bindNavigation`, `bindStruct`, or `bindArray` | See the binding limitations below; these do not have equivalent working reader bindings for whole navigation, struct, or arbitrary array values. |

For ECDb INSERT, UPDATE, or DELETE statements, use [ECDb.withCachedWriteStatement]($backend) or [ECDb.withWriteStatement]($backend). iModel data modification uses the iModel APIs.

## Legacy statement bindings

The following examples describe existing code using the deprecated statement API. For reader queries, bind navigation and struct members individually. Arbitrary ECSQL array parameters are not supported by `QueryBinder`; [ID-set bindings](../ECSQLCodeExamples.md#id-sets) are a separate facility.

### Navigation properties

Legacy statements accept a [NavigationBindingValue]($common):

```ts
[[include:ExecuteECSql_Binding_Navigation_ByParameter]]
```

For a reader query filtering by the related instance, use `WHERE Parent.Id=?` and [QueryBinder.bindId]($common). See the [navigation-property example](../ECSQLCodeExamples.md#navigation-properties).

### Struct properties

Legacy statements can bind a whole struct. This example uses the sample schema in [Structs](../ECSQL.md#structs):

```ts
[[include:ExecuteECSql_Binding_Struct_ByParameter]]
```

For reader queries, parameterize the [individual struct members](../ECSQLCodeExamples.md#struct-properties). Whole-struct reader bindings are not supported.

### Array properties

Legacy statements can bind an ECSQL array property. This example uses the sample schema in [Arrays](../ECSQL.md#arrays):

```ts
[[include:ExecuteECSql_Binding_Array_ByParameter]]
```

An ID set passed to `InVirtualSet` is not a replacement for an arbitrary array-property parameter. See [ECSQL parameter types](../ECSQLParameterTypes.md) for the reader's supported bindings.

## Working with the query result

Both readers expose a [QueryRowProxy]($common). Use column indexes or names to read values, and materialize rows before retaining them. See [handling query results](../ECSQLCodeExamples.md#handling-a-row-of-query-results).

### Column by column

Legacy code can use [ECSqlStatement.getValue]($backend) and the typed [ECSqlValue]($backend) accessors. The readers expose JavaScript values rather than `ECSqlValue` objects. Check each typed accessor's purpose when migrating; ordinary ID and class-name queries are covered by the [row-format reference](../ECSQLRowFormat.md).
