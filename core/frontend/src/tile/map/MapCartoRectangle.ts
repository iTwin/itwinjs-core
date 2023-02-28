/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { Angle, Point2d, Range2d } from "@itwin/core-geometry";
import { Cartographic, CartographicRectangle } from "@itwin/core-common";
import { GlobalLocation, GlobalLocationArea } from "../../ViewGlobalLocation";
import { MapTilingScheme } from "../internal";

const scratchMercatorFractionRange = Range2d.createNull();
const scratchPoint2d = Point2d.createZero();

export { CartographicRectangle as MapCartoRectangle };

/** @internal */
export function getTileFractionRange(rect: CartographicRectangle, tilingScheme: MapTilingScheme) {
  scratchMercatorFractionRange.low.x = tilingScheme.longitudeToXFraction(rect.low.x);
  scratchMercatorFractionRange.high.x = tilingScheme.longitudeToXFraction(rect.high.x);
  scratchMercatorFractionRange.low.y = tilingScheme.latitudeToYFraction(rect.low.y);
  scratchMercatorFractionRange.high.y = tilingScheme.latitudeToYFraction(rect.high.y);

  return scratchMercatorFractionRange;
}
