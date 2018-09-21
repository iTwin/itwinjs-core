# App backend development

Backend code is the portion of an app that:
* Runs on a computer with a copy of an iModel
* Has access to the local file system
* Can use native libraries

A backend package can be a [service](../../learning/App.md#agents-and-services), an [agent](../../learning/App.md#agents-and-services), or an [app-specific backend](../../learning/App.md#app-backend). See the [app architecture overview](../../learning/SoftwareArchitecture.md) for how iModelJs apps are structured.

App backends require the `@bentley/imodeljs-backend` npm package.
The [common packages](..\common\index.md) will also be required.

These packages provide the following functions to support backend operations:

* Administration
  * [IModelHost](./IModelHost.md)
  * [Initialize Logging](../common/Logging.md)
  * [Configure FeatureGates](../common/FeatureGates.md)

* IModelDb
  * [Open an IModelDb](./IModelDb.md)
  * [Synchronizing with iModelHub](./IModelDbSync.md)
  * [Writing to an IModelDb](./IModelDbReadwrite.md)
  * [Concurrency control](./ConcurrencyControl.md)

* Working with Schemas and Elements in TypeScript
  * [Working with Schemas and Elements in TypeScript](./SchemasAndElementsInTypeScript.md)

* Loading and Creating Elements, ElementAspects, and Models
  * [Access Elements](./AccessElements.md)
  * [Create Elements](./CreateElements.md)
  * [Access ElementAspects](./AccessElementAspects.md)
  * [Access Models](./AccessModels.md)
  * [Create Models](./CreateModels.md)

* ECSQL

  * [What is ECSQL?](../ECSQL.md)
  * [Executing ECSQL statements](./ExecutingECSQL.md)
  * [Code Examples](./ECSQLCodeExamples.md)
  * [Frequently used ECSQL queries](./ECSQL-queries.md)

* Dealing with Codes
  * [Reserve Codes](./ReserveCodes.md)

* Change Summary
  * [Change Summary Overview](../ChangeSummaries)

For services and app backends:

* Correlating backend operations with frontend Requests
  * [Manage the ActivityLoggingContext](./ManagingActivityLoggingContext.md).

* Exposing the operations of the backend as RpcInterfaces
  * [Define](../RpcInterface.md#define-the-interface) one or more RpcInterfaces.
  * [Implement](../RpcInterface.md#server-implementation) the RpcInterfaces.
  * [Configure](../RpcInterface.md#configure-interfaces) the RpcInterfaces.
  * [Serve](../RpcInterface.md#serve-the-interfaces) the RpcInterfaces to clients.
