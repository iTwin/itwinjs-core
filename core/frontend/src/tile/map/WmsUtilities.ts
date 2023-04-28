/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Tiles
 */

/** @internal */
export class WmsUtilities {
  public static getBaseUrl(url: string): string {
    const lastIndex = url.lastIndexOf("?");
    return lastIndex > 0 ? url.slice(0, lastIndex) : url;
  }
}
