/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { Cartographic } from "@itwin/core-common";
import { request } from "./request/Request";
import { IModelApp } from "./IModelApp";
import { GlobalLocation } from "./ViewGlobalLocation";

/** Provides an interface to the [Azure Maps Geocoding services](https://learn.microsoft.com/en-us/rest/api/maps/search/get-geocoding).
 * @public
 * @extensions
 */
export class AzureLocationProvider {
  private _locationRequestTemplate: string;

  constructor() {
    let azureMapKey = "";
    if (IModelApp.mapLayerFormatRegistry.configOptions.AzureMaps) {
      azureMapKey = IModelApp.mapLayerFormatRegistry.configOptions.AzureMaps.value;
    }
    this._locationRequestTemplate = `https://atlas.microsoft.com/geocode?api-version=2023-06-01&query={query}&subscription-key=${azureMapKey}`;
  }
  /** Return the location of a query (or undefined if not found). The strings "Space Needle" (a landmark) and "1 Microsoft Way Redmond WA" (an address) are examples of query strings with location information.
   * These strings can be specified as a structured URL parameter or as a query parameter value.  See [Azure Maps Search - Geocoding documentation](https://learn.microsoft.com/en-us/rest/api/maps/search/get-geocoding) for additional
   * information on queries.
   * @public
   */
  public async getLocation(query: string): Promise<GlobalLocation | undefined> {
    const requestUrl = this._locationRequestTemplate.replace("{query}", query);
    try {
      const locationResponse = await request(requestUrl, "json");
      const geometry = locationResponse.features[0].geometry;
      const bbox = locationResponse.features[0].bbox;
      const westLongitude = bbox[0];
      const southLatitude = bbox[1];
      const eastLongitude = bbox[2];
      const northLatitude = bbox[3];
      return {
        center: Cartographic.fromDegrees({ longitude: geometry.coordinates[0], latitude: geometry.coordinates[1] }),
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
