# Executing ECSQL with the iTwin.js Frontend

ECSQL by itself is described in detail here: [ECSQL](../ECSQL)

A frontend ECSQL query is executed by calling [IModelConnection.query]($imodeljs-frontend).

> On the frontend, only ECSQL SELECT statements can be executed. Data modification must be done through the API.

## Avoid *Chatty* Patterns

An ECSQL query initiated from the frontend necessarily requires a round trip with the backend server.
In Web Apps, round trips mean exposure to network latency, so a *chunky* request pattern will perform better than a *chatty* request pattern.
If multiple queries are required to build up the desired result, consider moving the operation to the backend.

See [Code Examples](./ECSQLCodeExamples) for examples of how the API is used.
