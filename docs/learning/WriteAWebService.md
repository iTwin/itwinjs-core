# Write A Web Service

To write a [Web Service](../overview/App.md#imodel-services), you will do the following:

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
* [Serve](./RpcInterface.md#4-serve-the-interfaces) the RpcInterfaces to clients.

Write a simple Web server using a package such as express.

Deploy the service. *TBD*