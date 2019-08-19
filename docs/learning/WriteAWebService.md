# Write A Web Service

A [Web Service](../learning/App.md#imodel-services) is backend code.

See [how to write backend code](./backend/index.md).

To develop a Web Service, you will also:
* [Write a simple Web server](./RpcInterface.md#serve-the-interfaces)
* [Package and deploy to the Web](./PackageAndDeployToTheWeb.md)

Note that a service typically does not open an iModel on its own initiative. Instead, normally, a client of the service will ask the service to open an iModel, and then the client will pass the resulting [IModelToken]($common) to methods of the service. The service should therefore always initialize the [IModelReadRpcInterface]($common).
