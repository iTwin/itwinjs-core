/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Logging
 */

/** Logger categories used by this package
 * @note All logger categories in this package start with the `imodeljs-backend` prefix.
 * @see [Logger]($bentley)
 * @public
 */
export enum BackendLoggerCategory {
  /** The logger category used by API related to authorization */
  Authorization = "imodeljs-backend.Authorization",

  /** The logger category used by the following classes:
   * - [[CodeSpecs]]
   */
  CodeSpecs = "imodeljs-backend.CodeSpecs",

  /** The logger category used by the following classes:
   * - [[ConcurrencyControl]]
   */
  ConcurrencyControl = "imodeljs-backend.ConcurrencyControl",

  /** The logger category used by the [[DevTools]] class and related classes.
   * @internal
   */
  DevTools = "imodeljs-backend.DevTools",

  /** The logger category used by the following classes:
   * - [[ChangeSummaryManager]]
   * - [[ECDb]]
   * - [[ECSqlStatement]]
   */
  ECDb = "imodeljs-backend.ECDb",

  /** The logger category used by the following classes:
   * - [[Functional]]
   */
  Functional = "imodeljs-backend.Functional",

  /** The logger category used by the following classes:
   * - [[LinearReferencing]]
   */
  LinearReferencing = "imodeljs-backend.LinearReferencing",

  /** The logger category used by the following classes:
   * - [[AutoPush]]
   * - BriefcaseManager
   * - [[IModelDb]]
   */
  IModelDb = "imodeljs-backend.IModelDb",

  /** The logger category used by the following classes:
   * - [[IModelHost]]
   */
  IModelHost = "imodeljs-backend.IModelHost",

  /** The logger category used by the [IModelExporter]($backend) class.
   * @beta
   */
  IModelExporter = "imodeljs-backend.IModelExporter",

  /** The logger category used by the [IModelImporter]($backend) class.
   * @beta
   */
  IModelImporter = "imodeljs-backend.IModelImporter",

  /** The logger category used by the [IModelTransformer]($backend) class.
   * @beta
   */
  IModelTransformer = "imodeljs-backend.IModelTransformer",

  /** The logger category used by the following classes:
   * - TileRequestMemoizer
   */
  IModelTileRequestRpc = "imodeljs-backend.IModelTileRequestRpc",

  /** The logger category used by the following classes:
   * - IModelTileRpcImpl (Tile Uploading)
   */
  IModelTileUpload = "imodeljs-backend.IModelTileUpload",

  /** The logger category used by the following classes:
   * - [[Relationship]]
   */
  Relationship = "imodeljs-backend.Relationship",

  /** The logger category used by the following classes:
   * - [[Schemas]]
   */
  Schemas = "imodeljs-backend.Schemas",

  /** The logger category used by the following classes:
   * - [[PromiseMemoizer]]
   */
  PromiseMemoizer = "imodeljs-backend.PromiseMemoizer",
  /** The logger category used by the following classes:
   * - [[EventSink]]
   */
  EventSink = "imodeljs-backend.EventSink",

  /** The logger category used by the following classes:
   * - [[IModelSchemaLoader]]
   * @alpha
   */
  IModelSchemaLoader = "imodeljs-backend.IModelSchemaLoader",

  /** The logger category used by the following classes:
   * - [[iModels]]
   * @alpha
   */
  Editing = "imodeljs-backend.Editing",

  /** The logger category used by the following classes:
   * - [[NativeHost]], [[NativeAppStorage]]
   * @internal
   */
  NativeApp = "imodeljs-backend.NativeApp",

  /** The logger category used by the following class:
   * - [[UsageLoggingUtilities]]
   * @internal
   */
  UsageLogging = "imodeljs-backend.UlasUtilities",
}
