/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { ClientRequestContext } from "@bentley/bentleyjs-core";
import { Angle } from "@bentley/geometry-core";
import { Cartographic } from "@bentley/imodeljs-common";
import { request, RequestOptions, Response } from "@bentley/itwin-client";
import { IModelApp } from "./IModelApp";
import { GlobalLocation } from "./ViewGlobalLocation";

/** @internal */
export class BingLocationProvider {
  private _locationRequestTemplate: string;
  // private _localCircularSearchRequestTemplate: string;
  protected _requestContext = new ClientRequestContext("");

  constructor() {
    let bingKey = "";
    if (IModelApp.mapLayerFormatRegistry.configOptions.BingMaps) {
      bingKey = IModelApp.mapLayerFormatRegistry.configOptions.BingMaps.value;
    }
    this._locationRequestTemplate = "https://dev.virtualearth.net/REST/v1/Locations?query={query}&key={BingMapsAPIKey}".replace("{BingMapsAPIKey}", bingKey);
    // this._localCircularSearchRequestTemplate = "https://dev.virtualearth.net/REST/v1/LocalSearch/?CircularMapView={{circle}}&key={BingMapsAPIKey}".replace("{BingMapsAPIKey}", bingKey);
  }
  public async getLocation(query: string): Promise<GlobalLocation | undefined> {
    const requestUrl = this._locationRequestTemplate.replace("{query}", query);
    const requestOptions: RequestOptions = { method: "GET", responseType: "json" };
    try {
      const locationResponse: Response = await request(this._requestContext, requestUrl, requestOptions);
      const point = locationResponse.body.resourceSets[0].resources[0].point;
      const bbox = locationResponse.body.resourceSets[0].resources[0].bbox;
      const southLatitude = bbox[0];
      const westLongitude = bbox[1];
      const northLatitude = bbox[2];
      const eastLongitude = bbox[3];
      return {
        center: Cartographic.fromRadians(Angle.degreesToRadians(point.coordinates[1]), Angle.degreesToRadians(point.coordinates[0])),
        area: {
          southwest: Cartographic.fromRadians(Angle.degreesToRadians(westLongitude), Angle.degreesToRadians(southLatitude)),
          northeast: Cartographic.fromRadians(Angle.degreesToRadians(eastLongitude), Angle.degreesToRadians(northLatitude)),
        },
      };
    } catch (error) {
      return undefined;
    }
  }
  public async doLocalSearchByRadius(_center: Cartographic, _radius: number) {
    // const searchCircle = (center.latitude * Angle.degreesPerRadian) + "," + (center.longitude * Angle.degreesPerRadian) + "," + radius;
    // const requestUrl = this._localCircularSearchRequestTemplate.replace("{circle}", searchCircle);
    // const requestOptions: RequestOptions = { method: "GET", responseType: "json" };
    try {
      // const locationResponse: Response = await request(this._requestContext, requestUrl, requestOptions);
      return {};

    } catch (error) {
      return undefined;
    }
  }
}
