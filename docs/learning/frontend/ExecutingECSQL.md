# Executing ECSQL with the iModelJs Frontend

ECSQL by itself is described in detail here: [ECSQL](../ECSQL)

An ECSQL query is executed by calling [IModelConnection.executeQuery]($imodeljs-frontend.IModelConnection.executeQuery).

> For iModels only ECSQL SELECT statements can be executed. Data modification has to be done through
> the dedicated Element API.

## ECSQL Parameter Values

If the ECSQL is parametrized (see [ECSQL parameters](../ECSQL#ecsql-parameters)), you must pass the parameter values to
[IModelConnection.executeQuery]($imodeljs-frontend.IModelConnection.executeQuery)

Pass an *array* of values if the parameters are *positional*. Pass an *object of the values keyed on the parameter name* for *named parameters*.

The section ["iModelJs Types used in ECSQL Parameter Bindings"](../ECSQLParameterTypes) describes the iModelJs types to be used for the different ECSQL parameter types.

> The values in either the array or object must match the respective types of the parameter.

## Query Result

The result of the query is returned as an array of JavaScript objects where every array element represents an [ECSQL row](../ECSQLRowFormat).
