# App backend development

Backend code is the portion of an app that:

- Runs on a computer with a copy of an iModel
- Has access to the local file system
- Can use native libraries

A backend package can be a [service](../../learning/App.md#agents-and-services), an [agent](../../learning/App.md#agents-and-services), or an [app-specific backend](../../learning/App.md#app-backend).

- See the [app architecture overview](../../learning/SoftwareArchitecture.md) for how iTwin.js apps are structured.
- See [iModel contents](./iModelContents.md) for guidance on whether a data type belongs in the iModel or should be stored in a separate repository.
- See [best practices](./BestPractices.md) for writing backend code.

App backends require the `@itwin/core-backend` npm package.
The [common packages](../common/index.md) will also be required. Please also note the [supported platforms](../SupportedPlatforms.md).

These packages provide the following functions to support backend operations:

- Administration
  - [IModelHost](./IModelHost.md)
  - [Initialize Logging](../common/Logging.md)

- IModelDb
  - [Open an IModelDb](./IModelDb.md)
  - [Synchronizing with iModelHub](./IModelDbSync.md)
  - [Writing to an IModelDb](./IModelDbReadwrite.md)
  - [iModel Transformation and Data Exchange](../transformer/index.md)

- Working with Schemas and Elements in TypeScript
  - [Working with Schemas and Elements in TypeScript](./SchemasAndElementsInTypeScript.md)

- Loading and Creating Elements, ElementAspects, and Models
  - [Access Elements](./AccessElements.md)
  - [Create Elements](./CreateElements.md)
  - [Access ElementAspects](./AccessElementAspects.md)
  - [Create ElementAspects](./CreateElementAspects.md)
  - [Access Models](./AccessModels.md)
  - [Create Models](./CreateModels.md)

- ECSQL
  - [What is ECSQL?](../ECSQL.md)
  - [Executing ECSQL statements](./ExecutingECSQL.md)
  - [Code Examples](./ECSQLCodeExamples.md)
  - [Frequently used ECSQL queries](./ECSQL-queries.md)

- Dealing with Codes
  - [Reserve Codes](./ReserveCodes.md)

- Change Summary
  - [Change Summary Overview](../ChangeSummaries)

For services and app backends:

- Exposing the operations of the backend as RpcInterfaces
  - [Define](../RpcInterface.md#define-the-interface) one or more RpcInterfaces.
  - [Implement](../RpcInterface.md#server-implementation) the RpcInterfaces.
  - [Configure](../RpcInterface.md#configure-interfaces) the RpcInterfaces.
  - [Serve](../RpcInterface.md#serve-the-interfaces) the RpcInterfaces to clients.
