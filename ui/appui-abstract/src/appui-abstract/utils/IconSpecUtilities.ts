/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */

/** Creates an IconSpec with an SVG source and gets the SVG source from an IconSpec.
 * @public
 */
export class IconSpecUtilities {
  /** Prefix for an SVG IconSpec loaded with the Sprite loader */
  public static readonly SVG_PREFIX = "svg:";
  public static readonly WEB_COMPONENT_PREFIX = "webSvg:";

  /** Create an IconSpec for an SVG loaded into web component with svg-loader
   * @public
   */
  public static createWebComponentIconSpec(srcString: string): string {
    return `${IconSpecUtilities.WEB_COMPONENT_PREFIX}${srcString}`;
  }

  /** Get the SVG Source from an svg-loader IconSpec
   * @public
   */
  public static getWebComponentSource(iconSpec: string): string | undefined {
    if (
      iconSpec.startsWith(IconSpecUtilities.WEB_COMPONENT_PREFIX) &&
      iconSpec.length > 7
    ) {
      return iconSpec.slice(7);
    }

    return undefined;
  }
}
