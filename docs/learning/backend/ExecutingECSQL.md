# Executing ECSQL with the iTwin.js Backend

ECSQL by itself is described in detail here: [ECSQL](../ECSQL.md)

Executing an ECSQL statement typically consists of these steps:

1. Prepare the ECSQL
1. Bind values to the [ECSQL parameters](../ECSQL.md#ecsql-parameters) (if parameters are used)
1. Execute the ECSQL and iterate the query results (for ECSQL SELECT statements).
1. Reset the statement and clear its parameter bindings, if the statement should be executed again.

> For iModels only ECSQL SELECT statements can be executed. Data modification must be done through the API.
> For example, see [IModelDb.Elements.updateElement]($backend).
> For [ECDb]($backend) ECSQL INSERT, UPDATE and DELETE statements can be executed as well.

There are three ways to execute an ECSQL statement:

- [IModelDb.createQueryReader]($backend) is the high-level API which does all the above steps in a single asynchronous call.
- [IModelDb.withQueryReader]($backend) is a **synchronous**, backend-only alternative to `createQueryReader`. It accepts a callback that receives an [ECSqlSyncReader]($backend), steps rows one at a time with no internal caching. Use this when you need synchronous execution in the backend and do not require the async concurrent-query infrastructure.
- [ECSqlStatement]($backend) is the lower-level API in case you need more flexibility,
  e.g. when iterating over the query results. Use [IModelDb.withPreparedStatement]($backend)
  or [ECDb.withPreparedStatement]($backend) in that case.

See [frequently used ECSQL queries](./ECSQL-queries.md) for the specific ECSQL queries that app backends and services often run.

> See [General Code Examples](../ECSQLCodeExamples.md), [Backend Code Examples](./ECSQLCodeExamples.md), and [withQueryReader Code Examples](./WithQueryReaderCodeExamples.md) for examples of how the API is used.
