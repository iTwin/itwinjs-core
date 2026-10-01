# Executing ECSQL with the iTwin.js Frontend

See [ECSQL](../ECSQL.md) for the query language.

Use [IModelConnection.createQueryReader]($frontend) for asynchronous queries. It returns an [ECSqlReader]($common) immediately; consume results with `for await...of`, `await reader.step()`, or `await reader.toArray()`. Query execution starts when the reader is consumed, and results are fetched in batches.

The synchronous `withQueryReader` API is available only on the backend. See [Choosing a query reader](../backend/ExecutingECSQL.md#choosing-a-query-reader) for the execution and lifetime differences.

> On the frontend, only ECSQL SELECT statements can be executed. Data modification must be done through the API.

## Avoid *Chatty* Patterns

An ECSQL query initiated from the frontend necessarily requires a round trip with the backend server.
In Web Apps, round trips mean exposure to network latency, so a *chunky* request pattern will perform better than a *chatty* request pattern.
If multiple queries are required to build up the desired result, consider moving the operation to the backend.

> See [asynchronous ECSQL query examples](../ECSQLCodeExamples.md) for bindings, iteration, and row formats.
