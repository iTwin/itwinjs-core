/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, BeEvent } from "@bentley/bentleyjs-core";
import { ArcGisOAuth2Token } from "../../imodeljs-frontend";
import { ArcGisTokenManager, ArcGisUtilities, MapLayerTokenEndpoint} from "../internal";

/** @beta */
export enum EsriOAuth2EndpointType {Authorize,Token}

/** @beta */
export class EsriOAuth2Endpoint implements MapLayerTokenEndpoint {
  private _url: string;
  private _isArcgisOnline: boolean;
  constructor(url: string, isArcgisOnline: boolean) {
    this._url = url;
    this._isArcgisOnline = isArcgisOnline;
  }

  // Returns the actual endpoint url
  public getUrl() {
    return this._url;
  }

  // Returns the URL used to login and generate the Oauth token.
  public getLoginUrl(stateData?: string) {
    const urlObj = new URL(this._url);

    // Set the client id
    if (this._isArcgisOnline) {
      urlObj.searchParams.set("client_id", EsriOAuth2.arcGisOnlineClientId);
    } else {
      const appId = EsriOAuth2.getMatchingEnterpriseAppId(this._url);
      assert(appId !== undefined);
      if (undefined !== appId) {
        urlObj.searchParams.set("client_id", appId);
      }
    }

    urlObj.searchParams.set("response_type", "token");
    if (EsriOAuth2.expiration !== undefined) {
      urlObj.searchParams.set("expiration", `${EsriOAuth2.expiration}`);
    }

    urlObj.searchParams.set("redirect_uri", EsriOAuth2.redirectUri);

    if (stateData !== undefined)
      urlObj.searchParams.set("state", stateData);

    return urlObj.toString();
  }

  public get isArcgisOnline() {return this._isArcgisOnline;}

}

/** @beta */
export class EsriOAuth2 {
  public static readonly  onEsriOAuth2Callback = new BeEvent();
  private static _redirectUri: string;
  private static _expiration: number|undefined;
  private static _arcGisOnlineClientId: string;
  private static _arcGisEnterpriseClientIds: {serviceBaseUrl: string, appId: string}[];

  /** Initialize ESRI OAuth2
   * @param redirectUri URI where the user is going redirected with the token
   * @param arcGisOnlineClientId Application ID that should be used to access ArcGIS Online
   * @param arcgisEnterpriseClientIds A dictionary of Application ID for each ArcGIS Enterprise service that Oauth2 should be supported
   * @param tokenExpiration Optional expiration after which the token will expire, defined in minutes.  The default value is 2 hours (120 minutes). The maximum value is two weeks (20160 minutes).
   * @returns true if the initialized was successful otherwise false.
   */
  public static initialize(redirectUri: string, arcGisOnlineClientId?: string, arcGisEnterpriseClientIds?: {serviceBaseUrl: string, appId: string}[], tokenExpiration?: number): boolean {
    EsriOAuth2._redirectUri = redirectUri;
    if (arcGisEnterpriseClientIds)
      EsriOAuth2._arcGisEnterpriseClientIds = arcGisEnterpriseClientIds;

    // arcGisOnlineClientId is actually mandatory might become optional in the future.
    if (arcGisOnlineClientId === undefined) {
      return false;
    }
    EsriOAuth2._arcGisOnlineClientId = arcGisOnlineClientId;
    EsriOAuth2._expiration = tokenExpiration;

    /** Define a *global* callback function that will be used by the redirect URL to pass the generated token
   * @param redirectLocation Unmodified value of 'window.location' from the redirect_uri page.
   */
    (window as any).esriOAuth2Callback = (redirectLocation?: Location) => {
      let eventSuccess = false;
      let decodedState;

      if (redirectLocation && redirectLocation.hash.length > 0) {
        const locationHash = redirectLocation.hash;
        const hashParams = new URLSearchParams(locationHash.substr(1));
        const token = hashParams.get("access_token") ?? undefined;
        const expiresInStr = hashParams.get("expires_in") ?? undefined;
        const userName = hashParams.get("username") ?? undefined;
        const ssl = hashParams.get("ssl") === "true";
        const state = hashParams.get("state") ?? undefined;
        const persist = hashParams.get("persist") === "true";
        if ( token !== undefined && expiresInStr !== undefined && userName !== undefined && ssl !== undefined && state !== undefined) {
          decodedState = decodeURIComponent(state);
          const stateUrl = new URL(decodedState);
          const expiresIn = Number(expiresInStr);
          const expiresAt = (expiresIn * 1000) + (+new Date());   // Converts the token expiration delay (seconds) into a timestamp (UNIX time)
          ArcGisTokenManager.setOAuth2Token(stateUrl.origin, {token, expiresAt, ssl, userName, persist});
          eventSuccess = true;
        }
      }
      this.onEsriOAuth2Callback.raiseEvent(eventSuccess, decodedState);
    };

    return true;
  }

  public static async getOAuthTokenForMapLayerUrl(mapLayerUrl: string): Promise<ArcGisOAuth2Token|undefined> {
    try {
      const oauthEndpoint = await ArcGisUtilities.getOAuth2EndpointFromMapLayerUrl(mapLayerUrl, EsriOAuth2EndpointType.Authorize);
      if (oauthEndpoint !== undefined) {
        const oauthEndpointUrl = new URL(oauthEndpoint.getUrl());
        return ArcGisTokenManager.getOAuth2Token(oauthEndpointUrl.origin);
      }
    } catch {}
    return undefined;
  }

  public static get redirectUri() {
    return EsriOAuth2._redirectUri;
  }

  public static getMatchingEnterpriseAppId(url: string) {
    let appId: string|undefined;
    for (const entry of EsriOAuth2.arcGisEnterpriseClientIds) {
      if (url.toLowerCase().startsWith(entry.serviceBaseUrl)) {
        appId = entry.appId;
      }
    }
    return appId;
  }

  public static get expiration() {
    return EsriOAuth2._expiration;
  }

  public static get arcGisOnlineClientId() {
    return EsriOAuth2._arcGisOnlineClientId;
  }

  public static get arcGisEnterpriseClientIds() {
    return EsriOAuth2._arcGisEnterpriseClientIds;
  }

}
