# The Backend Library

The Backend refers to the layers of the iModelJs library that run on a computer with a copy of an iModel. The backend always runs in-process (i.e. in the same address space) with the native layers. The backend may be in the form of a [service or agent](../../overview/App.md#agents-and-services) or an [app-specific backend](../../overview/App.md#app-backend).

The backend:

* has direct access to the native library, and hence its methods are generally synchronous.
* has access to the local file system
* determines the JavaScript engine (vs. the frontend where the JavaScript engine comes from the user's browser). Usually that is V8 from Node.js
* may load third-party native code

See [the app architecture overview](../../overview/App.md) for more on how backends fit into overall app architecture.

All Promise-returning backend methods must [manage the LoggingActivityContext](./ManagingLoggingActivityContext.md).

The backend library is delivered in the **npm package** `@bentley/imodeljs-backend`.

## Administration
* [IModelHost](./IModelHost.md)

## IModelDb
* [Open an IModelDb](./IModelDb.md)
* [Synchronizing with iModelHub](./IModelDbSync.md)
* [Writing to an IModelDb](./IModelDbReadwrite.md)
  * [Concurrency control](./ConcurrencyControl.md)

## Working with Schemas and Elements in TypeScript
* [Working with Schemas and Elements in TypeScript](./SchemasAndElementsInTypeScript.md)

## Loading and Creating Elements, Aspects, and Models
* [Access Elements](./AccessElements.md)
* [Create Elements](./CreateElements.md)
* [Access Models](./AccessModels.md)
* [Create Models](./CreateModels.md)

## ECSQL

* [What is ECSQL?](../ECSQL.md)
* [Executing ECSQL statements](./ExecutingECSQL.md)
* [Code Examples](./ECSQLCodeExamples.md)
* [Frequently used ECSQL queries](./ECSQL-queries.md)

## Dealing with Codes
* [Reserve Codes](./ReserveCodes.md)

## Change Summary
* [Change Summary Overview](../ChangeSummaries)
