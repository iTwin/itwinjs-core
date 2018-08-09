/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Content */

/**
 * Displayed content types. Affects how the content is formatted, e.g.
 * the [[ContentFlags]]
 */
export default class DefaultContentDisplayTypes {
  /** Unknown content type. */
  public static readonly UNDEFINED = "Undefined";

  /** Grid or table view content type. By default adds [[ContentFlags.ShowLabels]] flag. */
  public static readonly GRID = "Grid";

  /** Property pane content type. By default adds [[ContentFlags.MergeResults]] flag. */
  public static readonly PROPERTY_PANE = "PropertyPane";

  /** List content type. By default adds [[ContentFlags.NoFields]] and [[ContentFlags.ShowLabels]] flags */
  public static readonly LIST = "List";

  /** Viewport content type. By default adds [[ContentFlags.KeysOnly]] flag. */
  public static readonly VIEWPORT = "Graphics";
}
