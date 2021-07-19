/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, BeEvent } from "@bentley/bentleyjs-core";
import { ArcGisOAuth2Token } from "../../imodeljs-frontend";
import { ArcGisTokenManager, ArcGisUtilities, MapLayerTokenEndpoint} from "../internal";

/** @internal */
export enum EsriOAuth2EndpointType {Authorize,Token}

/** @internal */
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
   * @param tokenExpiration Optional expiration after which the token will expire. Defined in minutes with a maximum of two weeks (20160 minutes).
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
   * @param success A binary value that, if true, implies the login process was successful.
   * @param token Generated access token
   * @param expiresIn Token expiration in seconds from now.
   * @param ssl A binary value that, if true, implies that the user belongs to an SSL-only organization
   * @param state An opaque value used by applications to maintain state between authorization requests and responses.
   * @param persist A binary value that, if true, implies that the user had checked "Keep me signed in" when signing.
   */
    (window as any).esriOAuth2Callback = (success: boolean, token?: string, expiresIn?: number, userName?: string, ssl?: boolean, state?: string, persist?: boolean) => {
      let decodedState;
      let eventSuccess = success;
      if (success) {
        if ( token !== undefined && expiresIn !== undefined && userName !== undefined && ssl !== undefined && state !== undefined) {
          decodedState = decodeURIComponent(state);
          const stateUrl = new URL(decodedState);
          const expiresAt = (expiresIn * 1000) + (+new Date());
          ArcGisTokenManager.setOAuth2Token(stateUrl.origin, {token, expiresAt, ssl, userName, persist});
        } else {
          eventSuccess = false;
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
