/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Content */

/**
 * Displayed content types. Affects how the content is formatted, e.g.
 * the [[ContentFlags]].
 *
 * @public
 */
export enum DefaultContentDisplayTypes {
  /** Unknown content type. */
  Undefined = "Undefined",

  /** Grid or table view content type. By default adds [[ContentFlags.ShowLabels]] flag. */
  Grid = "Grid",

  /** Property pane content type. By default adds [[ContentFlags.MergeResults]] flag. */
  PropertyPane = "PropertyPane",

  /** List content type. By default adds [[ContentFlags.NoFields]] and [[ContentFlags.ShowLabels]] flags */
  List = "List",

  /** Viewport content type. By default adds [[ContentFlags.KeysOnly]] flag. */
  Viewport = "Graphics",
}
