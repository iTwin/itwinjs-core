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
export * from "./SqliteStatement";
export * from "./ViewDefinition";
export * from "./BisCore";
export * from "./domains/Functional";
export * from "./domains/FunctionalElements";
export * from "./IModelDb"; // must be last

/** @docs-package-description
 * The imodeljs-backend package always runs on the computer with a local Briefcase.
 *
 * It contains classes that [backend code]($docs/learning/backend/index.md) can use to work with directly with iModels. - see [learning about backends]($docs/learning/backend/index.md).
 */
/**
 * @docs-group-description IModelHost
 * Classes for configuring and administering the backend [host]($docs/learning/backend/IModelHost.md).
 */
/**
 * @docs-group-description iModels
 * Classes for working with [iModels]($docs/overview/iModels.md)
 */
/**
 * @docs-group-description Schema
 * Classes for working with [ECSchemas]($docs/learning/backend/SchemasAndElementsInTypeScript.md)
 */
/**
 * @docs-group-description Models
 * Subclasses of [Models]($docs/BIS/intro/model-fundamentals.md).
 */
/**
 * @docs-group-description Elements
 * Subclasses of [Elements]($docs/BIS/intro/element-fundamentals.md).
 */
/**
 * @docs-group-description Codes
 * Classes for working with [Codes]($docs/BIS/intro/codes.md).
 */
/**
 * @docs-group-description ViewDefinitions
 * Classes for working with elements that define what appears in [views]($docs/learning/frontend/views.md).
 */
/**
 * @docs-group-description Relationships
 * Classes that describe the [relationships]($docs/bis/intro/relationship-fundamentals.md) between elements.
 */
/**
 * @docs-group-description ElementAspects
 * Subclasses of [ElementAspects]($docs/bis/intro/elementaspect-fundamentals.md).
 */
/**
 * @docs-group-description Categories
 * Classes for [Categories]($docs/bis/intro/categories.md).
 */
/**
 * @docs-group-description Symbology
 * Classes for defining the appearance of element geometry
 */
/**
 * @docs-group-description ECDb
 * Classes for working with ECDb.
 */
/**
 * @docs-group-description ECSQL
 * Classes for working with [ECSQL]($docs/learning/ECSQL.md)
 */
/**
 * @docs-group-description Portability
 * Classes to help write [portable apps]($docs/learning/Portability.md) and libraries that will run on any platform, including web apps, node services, Electron desktops apps, and mobile apps.
 */
