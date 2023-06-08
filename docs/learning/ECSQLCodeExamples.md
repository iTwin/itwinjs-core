# ECSQL in iTwin.js Code Examples

This page contains generic example code that can be used across the [IModelDb]($backend), [ECDb]($backend), and [IModelConnection]($frontend) classes. In the examples, the identifier `iModel` is used as an object that could be any of those classes.

For more info and examples specific to running in the frontend and backend, check out:

- [Executing ECSQL in the Frontend](./frontend/ExecutingECSQL.md)
  - [Frontend ECSQL Code Examples](./frontend/ECSQLCodeExamples.md)
- [Executing ECSQL in the Backend](./backend/ExecutingECSQL.md)
  - [Backend ECSQL Code Examples](./backend/ECSQLCodeExamples.md)

See also:

- [About ECSQL](./ECSQL.md)
- [Frequently used ECSQL queries](./backend/ECSQL-queries.md)

## The `createQueryReader` Function

All of the iModel classes above provide a `createQueryReader` method for executing ECSQL statements on an iModel and reading the results of the query. The execution and results are handled by the returned [ECSqlReader]($common).

> For refererence, here are all three `createQueryReader` methods.
>
> - [IModelDb.createQueryReader]($backend)
> - [ECDb.createQueryReader]($backend)
> - [IModelConnection.createQueryReader]($frontend)

Here is the TypeScript method signature for `createQueryReader`:

```ts
createQueryReader(ecsql: string, params?: QueryBinder, config?: QueryOptions): ECSqlReader
```

- The `ecsql` string is the ECSQL statement that will be executed on the iModel. ***This is where you provide an ECSQL statement to query an iModel.*** E.g.,

  ```sql
  SELECT ECInstanceId, ECClassId FROM BisCore.Element
  ```

- The `params` argument of type [QueryBinder]($common) contains any [bindings](./ECSQL.md#ecsql-parameters) for the ECSQL statement.

- The `config` argument of type [QueryOptions]($common) is for additional options for how the query will be executed. Some examples are:
  - `rowFormat` for determining how query results will look. For an explanation of the available formats, see [ECSQL Row Formats](./ECSQLRowFormat.md).
  - `limit` for specifying how many rows can be returned at most.
  - `restartToken` for canceling the execution of a previous query and starting a new one.

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

3\. Capture all of the results at once in an array using [QueryRowProxy.toArray]($common).

```ts
[[include:ExecuteECSql_ECSqlReaderIteration_ToArray]]
```

Results are JavaScript literals. See [Working with Rows as JavaScript Literals](#working-with-rows-as-javascript-literals) for how to handle the results.

## Handling a Row of Query Results

The format of the query results is dependent on the provided `rowFormat` in the `config` parameter. **[Click here to read about ECSQL Row Formats in detail.](./ECSQLRowFormat.md)**

When iterating over each row one at a time (as an asynchronous iterator or with `step`), each row will be a [QueryRowProxy]($common) object. The rows value can then be accessed by column index or by name.

### Accessing Row Values By Index

When iterating with a for loop:

```ts
[[include:ExecuteECSql_HandlingRows_ForLoopAccessByIndex]]
```

When iterating with `step`:

```ts
[[include:ExecuteECSql_HandlingRows_StepAccessByIndex]]
```

> The `rowFormat` used does *not* matter when accessing by index; only the order of the selected columns does. The two queries below will return the ECInstanceId and ECClassId values as indexes 0,1 and 1,0 respectively.
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

Each ECSQL value has a corresponding TypeScript type which is described in [ECSQL Parameter Types](./ECSQLParameterTypes.md).

```ts
[[include:ExecuteECSql_HandlingRows_Types]]
```

### Working with Rows as JavaScript Literals

Call `.toRow()` on the row to convert it from a `QueryRowProxy` object to a JavaScript literal. The format of the literal is dependent on the provided `rowFormat` in the `config` parameter. Check out [ECSQL Row Formats](./ECSQLRowFormat.md) for more details.

> Note: With the deprecation of `.query` in 3.7 and the switch to using ECSqlReader to handle query results, rows were changed from being JavaScript literals to `QueryRowProxy`s. Using `.toRow()` may fix any issues that emerged due to this change.

When iterating with a for loop:

```ts
[[include:ExecuteECSql_HandlingRows_ForLoopJsLiteral]]
```

When iterating with `step`:

```ts
[[include:ExecuteECSql_HandlingRows_StepJsLiteral]]
```

When using `toArray`:

```ts
[[include:ExecuteECSql_HandlingRows_ToArrayJsLiteral]]
```

### Specifying Row Formats

The format of of a row is dependent on the provided `rowFormat` in the `config` parameter of `createQueryReader`. The row formats are specified by supplying a [QueryRowProxy]($common) enum.

Check out [ECSQL Row Formats](./ECSQLRowFormat.md) for more details.

#### QueryRowFormat.UseECSqlPropertyIndexes

**This is the default format** when no `rowFormat` is specified. Column values should refered to by an index which is ordered by the columns specified in the SELECT statement.

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
    '0x17',
    '0x8d',
    null,
    '2017-07-25T20:44:59.711Z'
  ],
  [
    '0x18',
    '0x67',
    { Id: '0x17', RelECClassId: '0x66' },
    '2017-07-25T20:44:59.711Z'
  ],
  ...
]
```

#### QueryRowFormat.UseECSqlPropertyNames

Column values should refered to by their ECSQL property names.

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
    ECInstanceId: '0x17',
    ECClassId: '0x8d',
    LastMod: '2017-07-25T20:44:59.711Z'
  },
  {
    ECInstanceId: '0x18',
    ECClassId: '0x67',
    Parent:
    {
      Id: '0x17',
      RelECClassId: '0x66'
    },
    LastMod: '2017-07-25T20:44:59.711Z'
  },
  ...
]
```

