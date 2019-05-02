/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Logging */

/** Logger categories used by this package
 * @note All logger categories in this package start with the `imodeljs-backend` prefix.
 * @see [Logger]($bentley)
 * @public
 */
export enum LoggerCategory {
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
   * - [[AutoPush]]
   * - BriefcaseManager
   * - [[IModelDb]]
   */
  IModelDb = "imodeljs-backend.IModelDb",

  /** The logger category used by the following classes:
   * - [[IModelHost]]
   */
  IModelHost = "imodeljs-backend.IModelHost",

  /** The logger category used by the following classes:
   * - [[IModelImporter]]
   * @alpha
   */
  IModelImporter = "imodeljs-backend.IModelImporter",

  /** The logger category used by the following classes:
   * - TileRequestMemoizer
   */
  IModelTileRequestRpc = "imodeljs-backend.IModelTileRequestRpc",

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
}
