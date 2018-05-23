# Write A Web Service

To write a [Web Service](../overview/App.md#imodel-services), you will do the following:

1. Write initialization logic, such as:
    * Start [IModelHost](./backend/IModelHost.md)
    * [Initialize Logging](./Logging.md)
    * [Configure FeatureGates](./FeatureGates.md)
1. Write the operations of the service, such as:
    * [Open an iModel as a briefcase](./backend/IModelDb.md)
    * [Access Elements](./backend/AccessElements.md)
    * [Execute ECSQL queries](./backend/ExecutingECSQL.md)
1. Expose the operations of the service as [RpcInterfaces](./Glossary.md#rpcinterface):
    * [Define](./RpcInterface.md#defining-the-interface) one or more RpcInterfaces.
    * [Implement](./RpcInterface.md#server-implementation) the RpcInterfaces.
    * [Serve](./RpcInterface.md#4-serve-the-interfaces) the RpcInterfaces to clients.
1. [Write a simple Web server](./RpcInterface.md#4-serve-the-interfaces)
1. [Package and deploy to the Web](./PackageAndDeployToTheWeb.md)