#### QueryRowFormat.UseJsPropertyNames

Column values should be refered to by their JavaScript property names. The mapping from ECSQL property names to JavaScript property names is described in [ECSQL Row Formats](./ECSQLRowFormat.md).

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
    id: '0x17',
    className: 'BisCore.SpatialCategory',
    lastMod: '2017-07-25T20:44:59.711Z'
  },
  {
    id: '0x18',
    className: 'BisCore.SubCategory',
    parent:
    {
      id: '0x17',
      relClassName: 'BisCore.CategoryOwnsSubCategories'
    },
    lastMod: '2017-07-25T20:44:59.711Z'
  },
  ...
]
```

> Notice how the keys in the above JSON are converted from ECProperty names to names that conform to JavaScript standards as described in [ECSQL Row Formats](./ECSQLRowFormat.md). For example, "ECInstanceId" is mapped to "id".

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

[Navigation properties](./ECSQL#navigation-properties) are structs made up of the Id of the related instance and the backing
[ECRelationshipClass](../bis/ec/ec-relationship-class.md). The [NavigationBindingValue]($common) interface is used to bind values to navigation property parameters.

```ts
[[include:ExecuteECSql_Binding_Navigation]]
```

Because of the struct nature of navigation properties, you can also use its members in the ECSQL. The following example illustrates
this by specifying the **Id** member of a navigation property.

```ts
[[include:ExecuteECSql_Binding_NavigationId]]
```

### Struct properties

You can either parameterize a struct property as a whole or parameterize individual members of the struct. See [Struct properties in ECSQL](./ECSQL#structs) for the ECSQL background.

> The ECSQL examples used in this section refer to the sample ECSchema in [Struct properties in ECSQL](./ECSQL#structs).

#### Binding structs as a whole

```ts
[[include:ExecuteECSql_Binding_Struct]]
```

#### Binding to individual struct members

```ts
[[include:ExecuteECSql_Binding_StructMembers]]
```

> The two ECSQL examples used in this section amount to the same results.

### Array properties

See [Array properties in ECSQL](./ECSQL#arrays) for the ECSQL background.

> The ECSQL examples used in this section refer to the sample ECSchema in [Array properties in ECSQL](./ECSQL#arrays).

```ts
[[include:ExecuteECSql_Binding_Array]]
```
