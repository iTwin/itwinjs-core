# Executing ECSQL with the iModelJs Frontend

ECSQL by itself is described in detail here: [ECSQL](../learning/ECSQL)

A frontend ECSQL query is executed by calling [IModelConnection.executeQuery]($imodeljs-frontend.IModelConnection.executeQuery).

> On the frontend, only ECSQL SELECT statements can be executed. Data modification must be done through the API.

## ECSQL Parameter Values

If the ECSQL is parameterized (see [ECSQL parameters](../learning/ECSQL#ecsql-parameters)), you must pass the parameter values to
[IModelConnection.executeQuery]($imodeljs-frontend.IModelConnection.executeQuery)

Pass an *array* of values if the parameters are *positional*. Pass an *object of the values keyed on the parameter name* for *named parameters*.

The section ["iModelJs Types used in ECSQL Parameter Bindings"](../learning/ECSQLParameterTypes) describes the iModelJs types to be used for the different ECSQL parameter types.

> The values in either the array or object must match the respective types of the parameter.

## Query Result

The result of the query is returned as an array of JavaScript objects where every array element represents an [ECSQL row](../learning/ECSQLRowFormat).

## Avoid *Chatty* Patterns

An ECSQL query initiated from the frontend necessarily requires a round trip with the backend server.
In Web Apps, round trips mean exposure to network latency, so a *chunky* request pattern will perform better than a *chatty* request pattern.
If multiple queries are required to build up the desired result, consider moving the operation to the backend.
