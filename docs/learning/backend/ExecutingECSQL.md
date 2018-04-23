# Executing ECSQL with the iModelJs Backend

ECSQL by itself is described in detail here: [ECSQL](../learning/ECSQL)

Executing an ECSQL statement typically consists of these steps:

1. Prepare the ECSQL
1. Bind values to the [ECSQL parameters](../learning/ECSQL#ecsql-parameters) (if parameters are used)
1. Execute the ECSQL and iterate the query results (for ECSQL SELECT statements).
1. Reset the statement and clear its parameter bindings, if the statement should be executed again.

> For iModels only ECSQL SELECT statements can be executed. Data modification must be done through the API.
> For [ECDb files]($imodeljs-backend.ECDb) ECSQL INSERT, UPDATE and DELETE statements can be executed as well.

There are two ways to execute an ECSQL statement:

- [IModelDb.executeQuery]($imodeljs-backend.IModelDb.executeQuery) is the high-level API which does all the above steps in a single call.
- [ECSqlStatement]($imodeljs-backend.ECSqlStatement) is the low-level API in case you need more flexibility, e.g. when iterating over the query results
