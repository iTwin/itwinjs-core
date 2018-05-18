/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
export * from "./NativePlatformRegistry";
export * from "./AutoPush";
export * from "./BriefcaseManager";
export * from "./Category";
export * from "./ChangeSummaryManager";
export * from "./ClassRegistry";
export * from "./CodeSpecs";
export * from "./ConcurrencyControl";
export * from "./ECDb";
export * from "./ECSchemaXmlContext";
export * from "./ECSqlStatement";
export * from "./Element";
export * from "./ElementAspect";
export * from "./ElementPropertyFormatter";
export * from "./Entity";
export * from "./IModelJsFs";
export * from "./IModelHost";
export * from "./Platform";
export * from "./LinkTableRelationship";
export * from "./LineStyle";
export * from "./Model";
export * from "./Schema";
export * from "./ViewDefinition";
export * from "./BisCore";
export * from "./IModelDb"; // must be last

/** @module iModels */

/** @docs-package-description
 * The imodeljs-backend package contains classes that backend code can use to work with directly with iModel content using briefcases.
 */
/**
 * @docs-group-description App
 * Classes for defining an app.
 * For more information, see [App Overview]($docs/overview/App.md).
 */
/**
 * @docs-group-description BisCore
 * Classes for working with the major classes such as [BisCore]($backend), [Model]($backend), [Element]($backend), and [Category]($backend) in the BisCore schema - see [working with schemas and elements in TypeScript]($docs/learning/backend/SchemasAndElementsInTypeScript.md) and [BIS Overview]($docs/bis).
 */
 /**
  * @docs-group-description Codes
  * Classes for working with Codes.
  */
/**
 * @docs-group-description ECDb
 * Classes for working with ECDb.
 */
/**
 * @docs-group-description ECSQL
 * Classes for working with ECSQL using [ECSqlStatement]($backend) and [ECSqlValue]($backend) - see [Executing ECSQL]($docs/learning/ECSQL.md)
 */
/**
 * @docs-group-description FontsAndSymbology
 * Classes for working with fonts, colors, and other symbology.
 */
/**
 * @docs-group-description iModels
 * Classes for working with iModels, such as [IModelDb]($backend) and [ConcurrencyControl]($backend) - see [iModel Overview]($docs/overview/IModels.md)
 */
/**
 * @docs-group-description Portability
 * Classes to help write portable apps and libraries that will run on any platform, including web apps, node services, Electron desktops apps, and mobile apps - see [Portability Overview]($docs/learning/Portability.md)
 */
/**
 * @docs-group-description RpcInterface
 * Classes for working with RpcInterfaces - see [RpcInterface Overview]($docs/overview/RpcInterface) and [RpcInterface Learning]($docs/learning/RpcInterface.md).
 */
/**
 * @docs-group-description Schema
 * Classes for working with ECSchemas - see [working with schemas and elements in TypeScript]($docs/learning/backend/SchemasAndElementsInTypeScript.md)
 */
/**
 * @docs-group-description Views
 * Classes for working with views, such as [ViewDefinition]($backend)
 */
