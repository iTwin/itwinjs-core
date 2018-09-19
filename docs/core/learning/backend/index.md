# Backend Code

Backend code is concerned mainly with data access, as described in the [app architecture overview](../../learning/SoftwareArchitecture.md). A backend may be in the form of a [service or agent](../../learning/App.md#agents-and-services) or an [app-specific backend](../../learning/App.md#app-backend).

Backend code:

* runs on a computer with a copy of an iModel
* has access to the local file system
* determines the JavaScript engine (vs. the frontend where the JavaScript engine comes from the user's browser).
* has direct access to the native library, and hence its methods are generally synchronous.
* may load third-party native code

The iModel.js backend library is delivered in the **npm package** `@bentley/imodeljs-backend`.

App backends, services, and agents must depend on @bentley/imodeljs-backend.

## Backend operations supported by @bentley/imodeljs-backend

* Administration
  * [IModelHost](./IModelHost.md)
  * [Initialize Logging](../common/Logging.md)
  * [Configure FeatureGates](../common/FeatureGates.md)

* Expose the operations of the backend as RpcInterfaces
    * [Define](../RpcInterface.md#defining-the-interface) one or more RpcInterfaces.
    * [Implement](../RpcInterface.md#server-implementation) the RpcInterfaces.
    * [Configure](../RpcInterface.md#3-configure-interfaces) the RpcInterfaces.
    * [Serve](../RpcInterface.md#4-serve-the-interfaces) the RpcInterfaces to clients.

* IModelDb
  * [Open an IModelDb](./IModelDb.md)
  * [Synchronizing with iModelHub](./IModelDbSync.md)
  * [Writing to an IModelDb](./IModelDbReadwrite.md)
    * [Concurrency control](./ConcurrencyControl.md)

* Working with Schemas and Elements in TypeScript
  * [Working with Schemas and Elements in TypeScript](./SchemasAndElementsInTypeScript.md)

* Loading and Creating Elements, Aspects, and Models
  * [Access Elements](./AccessElements.md)
  * [Create Elements](./CreateElements.md)
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

* Correlation with Frontend Requests
  * [Manage the ActivityLoggingContext](./ManagingActivityLoggingContext.md).
