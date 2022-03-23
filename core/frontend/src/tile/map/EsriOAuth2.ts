/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, BeEvent } from "@itwin/core-bentley";
import { ArcGisOAuth2Token, ArcGisTokenManager, ArcGisUtilities, MapLayerTokenEndpoint} from "../internal";

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
      const clientId = EsriOAuth2.arcGisOnlineClientId;
      assert(clientId !== undefined);
      if (clientId !== undefined) {
        urlObj.searchParams.set("client_id", clientId);
      }

    } else {
      const clientId = EsriOAuth2.getMatchingEnterpriseClientId(this._url);
      assert(clientId !== undefined);
      if (undefined !== clientId) {
        urlObj.searchParams.set("client_id", clientId);
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
export interface ArcGisEnterpriseClientId {
  serviceBaseUrl: string;
  clientId: string;
}
/** @beta */
export interface EsriOAuthClientIds {
  arcgisOnlineClientId?: string;
  enterpriseClientIds?: ArcGisEnterpriseClientId[];
}
/** @beta */
export class EsriOAuth2 {
  public static readonly  onEsriOAuth2Callback = new BeEvent();
  private static _redirectUri: string;
  private static _expiration: number|undefined;
  private static _clientIds: EsriOAuthClientIds|undefined;

  /** Initialize ESRI OAuth2
   * @param redirectUri URI where the user is going redirected with the token
   * @param clientIds List of clients ids to use to get Oauth authorization
   * @param tokenExpiration Optional expiration after which the token will expire, defined in minutes.  The default value is 2 hours (120 minutes). The maximum value is two weeks (20160 minutes).
   * @returns true if the initialized was successful otherwise false.
   */
  public static initialize(redirectUri: string, tokenExpiration?: number): boolean {
    EsriOAuth2._redirectUri = redirectUri;
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

  /** @internal */
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

  public static getMatchingEnterpriseClientId(url: string) {
    let clientId: string|undefined;
    const clientIds = EsriOAuth2.arcGisEnterpriseClientIds;
    if (!clientIds) {
      return undefined;
    }
    for (const entry of clientIds) {
      if (url.toLowerCase().startsWith(entry.serviceBaseUrl)) {
        clientId = entry.clientId;
      }
    }
    return clientId;
  }

  public static get expiration() {
    return EsriOAuth2._expiration;
  }

  public static get arcGisOnlineClientId() {
    return EsriOAuth2._clientIds?.arcgisOnlineClientId;
  }

  public static set arcGisOnlineClientId(clientId: string|undefined) {
    if (EsriOAuth2._clientIds === undefined) {
      EsriOAuth2._clientIds  = {arcgisOnlineClientId: clientId };
    }
    EsriOAuth2._clientIds.arcgisOnlineClientId = clientId;
  }

  public static get arcGisEnterpriseClientIds() {
    return EsriOAuth2._clientIds?.enterpriseClientIds;
  }

  public static setEnterpriseClientId(serviceBaseUrl: string, clientId: string) {

    if (EsriOAuth2._clientIds?.enterpriseClientIds) {
      const foundIdx = EsriOAuth2._clientIds.enterpriseClientIds.findIndex((entry)=>entry.serviceBaseUrl === serviceBaseUrl);
      if (foundIdx !== -1) {
        EsriOAuth2._clientIds.enterpriseClientIds[foundIdx].clientId = clientId;
      } else {
        EsriOAuth2._clientIds.enterpriseClientIds.push({serviceBaseUrl, clientId});
      }
    } else {
      if (EsriOAuth2._clientIds === undefined) {
        EsriOAuth2._clientIds  = {};
      }
      EsriOAuth2._clientIds.enterpriseClientIds = [{serviceBaseUrl, clientId}];
    }
  }

  public static removeEnterpriseClientId(clientId: ArcGisEnterpriseClientId) {

    if (EsriOAuth2._clientIds?.enterpriseClientIds) {
      EsriOAuth2._clientIds.enterpriseClientIds = EsriOAuth2._clientIds?.enterpriseClientIds?.filter((item) => item.serviceBaseUrl !== clientId.serviceBaseUrl);
    }

  }
}
