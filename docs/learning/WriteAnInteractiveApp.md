# Write An Interactive App

To write an [interactive iModeljs app](../overview/App.md#interactive-apps), you first divide the app's function into two parts: [frontend]($./Glossary.md#frontend) and [backend]($./Glossary.md#backend).

## Write the Frontend
See the [frontend learning articles](./frontend/index.md).

## Write the Backend
Some apps can use an already deployed Web service. In that case, there is no need to write a backend. The frontend just [points to the service](./RpcInterface.md#client-side-configuration).

If your interactive app does need a [customized backend]($./Glossary.md#backend), you will do the following:

Write initialization logic, such as:
* [Initialize Logging](./Logging.md)
* [Configure FeatureGates](./FeatureGates.md)
* Start [IModelHost]($backend)

Write [backend code](./Glossary.md#backend) that implements the operations of the service, such as:
* [Open an iModel as a briefcase](./backend/IModelDb.md)
* [Access Elements](./backend/AccessElements.md)
* [Execute ECSQL queries](./backend/ExecutingECSQL.md), including:
  * [Spatial Queries](./SpatialQueries.md)

Expose the operations as [RpcInterfaces](./Glossary.md#rpcinterface).
* [Define](./RpcInterface.md#defining-the-interface) one or more RpcInterfaces.
* [Implement](./RpcInterface.md#server-implementation) the RpcInterfaces.
* [Configure](./RpcInterface.md#3-configure-interfaces) the RpcInterfaces.

## Tailor the App
An interactive app must be tailored to match each desired configuration and sometimes each target platform. Tailoring is described [here](../overview/AppTailoring.md).

## Package the app.
*TBD*