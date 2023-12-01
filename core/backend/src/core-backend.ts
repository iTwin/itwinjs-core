/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

export { IModelJsNative, NativeCloudSqlite, NativeLoggerCategory } from "@bentley/imodeljs-native";

export * from "./BackendHubAccess";
export * from "./BackendLoggerCategory";
export * from "./BisCoreSchema";
export * from "./BlobContainerService";
export * from "./BriefcaseManager";
export * from "./Category";
export * from "./ChangedElementsDb";
export * from "./ChangeSummaryManager";
export * from "./ChannelControl";
export * from "./CheckpointManager";
export * from "./ClassRegistry";
export * from "./CloudSqlite";
export * from "./CodeService";
export * from "./CodeSpecs";
export * from "./DevTools";
export * from "./DisplayStyle";
export * from "./domains/FunctionalElements";
export * from "./domains/FunctionalSchema";
export * from "./domains/GenericElements";
export * from "./domains/GenericSchema";
export * from "./ECDb";
export * from "./ECSchemaXmlContext";
export * from "./ECSqlStatement";
export * from "./Element";
export * from "./ElementAspect";
export * from "./ElementGraphics";
export * from "./ElementTreeWalker";
export * from "./Entity";
export * from "./EntityReferences";
export * from "./ExportGraphics";
export * from "./ExternalSource";
export * from "./GeoCoordConfig";
export * from "./HubMock";
export * from "./IModelCloneContext";
export * from "./IModelDb";
export * from "./IModelElementCloneContext";
export * from "./IModelHost";
export * from "./IModelJsFs";
export * from "./SchemaSync";
export * from "./IpcHost";
export * from "./LineStyle";
export * from "./LocalhostIpcHost";
export * from "./LocalHub";
export * from "./Material";
export * from "./Model";
export * from "./NativeAppStorage";
export * from "./NativeHost";
export * from "./NavigationRelationship";
export * from "./PropertyStore";
export * from "./Relationship";
export * from "./rpc/tracing";
export * from "./Schema";
export * from "./SchemaUtils";
export * from "./SQLiteDb";
export * from "./SqliteStatement";
export * from "./Texture";
export * from "./TileStorage";
export * from "./TxnManager";
export * from "./ViewDefinition";
export * from "./ViewStore";
export * from "./workspace/Settings";
export * from "./workspace/SettingsSchemas";
export * from "./workspace/Workspace";
export * from "./SqliteChangesetReader";
export * from "./ChangesetECAdaptor";

/** @docs-package-description
 * The core-backend package always runs on the computer with a local Briefcase.
 *
 * It contains classes that [backend code]($docs/learning/backend/index.md) can use to work with directly with iModels.
 */
/**
 * @docs-group-description IModelHost
 * Classes for configuring and administering the backend [host]($docs/learning/backend/IModelHost.md).
 * See [the learning article]($docs/learning/backend/IModelHost.md).
 */
/**
 * @docs-group-description iModels
 * Classes for working with [iModels]($docs/learning/iModels.md).
 * See [the learning article]($docs/learning/backend/index.md).
 */
/**
 * @docs-group-description Schema
 * Classes for working with [ECSchemas]($docs/learning/backend/SchemasAndElementsInTypeScript.md)
 */
/**
 * @docs-group-description Models
 * Subclasses of [Models]($docs/BIS/guide/fundamentals/model-fundamentals.md).
 * See [the learning articles]($docs/learning/backend/index.md).
 */
/**
 * @docs-group-description Elements
 * Subclasses of [Elements]($docs/BIS/guide/fundamentals/element-fundamentals.md).
 * See [the learning articles]($docs/learning/backend/index.md).
 */
/**
 * @docs-group-description Codes
 * Classes for working with [Codes]($docs/BIS/guide/fundamentals/codes.md).
 * See [the learning articles]($docs/learning/backend/index.md).
 */
/**
 * @docs-group-description ViewDefinitions
 * Classes for working with Elements that define what appears in [Views]($docs/learning/frontend/views.md).
 * See [the learning articles]($docs/learning/backend/createelements/#orthographicviewdefinition).
 */
/**
 * @docs-group-description Relationships
 * Classes that describe the [relationships]($docs/bis/guide/fundamentals/relationship-fundamentals.md) between elements.
 */
/**
 * @docs-group-description ElementAspects
 * Subclasses of [ElementAspects]($docs/bis/guide/fundamentals/elementaspect-fundamentals.md).
 * See [the learning articles]($docs/learning/backend/index.md).
 */
/**
 * @docs-group-description Categories
 * Classes for [Categories]($docs/bis/guide/fundamentals/categories.md).
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
 * @docs-group-description SQLiteDb
 * Classes for working with SQLiteDb.
 */
/**
 * @docs-group-description NativeApp
 * Classes for working with Mobile/Desktop Application.
 */
/**
 * @docs-group-description ECSQL
 * Classes for working with [ECSQL]($docs/learning/ECSQL.md)
 */
/**
 * @docs-group-description SQLite
 * Classes for working directly with SQLite
 */
/**
 * @docs-group-description Portability
 * Classes to help write [portable apps]($docs/learning/Portability.md) and libraries that will run on any platform, including web apps, node services, Electron desktops apps, and mobile apps.
 */
/**
 * @docs-group-description Utils
 * Miscellaneous utility classes.
 */
/**
 * @docs-group-description Logging
 * Logger categories used by this package.
 */
/**
 * @docs-group-description RpcInterface
 * Classes for working with [RpcInterfaces]($docs/learning/RpcInterface.md).
 */
/**
 * @docs-group-description BlobContainers
 * Classes for working with cloud-based blob containers.
 */
/**
 * @docs-group-description TileStorage
 * Class for working with cloud storage using iTwin/object-storage cloud providers
 */
/**
 * @docs-group-description Authentication
 * Classes for working with Authentication.
 */
/**
 * @docs-group-description Tiles
 * APIs for working with tile graphics.
 */
/**
 * @docs-group-description HubAccess
 * APIs for working with IModelHub
 */
/**
 * @docs-group-description Workspace
 * APIs for loading and using Settings and Workspace resources
 */
/**
 * @docs-group-description ViewStateHydrator
 * Class responsible for loading ViewStates.
 */
