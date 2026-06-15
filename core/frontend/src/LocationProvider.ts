/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { GlobalLocation } from "./ViewGlobalLocation";

/** Provides geocoding — converting a query string to a geographic location.
 * @public
 * @extensions
 */
export interface LocationProvider {
  /** Return the location for a query string, or undefined if not found. */
  getLocation(query: string): Promise<GlobalLocation | undefined>;
}
