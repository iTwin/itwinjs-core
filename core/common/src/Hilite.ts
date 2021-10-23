/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Rendering
 */

import { ColorDef } from "./ColorDef";

/** Contains types related to display of hilited elements within a [[Viewport]].
 * @public
 */
export namespace Hilite {
  /**  Describes the width of the outline applied to hilited geometry. The outline is drawn around the union of all hilited geometry and is visible behind non-hilited geometry.
   * @see [[Hilite.Settings]]
   */
  export enum Silhouette {
    /** No outline. */
    None,
    /** 1-pixel-wide outline. */
    Thin,
    /** 2-pixel-wide outline. */
    Thick,
  }

  /**
   * Describes how the hilite effect is applied to elements within a [[Viewport]].
   * The hilite effect is applied to elements contained in the [[IModelConnection]]'s [[SelectionSet]].
   * It is designed to draw attention to those elements. The effect is produced as follows:
   *  1. All hilited elements are drawn as normal, except that their element color is mixed with the hilite color.
   *  2. The union of the regions of the screen corresponding to hilited elements is computed.
   *  3. A silhouette is drawn using the hilite color around the boundaries of the hilited region. This silhouette is visible behind other geometry.
   *  4. The hilite color is mixed with the color of each pixel within the hilited region. This enables surfaces of hilited geometry to be visible behind other geometry.
   *
   * The Settings allow an application to customize how this effect is applied.
   * @see [[Viewport.hilite]]
   */
  export class Settings {
    /** The color that is used to draw the outline and which is mixed with element color. */
    public readonly color: ColorDef;
    /** The ratio of hilite color to element color used when drawing unobscured portions of hilited geometry, in the range [0, 1].
     * A ratio of 0.0 uses only the element color. A ratio of 1.0 uses only the hilite color. A ratio of 0.5 mixes the hilite color and element color evenly.
     */
    public readonly visibleRatio: number;
    /** The ratio of hilite color to screen color used when drawing the hilited region overtop of the screen contents, in the range [0, 1]. */
    public readonly hiddenRatio: number;
    /** The type of outline to be drawn around the boundaries of the hilited region. */
    public silhouette: Silhouette;

    private static clamp(value: number) { return Math.min(1.0, Math.max(0.0, value)); }

    public constructor(color = ColorDef.from(0x23, 0xbb, 0xfc), visibleRatio = 0.25, hiddenRatio = 0.0, silhouette = Silhouette.Thin) {
      this.color = color;
      this.silhouette = silhouette;
      this.visibleRatio = Settings.clamp(visibleRatio);
      this.hiddenRatio = Settings.clamp(hiddenRatio);
    }
  }

  /** Compare two Settings objects for equivalence. */
  export function equalSettings(lhs: Settings, rhs: Settings): boolean {
    return lhs.color.equals(rhs.color)
      && lhs.visibleRatio === rhs.visibleRatio
      && lhs.hiddenRatio === rhs.hiddenRatio
      && lhs.silhouette === rhs.silhouette;
  }

  /** Create a copy of a Settings object. */
  export function cloneSettings(settings: Settings): Settings {
    return new Settings(settings.color, settings.visibleRatio, settings.hiddenRatio, settings.silhouette);
  }
}
