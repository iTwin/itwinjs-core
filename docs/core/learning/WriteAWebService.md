# Write A Web Service

To write a [Web Service](../learning/App.md#imodel-services), you will do the following:

1. Write initialization logic, such as:
    * Start [IModelHost](./backend/IModelHost.md)
    * [Initialize Logging](./common/Logging.md)
    * [Configure FeatureGates](./common/FeatureGates.md)
1. Write the operations of the service, such as:
    * [Access Elements](./backend/AccessElements.md)
    * [Execute ECSQL queries](./backend/ExecutingECSQL.md)
1. Expose the operations of the service as [RpcInterfaces](./Glossary.md#rpcinterface):
    * [Define](./RpcInterface.md#defining-the-interface) one or more RpcInterfaces.
    * [Implement](./RpcInterface.md#server-implementation) the RpcInterfaces.
    * [Serve](./RpcInterface.md#4-serve-the-interfaces) the RpcInterfaces to clients.
1. [Write a simple Web server](./RpcInterface.md#4-serve-the-interfaces)
1. [Package and deploy to the Web](./PackageAndDeployToTheWeb.md)

Note that a service typically does not open an iModel on its own initiative. Instead, normally, a client of the service will ask the service to open an iModel, and then the client will pass the resulting [IModelToken]($common) to methods of the service. The service should therefore always initialize the [IModelReadRpcInterface]($common).

A service may also need to:
* [Synchronize with iModelHub](./backend/IModelDbSync.md)
