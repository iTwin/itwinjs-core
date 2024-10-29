/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Tiles
 */
import { request } from "../../request/Request";
import { IModelApp } from "../../IModelApp";
import { IModelConnection } from "../../IModelConnection";
import { Cartographic } from "@itwin/core-common";
import { Point3d, Range1d, Range2d } from "@itwin/core-geometry";

// cspell:ignore atae qdng uyzv auje sealevel

/** Provides an interface to the [Bing Maps elevation services](https://docs.microsoft.com/en-us/bingmaps/rest-services/elevations/).
 * Use of these services requires an API key to be supplied via [[MapLayerOptions.BingMaps]] in the [[IModelAppOptions.mapLayerOptions]]
 * passed to [[IModelApp.startup]].
 * @public
 * @extensions
 */
export class BingElevationProvider {
  private _heightRangeRequestTemplate: string;
  private _seaLevelOffsetRequestTemplate: string;
  private _heightListRequestTemplate: string;

  /** @public */
  constructor() {
    let bingKey = "";
    if (IModelApp.mapLayerFormatRegistry.configOptions.BingMaps)
      bingKey = IModelApp.mapLayerFormatRegistry.configOptions.BingMaps.value;

    this._heightRangeRequestTemplate =
      "https://dev.virtualearth.net/REST/v1/Elevation/Bounds?bounds={boundingBox}&rows=16&cols=16&heights=ellipsoid&key={BingMapsAPIKey}"
        .replace("{BingMapsAPIKey}", bingKey);
    this._seaLevelOffsetRequestTemplate =
      "https://dev.virtualearth.net/REST/v1/Elevation/SeaLevel?points={points}&key={BingMapsAPIKey}"
        .replace("{BingMapsAPIKey}", bingKey);
    this._heightListRequestTemplate =
      "https://dev.virtualearth.net/REST/v1/Elevation/List?points={points}&heights={heights}&key={BingMapsAPIKey}"
        .replace("{BingMapsAPIKey}", bingKey);
  }

  /** Return the height (altitude) at a given cartographic location.
   * If geodetic is true (the default) then height is returned in the Ellipsoidal WGS84 datum.  If geodetic is false then the sea level height id returned using the Earth Gravitational Model 2008 (EGM2008 2.5’).
   * @public
   */
  public async getHeight(carto: Cartographic, geodetic = true) {
    if (undefined === carto)
      return 0.0;

    const requestUrl =
      this._heightListRequestTemplate
        .replace("{points}", `${carto.latitudeDegrees},${carto.longitudeDegrees}`)
        .replace("{heights}", geodetic ? "ellipsoid" : "sealevel");

    try {
      const tileResponseBody = await request(requestUrl, "json");
      return tileResponseBody.resourceSets[0].resources[0].elevations[0];
    } catch {
      return 0.0;
    }
  }

  /** Returns 256 elevations in the specified range - 16 rows and 16 columns.
   * The elevations are ordered starting with the southwest corner, then proceeding west to east and south to north.
   * @beta
   */
  public async getHeights(range: Range2d): Promise<number[] | undefined> {
    const boundingBox = `${range.low.y},${range.low.x},${range.high.y},${range.high.x}`;
    const requestUrl = this._heightRangeRequestTemplate.replace("{boundingBox}", boundingBox);

    try {
      const tileResponseBody = await request(requestUrl, "json");
      return tileResponseBody.resourceSets[0].resources[0].elevations;
    } catch {
      return undefined;
    }
  }

  /** @internal */
  public async getGeodeticToSeaLevelOffset(point: Point3d, iModel: IModelConnection): Promise<number> {
    const carto = iModel.spatialToCartographicFromEcef(point);
    if (carto === undefined)
      return 0.0;

    const requestUrl = this._seaLevelOffsetRequestTemplate.replace("{points}", `${carto.latitudeDegrees},${carto.longitudeDegrees}`);
    try {
      const tileResponseBody = await request(requestUrl, "json");
      return tileResponseBody.resourceSets[0].resources[0].offsets[0];
    } catch {
      return 0.0;
    }
  }
  /** Get the height (altitude) at a given iModel coordinate.  The height is geodetic (WGS84 ellipsoid)
   * If geodetic is true (the default) then height is returned in the Ellipsoidal WGS84 datum.  If geodetic is false then sea level height is returned using the Earth Gravitational Model 2008 (EGM2008 2.5’).
   *
   * @public
   */
  public async getHeightValue(point: Point3d, iModel: IModelConnection, geodetic = true): Promise<number> {
    return this.getHeight(iModel.spatialToCartographicFromEcef(point), geodetic);
  }

  /** Get the height (altitude) range for a given iModel project extents. The height values are  geodetic (WGS84 ellipsoid).
   * @public
   */
  public async getHeightRange(iModel: IModelConnection) {
    const latLongRange = Range2d.createNull();
    const range = iModel.projectExtents.clone();

    // Expand for project surroundings.
    range.expandInPlace(1000);
    for (const corner of range.corners()) {
      const carto = iModel.spatialToCartographicFromEcef(corner);
      latLongRange.extendXY(carto.longitudeDegrees, carto.latitudeDegrees);
    }

    const heights = await this.getHeights(latLongRange);
    return heights ? Range1d.createArray(heights) : Range1d.createNull();
  }

  /** Get the average height (altitude) for a given iModel project extents.  The height values are geodetic (WGS84 ellipsoid).
   * @public
   */
  public async getHeightAverage(iModel: IModelConnection) {
    const latLongRange = Range2d.createNull();
    for (const corner of iModel.projectExtents.corners()) {
      const carto = iModel.spatialToCartographicFromEcef(corner);
      latLongRange.extendXY(carto.longitudeDegrees, carto.latitudeDegrees);
    }

    const heights = await this.getHeights(latLongRange);
    if (!heights || !heights.length)
      return 0;

    let total = 0.0;
    for (const height of heights)
      total += height;

    return total / heights.length;
  }
}
