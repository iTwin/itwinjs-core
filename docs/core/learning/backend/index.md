# The App Backend

The backend of an app refers to the layers of software that are concerned mainly with data access, as described in the [app architecture overview](../../overview/SoftwareArchitecture.md). The backend may be in the form of a [service or agent](../../overview/App.md#agents-and-services) or an [app-specific backend](../../overview/App.md#app-backend).

The backend:

* runs on a computer with a copy of an iModel
* has access to the local file system
* determines the JavaScript engine (vs. the frontend where the JavaScript engine comes from the user's browser).
* has direct access to the native library, and hence its methods are generally synchronous.
* may load third-party native code

The iModelJs backend library is delivered in the **npm package** `@bentley/imodeljs-backend`.

## Backend Concerns

* Administration
  * [IModelHost](./IModelHost.md)
  * [Initialize Logging](../common/Logging.md)
  * [Configure FeatureGates](../common/FeatureGates.md)

* Expose the operations of the backend as [RpcInterfaces](./Glossary.md#rpcinterface).
    * [Define](../RpcInterface.md#defining-the-interface) one or more RpcInterfaces.
    * [Implement](../RpcInterface.md#server-implementation) the RpcInterfaces.
    * [Configure](../RpcInterface.md#3-configure-interfaces) the RpcInterfaces.

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
