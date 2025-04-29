/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module MapLayersFormats
 */

import { Logger } from "@itwin/core-bentley";
import { MapCartoRectangle } from "@itwin/core-frontend";
import { QuadIdProps } from "@itwin/core-frontend/lib/cjs/tile/internal.js";
import { BaseGoogleMapsSession, GoogleMapsCreateSessionOptions, GoogleMapsSession, GoogleMapsSessionData, GoogleMapsSessionManager } from "./GoogleMapsSession.js";

const loggerCategory = "MapLayersFormats.GoogleMaps";

/*
* Google Maps session
* @internal
*/
export class NativeGoogleMapsSession extends BaseGoogleMapsSession {
  public static getTileApiBaseUrl = "https://tile.googleapis.com/v1/2dtiles";
  public static viewportApiBaseUrl = `https://tile.googleapis.com/tile/v1/viewport`
  public readonly json: GoogleMapsSessionData;
  public readonly apiKey: string;

  public constructor(json: GoogleMapsSessionData, apiKey: string) {
    super();
    this.json = json;
    this.apiKey = apiKey;
  }

  protected getTileApiBaseUrl() {
    return NativeGoogleMapsSession.getTileApiBaseUrl;
  }

  public getTileSize(): number {
      return this.json.tileWidth;
  }

  public getTileUrl(position: QuadIdProps): URL {
    const url = this.getTilePositionUrl(position);
    url.searchParams.append("key", this.apiKey);
    url.searchParams.append("session", this.json.session);
    return url;
  }

  public getViewportInfoUrl (rectangle: MapCartoRectangle, zoomLevel: number): URL {
    const degrees = rectangle.toDegrees();
    const obj = new URL(
      `${this.getTileApiBaseUrl()}\
      zoom=${zoomLevel}\
      &north=${degrees.north}&south=${degrees.south}&east=${degrees.east}&west=${degrees.west}`
    );
    obj.searchParams.append("key", this.apiKey);
    obj.searchParams.append("session", this.json.session);
    return obj;
  }

    /**
     * Creates a Google Maps session.
     * @param apiKey Google Cloud API key
     * @param opts Options to create the session
     * @internal
    */
    public static async create (apiKey: string, opts: GoogleMapsCreateSessionOptions): Promise<GoogleMapsSessionData>  {
      const url = `https://tile.googleapis.com/v1/createSession?key=${apiKey}`;
      const request = new Request(url, {method: "POST", body: JSON.stringify(opts)});
      const response = await fetch (request);
      if (!response.ok) {
        throw new Error(`CreateSession request failed: ${response.status} - ${response.statusText}`);
      }
      Logger.logInfo(loggerCategory, `Session created successfully`);
      return response.json();
    }
}

/*
* Google Maps session manager that uses standard API key to create a session.
* @beta
*/
export class NativeGoogleMapsSessionManager extends GoogleMapsSessionManager {
  public readonly apiKey: string;

  constructor(apiKey: string) {
    super();
    this.apiKey = apiKey;
  }

  public async createSession(sessionOptions: GoogleMapsCreateSessionOptions): Promise<GoogleMapsSession> {
    const json = await NativeGoogleMapsSession.create(this.apiKey, sessionOptions);
    return new NativeGoogleMapsSession(json, this.apiKey);
  }

}
