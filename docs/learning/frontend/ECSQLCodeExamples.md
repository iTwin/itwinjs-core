# ECSQL Code Examples

## Parameter Bindings

See section "[ECSQL parameter types in iTwin.js](../ECSQLParameterTypes)" to learn which types to use for the parameters when binding all
parameters at once.

### Positional parameters

```ts
[[include:ExecuteECSql_Binding_Positional]]
```

### Named parameters

```ts
[[include:ExecuteECSql_Binding_Named]]
```

### Navigation properties

[Navigation properties](../ECSQL#navigation-properties) are structs made up of the Id of the related instance and the backing
ECRelationshipClass. The [NavigationBindingValue]($common) interface is used to bind values to navigation property parameters.

```ts
[[include:ExecuteECSql_Binding_Navigation]]
```

Because of the struct nature of navigation properties, you can also use its members in the ECSQL. The following example illustrates
this by specifying the **Id** member of a navigation property.

```ts
[[include:ExecuteECSql_Binding_NavigationId]]
```

### Struct properties

You can either parameterize a struct property as a whole or parameterize individual members of the struct. See "[Struct properties in ECSQL](../ECSQL#structs)" for the ECSQL background.

> The ECSQL examples used in this section refer to the sample ECSchema in "[Struct properties in ECSQL](../ECSQL#structs)".

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

See "[Array properties in ECSQL](../ECSQL#arrays)" for the ECSQL background.

> The ECSQL examples used in this section refer to the sample ECSchema in "[Array properties in ECSQL](../ECSQL#arrays)".

```ts
[[include:ExecuteECSql_Binding_Array]]
```

## Working with the query result

ECSQL query results are returned as array of JavaScript literals, where each literal represents an ECSQL row in the
[ECSQL row format](../ECSQLRowFormat)).

The following example is intended to illustrate the [ECSQL row format](../ECSQLRowFormat):

```ts
[[include:ExecuteECSql_IllustrateRowFormat]]
```

### Output

```json
{id: "0x312", className: "StructuralPhysical.Slab", parent: {id: "0x433", relClassName: "BisCore.PhysicalElementAssemblesElements"}, lastMod: "2018-02-03T13:43:22Z"}

{id: "0x313", className: "StructuralPhysical.Slab", parent: {id: "0x5873", relClassName: "BisCore.PhysicalElementAssemblesElements"}, lastMod: "2017-11-24T08:21:01Z"}

...
```

> Note how the ECProperties used in the ECSQL are converted to members of the JavaScript literal and how their names are
> transformed according to the rules described in the [ECSQL row format](../ECSQLRowFormat#property-names).

The following example illustrates how to work with the ECSQL row JavaScript literal:

```ts
[[include:ExecuteECSql_WorkingWithRowFormat]]
```

### Output

ECInstanceId | ClassName  | Parent Id | Parent RelClassName | LastMod
--- | --- | --- | --- | ---
0x312 | StructuralPhysical.Slab | 0x433 | BisCore.PhysicalElementAssemblesElements | 2018-02-03T13:43:22Z
0x313 | StructuralPhysical.Slab | 0x5873 | BisCore.PhysicalElementAssemblesElements | 2017-11-24T08:21:01Z
... | | | |
