/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelApp, MapCartoRectangle } from "@itwin/core-frontend";
import { QuadIdProps } from "@itwin/core-frontend/lib/cjs/tile/internal";
import { BaseGoogleMapsSession, GoogleMapsCreateSessionOptions, GoogleMapsRequest, GoogleMapsSessionClient, GoogleMapsSessionManager } from "@itwin/map-layers-formats";

const googleCuratedContentApiUrl = `https://api.bentley.com/curated-content/google/map-tiles/2d`;


export interface CuratedGoogleMapsSessionData {
  type: string;
  viewportBaseUrl: string;
  tileBaseUrl: string;
  accessToken: string;
  sessionToken: string;

  // Missing ???
  // tileWidth: number
  // tileHeight: number
  }

export class CuratedGoogleMapsSession extends BaseGoogleMapsSession {
  public readonly data: CuratedGoogleMapsSessionData;

  public constructor(data: CuratedGoogleMapsSessionData) {
    super();
    this.data = data;
  }

  public getTileSize(): number {
      return 256; // TODO: use json.tileWidth when available
  }

  protected getTileApiBaseUrl() {
    return this.data.tileBaseUrl;
  }

  public getTileRequest(position: QuadIdProps): GoogleMapsRequest {
    const url = this.getTilePositionUrl(position);
    url.searchParams.append("session", this.data.sessionToken);
    return {url, authorization: `Bearer ${this.data.accessToken}`};
  }

  public getViewportInfoRequest (rectangle: MapCartoRectangle, zoomLevel: number): GoogleMapsRequest {
      const degrees = rectangle.toDegrees();
      const url = new URL(this.data.viewportBaseUrl);
      url.searchParams.append("zoom", `${zoomLevel}`);
      url.searchParams.append("north", `${degrees.north}`);
      url.searchParams.append("south", `${degrees.south}`);
      url.searchParams.append("east", `${degrees.east}`);
      url.searchParams.append("west", `${degrees.west}`);
      url.searchParams.append("session", this.data.sessionToken);
      return {url, authorization: `Bearer ${this.data.accessToken}`};
  }
}

export class CuratedGoogleMapsSessionManager extends GoogleMapsSessionManager {
  public async createSession(sessionOptions: GoogleMapsCreateSessionOptions) {
    const data = await this.create(sessionOptions);
    return new CuratedGoogleMapsSession(data);
  }

  private async create(opts: GoogleMapsCreateSessionOptions) : Promise<CuratedGoogleMapsSessionData> {
    // Assuming the access token is already set in the IModelApp ???
    const accessToken = await IModelApp.getAccessToken();
    const request = new Request(googleCuratedContentApiUrl, {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      headers: { Authorization: `Bearer ${accessToken}` },
      method: "POST",
      body: JSON.stringify(opts)
    });
    const response = await fetch (request);
    if (!response.ok) {
      throw new Error(`CreateSession request failed: ${response.status} - ${response.statusText}`);
    }
    return response.json() as Promise<CuratedGoogleMapsSessionData>;
  }
}

export class CuratedGoogleMapsClient extends GoogleMapsSessionClient {
  public getSessionManager(): GoogleMapsSessionManager {
    return new CuratedGoogleMapsSessionManager();
  }
}