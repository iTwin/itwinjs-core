/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { Cartographic } from "@itwin/core-common";

/** Provides geoid undulation — the offset between the geodetic ellipsoid (WGS84) and sea level (EGM2008).
 * @beta
 * @extensions
 */
// eslint-disable-next-line @itwin/public-extension-exports
export interface GeoidProvider {
  /** Return the offset from geodetic height to sea level height at the given cartographic location. */
  getGeodeticToSeaLevelOffset(carto: Cartographic): Promise<number>;
}
