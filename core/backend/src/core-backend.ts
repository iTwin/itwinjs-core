/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

export * from "./BackendHubAccess.js";
export * from "./BackendLoggerCategory.js";
export * from "./BisCoreSchema.js";
export * from "./BlobContainerService.js";
export * from "./BriefcaseManager.js";
export * from "./Category.js";
export * from "./ChangedElementsDb.js";
export * from "./ChangesetECAdaptor.js";
export * from "./ChangeSummaryManager.js";
export * from "./ChannelControl.js";
export * from "./CheckpointManager.js";
export * from "./ClassRegistry.js";
export * from "./CloudSqlite.js";
export * from "./CodeService.js";
export * from "./CodeSpecs.js";
export * from "./DevTools.js";
export * from "./DisplayStyle.js";
export * from "./domains/FunctionalElements.js";
export * from "./domains/FunctionalSchema.js";
export * from "./domains/GenericElements.js";
export * from "./domains/GenericSchema.js";
export * from "./ECDb.js";
export * from "./ECSchemaXmlContext.js";
export * from "./ECSqlStatement.js";
export * from "./Element.js";
export * from "./ElementAspect.js";
export * from "./ElementGraphics.js";
export * from "./ElementTreeWalker.js";
export * from "./Entity.js";
export * from "./EntityReferences.js";
export * from "./ExportGraphics.js";
export * from "./ExternalSource.js";
export * from "./FontFile.js";
export * from "./GeoCoordConfig.js";
export * from "./GeographicCRSServices.js";
export * from "./HubMock.js";
export * from "./ImageSourceConversion.js";
export * from "./IModelDb.js";
export * from "./IModelDbFonts.js";
export * from "./IModelElementCloneContext.js";
export * from "./IModelHost.js";
export * from "./IModelJsFs.js";
export * from "./IpcHost.js";
export * from "./LineStyle.js";
export * from "./LocalhostIpcHost.js";
export * from "./LocalHub.js";
export * from "./LockControl.js";
export * from "./Material.js";
export * from "./Model.js";
export * from "./NativeAppStorage.js";
export * from "./NativeHost.js";
export * from "./NavigationRelationship.js";
export * from "./PropertyStore.js";
export * from "./Relationship.js";
export * from "./rpc/tracing.js";
export * from "./Schema.js";
export * from "./SchemaSync.js";
export * from "./SchemaUtils.js";
export * from "./SheetIndex.js";
export * from "./SqliteChangesetReader.js";
export * from "./SQLiteDb.js";
export * from "./SqliteStatement.js";
export * from "./TextAnnotationElement.js";
export * from "./TextAnnotationGeometry.js";
export {
  computeGraphemeOffsets, ComputeGraphemeOffsetsArgs, computeLayoutTextBlockResult, LayoutTextBlockArgs
} from "./TextAnnotationLayout.js";
export * from "./Texture.js";
export * from "./TileStorage.js";
export * from "./TxnManager.js";
export * from "./ViewDefinition.js";
export * from "./ViewStore.js";
export * from "./workspace/Settings.js";
export * from "./workspace/SettingsSchemas.js";
export * from "./workspace/Workspace.js";
export * from "./workspace/WorkspaceEditor.js";

export * from "./internal/cross-package.js";

/** @docs-package-description
 * The core-backend package always runs on the computer with a local Briefcase.
 *
 * It contains classes that [backend code]($docs/learning/backend/index.md) can use to work with directly with iModels.
 */

/**
 * @docs-group-description BlobContainers
 * Classes for working with cloud-based blob containers.
 */

/**
 * @docs-group-description Codes
 * Classes for working with [Codes]($docs/BIS/guide/fundamentals/codes.md).
 * See [the learning articles]($docs/learning/backend/index.md).
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
 * @docs-group-description ElementAspects
 * Subclasses of [ElementAspects]($docs/bis/guide/fundamentals/elementaspect-fundamentals.md).
 * See [the learning articles]($docs/learning/backend/index.md).
 */

/**
 * @docs-group-description ElementGeometry
 * Classes for defining the symbology and geometry of geometric elements
 */

/**
 * @docs-group-description Elements
 * Subclasses of [Elements]($docs/BIS/guide/fundamentals/element-fundamentals.md).
 * See [the learning articles]($docs/learning/backend/index.md).
 */

/**
  * @docs-group-description ExportGraphics
  * APIs for producing low-level graphics primitives from element geometry.
  */

/**
 * @docs-group-description HubAccess
 * APIs for working with IModelHub
 */

/**
 * @docs-group-description Images
 * APIs for encoding and decoding images
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
 * @docs-group-description Logging
 * Logger categories used by this package.
 */

/**
 * @docs-group-description Models
 * Subclasses of [Models]($docs/BIS/guide/fundamentals/model-fundamentals.md).
 * See [the learning articles]($docs/learning/backend/index.md).
 */

/**
 * @docs-group-description NativeApp
 * Classes for working with Mobile/Desktop Application.
 */

/**
 * @docs-group-description Portability
 */

/**
 * @docs-group-description Relationships
 * Classes that describe the [relationships]($docs/bis/guide/fundamentals/relationship-fundamentals.md) between elements.
 */

/**
 * @docs-group-description RpcInterface
 * Classes for working with [RpcInterfaces]($docs/learning/RpcInterface.md).
 */

/**
 * @docs-group-description Schema
 * Classes for working with [ECSchemas]($docs/learning/backend/SchemasAndElementsInTypeScript.md)
 */

/**
 * @docs-group-description SQLite
 * Classes for working directly with SQLite
 */

/**
 * @docs-group-description SQLiteDb
 * Classes for working with SQLiteDb.
 */

/**
 * @docs-group-description TileStorage
 * Class for working with cloud storage using iTwin/object-storage cloud providers
 */

/**
 * @docs-group-description ViewDefinitions
 * Classes for working with Elements that define what appears in [Views]($docs/learning/frontend/views.md).
 * See [the learning articles]($docs/learning/backend/createelements/#orthographicviewdefinition).
 */

/**
 * @docs-group-description Workspace
 * APIs for loading and using Settings and Workspace resources
 */
