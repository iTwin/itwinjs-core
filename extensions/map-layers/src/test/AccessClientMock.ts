/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BeEvent, Listener } from "@itwin/core-bentley";
import {  MapLayerAccessClient, MapLayerAccessToken, MapLayerAccessTokenParams,  MapLayerTokenEndpoint } from "@itwin/core-frontend";

export class TokenEndpointMock implements MapLayerTokenEndpoint {
  public static readonly url = "https://fake.com/server/auth";
  public static readonly loginUrl = "https://fake.com/server/login";
  public getUrl(): string {
    return TokenEndpointMock.url;
  }

  public getLoginUrl(_stateData?: string): string | undefined {
    return TokenEndpointMock.loginUrl;
  }
}

export class AccessClientMock implements MapLayerAccessClient {
  public async getAccessToken(_params: MapLayerAccessTokenParams): Promise<MapLayerAccessToken | undefined> {
    return Promise.resolve({token: "fakeToken"});
  }

  public async getTokenServiceEndPoint(_mapLayerUrl: string): Promise<MapLayerTokenEndpoint | undefined> {
    return Promise.resolve(new TokenEndpointMock());
  }

  // This is event is requiered to enable the Oauth popup opening in the UI
  public onOAuthProcessEnd = new BeEvent<Listener>();
}
