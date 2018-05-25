# Write An Interactive App

To write an [interactive iModeljs app](../overview/App.md#interactive-apps), first divide the app's operations into two categories:
- Presentation = [frontend](./Glossary.md#frontend)
- iModel access = [backend](./Glossary.md#backend).

## 1. Write the Frontend
See the [frontend learning articles](./frontend/index.md).

## 2. Write the Backend
Some apps can use an already deployed Web service. In that case, there is no need to write a backend. Just write the frontend's main to [point to the remote service](./RpcInterface.md#client-side-configuration).

To write a [customized backend](../overview/App.md#app-backend), do the following:

1. Write initialization logic, such as:
    * Start [IModelHost](./backend/IModelHost.md)
    * [Initialize Logging](./common/Logging.md)
    * [Configure FeatureGates](./common/FeatureGates.md)
1. Write the operations of the backend, such as:
    * [Access Elements](./backend/AccessElements.md)
    * [Execute ECSQL queries](./backend/ExecutingECSQL.md)
    * [Modify the iModel](./backend/IModelDbReadwrite.md)
1. Expose the operations of the backend as [RpcInterfaces](./Glossary.md#rpcinterface).
    * [Define](./RpcInterface.md#defining-the-interface) one or more RpcInterfaces.
    * [Implement](./RpcInterface.md#server-implementation) the RpcInterfaces.
    * [Configure](./RpcInterface.md#3-configure-interfaces) the RpcInterfaces.

Note that an app backend typically does not open an iModel on its own initiative. Instead, normally, the app frontend will ask the backend to open an iModel, and then the frontend will pass the resulting [IModelToken]($common) to methods of the backend. The backend should therefore always initialize the [IModelReadRpcInterface]($common).

A backend may need to:
* [Synchronize with iModelHub](./backend/IModelDbSync.md)

## 3. Tailor, Package, and Deploy the App
An interactive app must be tailored to match each desired [configuration](../overview/App.md#configurations) and sometimes each target platform. It must then be packaged and deployed using appropriate tools. For more information, see:
* [Interactive Web app](./WriteAnInteractiveWebApp.md)
* [Interactive desktop app](./WriteAnInteractiveDesktopApp.md)
* [Interactive mobile app](./WriteAnInteractiveMobileApp.md)
