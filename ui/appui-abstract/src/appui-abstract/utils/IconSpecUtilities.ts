/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */

/* eslint-disable deprecation/deprecation */

/** Creates an IconSpec with an SVG source and gets the SVG source from an IconSpec.
 * @public @deprecated in 4.3. AppUI libraries >= 4.7.x support loading SVGs sources without prefixes, eliminating the need for these utilities.
 */
export class IconSpecUtilities {
  /** Prefix for an SVG IconSpec loaded with the Sprite loader */
  public static readonly SVG_PREFIX = "svg:";
  public static readonly WEB_COMPONENT_PREFIX = "webSvg:";

  /** Create an IconSpec for an SVG loaded into web component with sprite loader
   * This method is deprecated --  use createWebComponentIconSpec()
   * @public @deprecated in 3.2. Please avoid using the Sprite loader and use IconSpecUtilities.createWebComponentIconSpec() instead.
  */
  public static createSvgIconSpec(svgSrc: string): string {
    return `${IconSpecUtilities.SVG_PREFIX}${svgSrc}`;
  }
  /** Create an IconSpec for an SVG loaded into web component with svg-loader
   * @public @deprecated in 4.3. AppUI libraries > 4.7.x support loading SVGs sources without prefixes, eliminating the need for this utility.
  */
  public static createWebComponentIconSpec(srcString: string): string {
    return `${IconSpecUtilities.WEB_COMPONENT_PREFIX}${srcString}`;
  }

  /** Get the SVG Source from an sprite IconSpec
   * This method is deprecated -- use getWebComponentSource()
   * @public @deprecated in 3.2. avoid using the Sprite loader and use IconSpecUtilities.getWebComponentSource() instead.
  */
  public static getSvgSource(iconSpec: string): string | undefined {
    if (iconSpec.startsWith(IconSpecUtilities.SVG_PREFIX) && iconSpec.length > 4) {
      return iconSpec.slice(4);
    }

    return undefined;
  }
  /** Get the SVG Source from an svg-loader IconSpec
   * @public @deprecated in 4.3. AppUI libraries > 4.7.x support loading SVGs sources without prefixes, eliminating the need for this utility.
  */

  public static getWebComponentSource(iconSpec: string): string | undefined {
    if (iconSpec.startsWith(IconSpecUtilities.WEB_COMPONENT_PREFIX) && iconSpec.length > 7) {
      return iconSpec.slice(7);
    }

    return undefined;

  }
}
