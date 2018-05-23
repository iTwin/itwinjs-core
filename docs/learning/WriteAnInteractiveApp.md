# Write An Interactive App

To write an [interactive iModeljs app](../overview/App.md#interactive-apps), first divide the app's operations into two categories:
- Presentation = [frontend](./Glossary.md#frontend)
- iModel access = [backend](./Glossary.md#backend).

## 1. Write the Frontend
See the [frontend learning articles](./frontend/index.md).

## 2. Write the Backend
Some apps can use an already deployed Web service. In that case, there is no need to write a backend. Just write the frontend's main to [point to the remote service](./RpcInterface.md#client-side-configuration).

To write a [customized backend](./Glossary.md#backend), do the following:

1. Write initialization logic, such as:
    * [Initialize Logging](./Logging.md)
    * [Configure FeatureGates](./FeatureGates.md)
    * Start [IModelHost]($backend)
1. Write the operations of the backend, such as:
    * [Open an iModel as a briefcase](./backend/IModelDb.md)
    * [Access Elements](./backend/AccessElements.md)
    * [Execute ECSQL queries](./backend/ExecutingECSQL.md)
1. Expose the operations of the backend as [RpcInterfaces](./Glossary.md#rpcinterface).
    * [Define](./RpcInterface.md#defining-the-interface) one or more RpcInterfaces.
    * [Implement](./RpcInterface.md#server-implementation) the RpcInterfaces.
    * [Configure](./RpcInterface.md#3-configure-interfaces) the RpcInterfaces.

## 3. Tailor, Package, and Deploy the App
An interactive app must be tailored to match each desired [configuration](../overview/App.md#configurations) and sometimes each target platform. It must then be packaged and deployed using appropriate tools. For more information, see:
* [Interactive Web app](./WriteAnInteractiveWebApp.md)
* [Interactive desktop app](./WriteAnInteractiveDesktopApp.md)
* [Interactive mobile app](./WriteAnInteractiveMobileApp.md)
