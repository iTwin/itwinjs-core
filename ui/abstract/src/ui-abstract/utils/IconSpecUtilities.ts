/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module Utilities */

/** Various IconSpec utilities.
 * @beta
 */
export class IconSpecUtilities {
  /** Prefix for an SVG IconSpec */
  public static readonly SVG_PREFIX = "svg:";

  /** Create an IconSpec for an SVG */
  public static createSvgIconSpec(svgSrc: string): string {
    return `${IconSpecUtilities.SVG_PREFIX}${svgSrc}`;
  }

  /** Get the SVG Source from an IconSpec */
  public static getSvgSource(iconSpec: string): string | undefined {
    let svgSource: string | undefined;

    if (iconSpec.startsWith(IconSpecUtilities.SVG_PREFIX) && iconSpec.length > 4) {
      svgSource = iconSpec.slice(4);
    }

    return svgSource;
  }
}
