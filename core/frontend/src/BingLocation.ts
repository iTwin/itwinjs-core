/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { Cartographic } from "@itwin/core-common";
import { request, RequestOptions, Response } from "@bentley/itwin-client";
import { IModelApp } from "./IModelApp";
import { GlobalLocation } from "./ViewGlobalLocation";

/** Provides an interface to the [Bing Maps location services](https://docs.microsoft.com/en-us/bingmaps/rest-services/locations/).
 * @public
 */
export class BingLocationProvider {
  private _locationRequestTemplate: string;

  constructor() {
    let bingKey = "";
    if (IModelApp.mapLayerFormatRegistry.configOptions.BingMaps) {
      bingKey = IModelApp.mapLayerFormatRegistry.configOptions.BingMaps.value;
    }
    this._locationRequestTemplate = "https://dev.virtualearth.net/REST/v1/Locations?query={query}&key={BingMapsAPIKey}".replace("{BingMapsAPIKey}", bingKey);
  }
  /** Return the location of a query (or undefined if not found). The strings "Space Needle" (a landmark) and "1 Microsoft Way Redmond WA" (an address) are examples of query strings with location information.
   * These strings can be specified as a structured URL parameter or as a query parameter value.  See [Bing Location Services documentation](https://docs.microsoft.com/en-us/bingmaps/rest-services/locations/find-a-location-by-query) for additional
   * information on queries.
   * @public
   */
  public async getLocation(query: string): Promise<GlobalLocation | undefined> {
    const requestUrl = this._locationRequestTemplate.replace("{query}", query);
    const requestOptions: RequestOptions = { method: "GET", responseType: "json" };
    try {
      const locationResponse: Response = await request(requestUrl, requestOptions);
      const point = locationResponse.body.resourceSets[0].resources[0].point;
      const bbox = locationResponse.body.resourceSets[0].resources[0].bbox;
      const southLatitude = bbox[0];
      const westLongitude = bbox[1];
      const northLatitude = bbox[2];
      const eastLongitude = bbox[3];
      return {
        center: Cartographic.fromDegrees({ longitude: point.coordinates[1], latitude: point.coordinates[0] }),
        area: {
          southwest: Cartographic.fromDegrees({ longitude: westLongitude, latitude: southLatitude }),
          northeast: Cartographic.fromDegrees({ longitude: eastLongitude, latitude: northLatitude }),
        },
      };
    } catch (error) {
      return undefined;
    }
  }
}
