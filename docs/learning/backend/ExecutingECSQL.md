# Executing ECSQL with the iModelJs Backend

ECSQL by itself is described in detail here: [ECSQL](../ECSQL)

Executing an ECSQL statement typically consists of these steps:

1. Prepare the ECSQL
1. Bind values to the [ECSQL parameters](../ECSQL#ecsql-parameters) (if parameters are used)
1. Execute the ECSQL and iterate the query results (for ECSQL SELECT statements).
1. Reset the statement and clear its parameter bindings, if the statement should be executed again.

> For iModels only ECSQL SELECT statements can be executed. Data modification has to be done through
> the dedicated Element API.

## IModelDb.executeQuery

[IModelDb.executeQuery]($imodeljs-backend.IModelDb.executeQuery) does all the above steps with a single call.

### Parameter Values

Pass an *array* of values if the parameters are *positional*. Pass an *object of the values keyed on the parameter name* for *named parameters*.

The section ["iModelJs Types used in ECSQL Parameter Bindings"](../ECSQLParameterTypes) describes the iModelJs types to be used for the different ECSQL parameter types.

> The values in either the array or object must match the respective types of the parameter.

### Query Result

The result of the query is returned as an array of JavaScript objects where every array element represents an [ECSQL row](../ECSQLRowFormat).

## The class ECSqlStatement

[ECSqlStatement]($imodeljs-backend.ECSqlStatement) is the low-level class to execute ECSQL statements. If you need more
flexibility, you can consider using it instead of [IModelDb.executeQuery]($imodeljs-backend.IModelDb.executeQuery).

### Preparation

Preparation is done in the context of an IModelDb or ECDb file:

- [IModelDb.withPreparedECSql]($imodeljs-backend.IModelDb.withPreparedECSql)
- [ECDb.withPreparedECSql]($imodeljs-backend.ECDb.withPreparedECSql)

> These methods internally use an ECSqlStatement cache. If you call these methods with the same ECSQL string again, a
> prepared ECSqlStatement will be reused from the cache. This is to avoid unnecessary preparations which can be costly.

### Parameter Binding

Values to the parameters in the ECSQL can be either bound with separate API calls or with a single call.

#### Binding parameter values individually

- [ECSqlStatement.bindBlob]($imodeljs-backend.ECSqlStatement.bindBlob)
- [ECSqlStatement.bindBoolean]($imodeljs-backend.ECSqlStatement.bindBoolean)
- [ECSqlStatement.bindDateTime]($imodeljs-backend.ECSqlStatement.bindDateTime)
- [ECSqlStatement.bindDouble]($imodeljs-backend.ECSqlStatement.bindDouble)
- [ECSqlStatement.bindGuid]($imodeljs-backend.ECSqlStatement.bindGuid)
- [ECSqlStatement.bindId]($imodeljs-backend.ECSqlStatement.bindId)
- [ECSqlStatement.bindInteger]($imodeljs-backend.ECSqlStatement.bindInteger)
- [ECSqlStatement.bindPoint2d]($imodeljs-backend.ECSqlStatement.bindPoint2d)
- [ECSqlStatement.bindPoint3d]($imodeljs-backend.ECSqlStatement.bindPoint3d)
- [ECSqlStatement.bindRange3d]($imodeljs-backend.ECSqlStatement.bindRange3d)
- [ECSqlStatement.bindString]($imodeljs-backend.ECSqlStatement.bindString)
- [ECSqlStatement.bindNavigation]($imodeljs-backend.ECSqlStatement.bindNavigation)
- [ECSqlStatement.bindStruct]($imodeljs-backend.ECSqlStatement.bindStruct)
- [ECSqlStatement.bindArray]($imodeljs-backend.ECSqlStatement.bindArray)

#### Binding all parameter values with a single call

To bind values to all parameters in the ECSQL with a single call, the method [ECSqlStatement.bindValues]($imodeljs-backend.ECSqlStatement.bindValues) can be used.

Pass an *array* of values if the parameters are *positional*. Pass an *object of the values keyed on the parameter name* for *named parameters*.

The section ["iModelJs Types used in ECSQL Parameter Bindings"](../ECSQLParameterTypes) describes the iModelJs types to be used for the different ECSQL parameter types.

> The values in either the array or object must match the respective types of the parameter.

### Executing the statement

[ECSqlStatement.step]($imodeljs-backend.ECSqlStatement.step) executes the statement.

#### ECSQL SELECT

The method returns [DbResult.BE_SQLITE_ROW]($bentleyjs-core.DbResult.BE_SQLITE_ROW) if the statement now points successfully to the next row.
The method returns [DbResult.BE_SQLITE_DONE]($bentleyjs-core.DbResult.BE_SQLITE_DONE) if the statement has no more rows.

For the current row, the values can be obtained in two ways:

- Column by column: [ECSqlStatement.getValue]($imodeljs-backend.ECSqlStatement.getValue)
- Row as a JavaScript object: [ECSqlStatement.getRow]($imodeljs-backend.ECSqlStatement.getRow). See [ECSQL Row Format](../ECSQLRowFormat) for the format of the ECSQL row in iModelJs.

> ECSqlStatement is an iterator. A for loop can be used to iterate over the query results instead of calling [ECSqlStatement.step]($imodeljs-backend.ECSqlStatement.step).

#### Non-SELECT ECSQL (ECDb only)

For non-SELECT statement, the method returns [DbResult.BE_SQLITE_DONE]($bentleyjs-core.DbResult.BE_SQLITE_DONE) in case of success and error codes otherwise.

For ECSQL INSERT statements, [ECSqlStatement.stepForInsert]($imodeljs-backend.ECSqlStatement.stepForInsert) can be called alternatively, which returns the Id of the new row.

### Resetting the statement
If you want to execute the prepared statement again, call
- [ECSqlStatement.clearBindings]($imodeljs-backend.ECSqlStatement.clearBindings)
- [ECSqlStatement.reset]($imodeljs-backend.ECSqlStatement.reset)

Then you can start over again by

- binding new parameter values
- executing the statement.
