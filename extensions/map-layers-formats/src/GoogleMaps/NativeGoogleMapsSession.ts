/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module MapLayersFormats
 */

import { MapCartoRectangle } from "@itwin/core-frontend";
import { GoogleMapsUtils } from "../internal/GoogleMapsUtils.js";
import { GoogleMapsCreateSessionOptions, GoogleMapsSession, GoogleMapsSessionData, GoogleMapsSessionManager } from "./GoogleMaps.js";

const templateTokens = {
  level: "{level}",
  row: "{row}",
  column: "{column}",
}



/*
* Google Maps session
* @internal
*/
export class NativeGoogleMapsSession implements GoogleMapsSession {
  public static tileUrlTemplate = `https://tile.googleapis.com/v1/2dtiles/${templateTokens.level}/${templateTokens.column}/${templateTokens.row}`;
  public static viewportBaseUrl = `https://tile.googleapis.com/tile/v1/viewport`
  public readonly json: GoogleMapsSessionData;
  public readonly apiKey: string;

  public constructor(json: GoogleMapsSessionData, apiKey: string) {
    this.json = json;
    this.apiKey = apiKey;
  }

  public getTileSize(): number {
      return this.json.tileWidth;
  }

  public getTileUrl(row: number, column: number, level: number): URL {
      const tmpUrl = NativeGoogleMapsSession.tileUrlTemplate
        .replace(templateTokens.level, level.toString())
        .replace(templateTokens.column, column.toString())
        .replace(templateTokens.row, row.toString());

      const obj = new URL(tmpUrl);
      obj.searchParams.append("key", this.apiKey);
      obj.searchParams.append("session", this.json.session);
      return obj;
  }

  public getViewportInfoUrl (rectangle: MapCartoRectangle, zoomLevel: number): URL {
      const degrees = rectangle.toDegrees();
      const obj = new URL(
        `${NativeGoogleMapsSession.viewportBaseUrl}\
        zoom=${zoomLevel}\
        &north=${degrees.north}&south=${degrees.south}&east=${degrees.east}&west=${degrees.west}`
      );
      obj.searchParams.append("key", this.apiKey);
      obj.searchParams.append("session", this.json.session);
      return obj;
  }
}

/*
* Google Maps session manager that uses standard API key to create a session.
* @beta
*/
export class NativeGoogleMapsSessionManager implements GoogleMapsSessionManager {
  public readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  public async createSession(sessionOptions: GoogleMapsCreateSessionOptions): Promise<GoogleMapsSession> {
    const json = await GoogleMapsUtils.createSession(this.apiKey, sessionOptions);
    return new NativeGoogleMapsSession(json, this.apiKey);
  }
}
