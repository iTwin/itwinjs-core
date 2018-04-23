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

/** @docs-package-description
 * The imodeljs-backend package contains class for working with iModels and the BisCore schema that should be used by backend code only.
 */
/**
 * @docs-group-description App
 * Classes for defining an app.
 * For more information [[?]]
 */
/**
 * @docs-group-description BisCore
 * Classes for working with the major classes in the BisCore schema. The key classes are:
 * * #BisCore
 * * #Model
 * * #Element
 * * #Category
 * For more information [[?]]
 */
 /**
  * @docs-group-description Codes
  * Classes for working with Codes.
  * For more information [[?]]
  */
/**
 * @docs-group-description ECDb
 * Classes for working with ECDb.
 * For more information [[?]]
 */
/**
 * @docs-group-description ECSQL
 * Classes for working with ECSQL. The key classes are:
 * * #ECSqlStatement
 * * #ECSqlValue
 * For more information: [Executing ECSQL]($docs/learning/backend/ExecutingECSQL)
 */
/**
 * @docs-group-description FontsAndSymbology
 * Classes for working with fonts, colors, and other symbology.
 * For more information: [[?]]
 */
/**
 * @docs-group-description Gateway
 * Classes for working with Gateways.
 * For more information on the role of gateways in an app [[?]]
 */
/**
 * @docs-group-description iModels
 * Classes for working with iModels. The key classes are:
 * * #IModelDb
 * * #ConcurrencyControl
 * For more information [[?]]
 */
/**
 * @docs-group-description Portability
 * Classes to help write portable apps and libraries that will run on any platform, including web apps, node services, Electron desktops apps, and mobile apps.
 * For more information [[?]]
 */
/**
 * @docs-group-description Schemas
 * Classes for working with ECSchemas.
 * For more information [[?]]
 */
/**
 * @docs-group-description Views
 * Classes for working with views of models and elements. The key classes are:
 * * #ViewDefinition
 * For more information [[?]]
 */
