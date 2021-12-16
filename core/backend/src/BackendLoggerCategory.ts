/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Logging
 */

/** Logger categories used by this package
 * @note All logger categories in this package start with the `core-backend` prefix.
 * @see [Logger]($bentley)
 * @public
 */
export enum BackendLoggerCategory {
  /** The logger category used by API related to authorization */
  Authorization = "core-backend.Authorization",

  /** The logger category used by the following classes:
   * - [[CodeSpecs]]
   */
  CodeSpecs = "core-backend.CodeSpecs",

  /** The logger category used by the [[DevTools]] class and related classes.
   * @internal
   */
  DevTools = "core-backend.DevTools",

  /** The logger category used by the following classes:
   * - [[ChangeSummaryManager]]
   * - [[ECDb]]
   * - [[ECSqlStatement]]
   */
  ECDb = "core-backend.ECDb",

  /** The logger category used by the following classes:
   * - [[Functional]]
   */
  Functional = "core-backend.Functional",

  /** The logger category used by the following classes:
   * - [[LinearReferencing]]
   */
  LinearReferencing = "core-backend.LinearReferencing",

  /** The logger category used by the following classes:
   * - BriefcaseManager
   * - [[IModelDb]]
   */
  IModelDb = "core-backend.IModelDb",

  /** The logger category used by the following classes:
   * - [[IModelHost]]
   */
  IModelHost = "core-backend.IModelHost",

  /** The logger category used by the following classes:
   * - TileRequestMemoizer
   */
  IModelTileRequestRpc = "core-backend.IModelTileRequestRpc",

  /** The logger category used by the following classes:
   * - IModelTileRpcImpl (Tile Uploading)
   */
  IModelTileUpload = "core-backend.IModelTileUpload",

  /** The logger category used by the following classes:
   * - [[Relationship]]
   */
  Relationship = "core-backend.Relationship",

  /** The logger category used by the following classes:
   * - [[Schemas]]
   */
  Schemas = "core-backend.Schemas",

  /** The logger category used by the following classes:
   * - [[PromiseMemoizer]]
   */
  PromiseMemoizer = "core-backend.PromiseMemoizer",
  /** The logger category used by the following classes:
   * - [[EventSink]]
   */
  EventSink = "core-backend.EventSink",

  /** The logger category used by the following classes:
   * - [[IModelSchemaLoader]]
   * @alpha
   */
  IModelSchemaLoader = "core-backend.IModelSchemaLoader",

  /** The logger category used by the following classes:
   * - [[iModels]]
   * @alpha
   */
  Editing = "core-backend.Editing",

  /** The logger category used by the following classes:
   * - [[NativeHost]], [[NativeAppStorage]]
   * @internal
   */
  NativeApp = "core-backend.NativeApp",
}
