/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Angle, Constant } from "@itwin/core-geometry";

/** @internal */
export class WebMercator {

  // calculates the longitude in EPSG:4326 (WGS84) from the projected x cartesian coordinate in EPSG:3857
  public static getEPSG4326Lon(x3857: number): number {
    return Angle.radiansToDegrees(x3857/Constant.earthRadiusWGS84.equator);
  }

  // calculates the latitude in EPSG:4326 (WGS84) from the projected y cartesian coordinate in EPSG:3857
  public static getEPSG4326Lat(y3857: number): number {
    const y = 2 * Math.atan(Math.exp(y3857 / Constant.earthRadiusWGS84.equator)) - (Math.PI/2);
    return Angle.radiansToDegrees(y);
  }
}
