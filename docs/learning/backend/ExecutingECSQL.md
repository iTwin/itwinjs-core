# Executing ECSQL with the iModelJs Backend

ECSQL by itself is described in detail here: [ECSQL](../ECSQL)

Executing an ECSQL statement typically consists of these steps:

1. Prepare the ECSQL
1. Bind values to the [ECSQL parameters](../ECSQL#ecsql-parameters) (if parameters are used)
1. Execute the ECSQL and iterate the query results (for ECSQL SELECT statements).
1. Reset the statement and clear its parameter bindings, if the statement should be executed again.

> For iModels only ECSQL SELECT statements can be executed. Data modification must be done through the API.
> For [ECDb]($backend) ECSQL INSERT, UPDATE and DELETE statements can be executed as well.

There are two ways to execute an ECSQL statement:

- [IModelDb.executeQuery]($backend) is the high-level API which does all the above steps in a single call.
- [ECSqlStatement]($backend) is the lower-level API in case you need more flexibility,
  e.g. when iterating over the query results. Use [IModelDb.withPreparedStatement]($backend)
  or [ECDb.withPreparedStatement]($backend) in that case.

# Code Examples

> The code examples do not explicitly show examples using the [ECDb]($backend) class. However, the code examples work likewise for
> ECDb. Just replace [IModelDb.withPreparedStatement]($backend) in the code examples
> with [ECDb.withPreparedStatement]($backend).

Also see [frequently used ECSQL queries](./ECSQL-queries.md) for the specific ECSQL queries that app backends and services often run.

## Parameter Bindings

### Binding per parameter

#### Positional parameters

```ts
[[include:ExecuteECSql_Binding_ByParameter_Positional]]
```

#### Named parameters

```ts
[[include:ExecuteECSql_Binding_ByParameter_Named]]
```

### Binding to all parameters at once

See section "[ECSQL parameter types in iModelJs](../ECSQLParameterTypes)" to learn which types to use for the parameters when binding all
parameters at once.

#### Positional parameters

```ts
[[include:ExecuteECSql_BindValues_Positional]]
```

#### Named parameters

```ts
[[include:ExecuteECSql_BindValues_Named]]
```

### Navigation properties

[Navigation properties](../ECSQL#navigation-properties) are structs made up of the Id of the related instance and the backing
ECRelationshipClass. The [NavigationBindingValue]($common) interface is used to bind values to navigation property parameters.

```ts
[[include:ExecuteECSql_Binding_Navigation_ByParameter]]
```

```ts
[[include:ExecuteECSql_BindValues_Navigation]]
```

Because of the struct nature of navigation properties, you can also use its members in the ECSQL. The two following examples illustrate
this by specifying the **Id** member of a navigation property.

```ts
[[include:ExecuteECSql_Binding_NavigationId_ByParameter]]
```

```ts
[[include:ExecuteECSql_BindValues_NavigationId]]
```

### Struct properties

You can either parameterize a struct property as a whole or parametrize individual members of the struct. See "[Struct properties in ECSQL](../ECSQL#structs)" for the ECSQL background.

> The ECSQL examples used in this section refer to the sample ECSchema in "[Struct properties in ECSQL](../ECSQL#structs)".

#### Binding structs as a whole

```ts
[[include:ExecuteECSql_Binding_Struct_ByParameter]]
```

```ts
[[include:ExecuteECSql_BindValues_Struct]]
```

#### Binding to individual struct members

```ts
[[include:ExecuteECSql_Binding_StructMembers_ByParameter]]
```

```ts
[[include:ExecuteECSql_BindValues_StructMembers]]
```

> The two ECSQL examples used in this section amount to the same results.

### Array properties

See "[Array properties in ECSQL](../ECSQL#arrays)" for the ECSQL background.

> The ECSQL examples used in this section refer to the sample ECSchema in "[Array properties in ECSQL](../ECSQL#arrays)".

```ts
[[include:ExecuteECSql_Binding_Array_ByParameter]]
```

```ts
[[include:ExecuteECSql_BindValues_Array]]
```

## Working with the query result

The current row of the query result can be retrieved in two ways:

- as a whole as JavaScript literal (adhering to the [ECSQL row format](../ECSQLRowFormat))
- column by column (using the [ECSqlValue]($backend) API as returned from [ECSqlStatement.getValue]($backend))

> The column by column approach is more low-level, but gives you more flexible access to the data in the row. For example,
> [ECClassIds](../ECSQL#ecclassid) are turned into class names in the [ECSQL row format](../ECSQLRowFormat).
> Using the [ECSqlValue]($backend) API allows you to retrieve ECClassIds as Id64s.

### Rows as a whole

The following example is intended to illustrate the [ECSQL row format](../ECSQLRowFormat):

```ts
[[include:ExecuteECSql_GetRow_IllustrateRowFormat]]
```

#### Output

```json
{id: "0x312", className: "StructuralPhysical.Slab", parent: {id: "0x433", relClassName: "BisCore.PhysicalElementAssemblesElements"}, lastMod: "2018-02-03T13:43:22Z"}

{id: "0x313", className: "StructuralPhysical.Slab", parent: {id: "0x5873", relClassName: "BisCore.PhysicalElementAssemblesElements"}, lastMod: "2017-11-24T08:21:01Z"}

...
```

> Note how the ECProperties used in the ECSQL are converted to members of the JavaScript literal and how their names are
> transformed according to the rules described in the [ECSQL row format](../ECSQLRowFormat#property-names).

The following example illustrates how to work with the ECSQL row JavaScript literal:

```ts
[[include:ExecuteECSql_GetRow]]
```

#### Output

```txt
ECInstanceId | ClassName               | Parent Id | Parent RelClassName                      | LastMod
0x312        | StructuralPhysical.Slab | 0x433     | BisCore.PhysicalElementAssemblesElements | 2018-02-03T13:43:22Z
0x313        | StructuralPhysical.Slab | 0x5873    | BisCore.PhysicalElementAssemblesElements | 2017-11-24T08:21:01Z
...
```

### Column by column

```ts
[[include:ExecuteECSql_GetValue]]
```

#### Output

```txt
ECInstanceId | ClassName               | Parent Id | Parent RelClassName                      | LastMod
0x312        | StructuralPhysical.Slab | 0x433     | BisCore.PhysicalElementAssemblesElements | 2018-02-03T13:43:22Z
0x313        | StructuralPhysical.Slab | 0x5873    | BisCore.PhysicalElementAssemblesElements | 2017-11-24T08:21:01Z
...
```

> The sample is code is intentionally verbose to better illustrate the semantics of the API.

The following example illustrates the flexibility of the column by column approach by preserving the [ECClassId](../ECSQL#ecclassid)
as id instead of having it converted to a class name.

```ts
[[include:ExecuteECSql_GetValue_PreserveClassIds]]
```

#### Output

```txt
ECClassId | Parent RelECClassId
0x120     | 0x154
0x120     | 0x154
...
```
