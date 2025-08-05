/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */

/* eslint-disable @typescript-eslint/no-deprecated */

/** Creates an IconSpec with an SVG source and gets the SVG source from an IconSpec.
 * @public @deprecated in 4.3 - will not be removed until after 2026-06-13. AppUI libraries >= 4.7.x support loading SVGs sources without prefixes, eliminating the need for these utilities.
 */
export class IconSpecUtilities {
  /** Prefix for an SVG IconSpec loaded with the Sprite loader */
  public static readonly SVG_PREFIX = "svg:";
  public static readonly WEB_COMPONENT_PREFIX = "webSvg:";

  /** Create an IconSpec for an SVG loaded into web component with svg-loader
   * @public @deprecated in 4.3 - will not be removed until after 2026-06-13. AppUI libraries > 4.7.x support loading SVGs sources without prefixes, eliminating the need for this utility.
  */
  public static createWebComponentIconSpec(srcString: string): string {
    return `${IconSpecUtilities.WEB_COMPONENT_PREFIX}${srcString}`;
  }

  /** Get the SVG Source from an svg-loader IconSpec
   * @public @deprecated in 4.3 - will not be removed until after 2026-06-13. AppUI libraries > 4.7.x support loading SVGs sources without prefixes, eliminating the need for this utility.
  */

  public static getWebComponentSource(iconSpec: string): string | undefined {
    if (iconSpec.startsWith(IconSpecUtilities.WEB_COMPONENT_PREFIX) && iconSpec.length > 7) {
      return iconSpec.slice(7);
    }

    return undefined;

  }
}
