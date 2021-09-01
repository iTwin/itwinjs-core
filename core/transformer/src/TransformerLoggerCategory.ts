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
export enum TransformerLoggerCategory {
  /** The logger category used by the [IModelExporter]($transformer) class.
   * @beta
   */
  IModelExporter = "imodeljs-backend.IModelExporter",

  /** The logger category used by the [IModelImporter]($transformer) class.
   * @beta
   */
  IModelImporter = "imodeljs-backend.IModelImporter",

  /** The logger category used by the [IModelTransformer]($transformer) class.
   * @beta
   */
  IModelTransformer = "imodeljs-backend.IModelTransformer",
}
