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
 * For more information, see [App Overview]($docs/overview/overview/App.md).
 */
/**
 * @docs-group-description BisCore
 * Classes for working with the major classes in the BisCore schema. The key classes are:
 * * [BisCore]($imodeljs-backend/BisCore)
 * * [Model]($imodeljs-backend/Model)
 * * [Element]($imodeljs-backend/Element)
 * * [Category]($imodeljs-backend/Category)
 * For more information, see [BIS Overview]($docs/overview/overview/BIS.md)
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
 * Classes for working with ECSQL. The key classes are:
 * * [ECSqlStatement]($imodeljs-backend.ECSqlStatement)
 * * [ECSqlValue]($imodeljs-backend.ECSqlValue)
 *
 * For more information, see [Executing ECSQL]($docs/learning/learning/ECSQL.md)
 */
/**
 * @docs-group-description FontsAndSymbology
 * Classes for working with fonts, colors, and other symbology.
 */
/**
 * @docs-group-description Gateway
 * Classes for working with Gateways.
 * For more information, see [Gateway Overview]($docs/overview/overview/App.md#gateways).
 */
/**
 * @docs-group-description iModels
 * Classes for working with iModels. The key classes are:
 * * [IModelDb]($imodeljs-backend.IModelDb)
 * * [ConcurrencyControl]($imodeljs-backend.ConcurrencyControl)
 * For more information, see [iModel Overview]($docs/overview/overview/IModels.md)
 */
/**
 * @docs-group-description Portability
 * Classes to help write portable apps and libraries that will run on any platform, including web apps, node services, Electron desktops apps, and mobile apps.
 * For more information, see [Portability Overview]($docs/learning/learning/Portability.md)
 */
/**
 * @docs-group-description Schemas
 * Classes for working with ECSchemas.
 * For more information: [Executing ECSQL]($docs/learning/learning/ECSQL.md)
 */
/**
 * @docs-group-description Views
 * Classes for working with views of models and elements. The key classes are:
 * * [ViewDefinition]($imodeljs-backend.ViewDefinition)
 */
