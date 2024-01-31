/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { ImageMapLayerSettings } from "@itwin/core-common";
import { ArcGisErrorCode, ArcGISServiceMetadata, ArcGisUtilities, MapLayerAccessClient, MapLayerAccessToken, MapLayerImageryProvider, MapLayerImageryProviderStatus } from "../../internal";
import { IModelApp } from "../../../IModelApp";
import { NotifyMessageDetails, OutputMessagePriority } from "../../../NotificationManager";
import { headersIncludeAuthMethod } from "../../../request/utils";

/** Base class for ArcGIS map-layer imagery providers.
 *
 * The initial purpose of this class is to offer shared methods
 * to query ArcGIS services and apply the appropriate security token.
 * @see [[ArcGISMapLayerImageryProvider]]
 * @internal
 */
export abstract class ArcGISImageryProvider extends MapLayerImageryProvider {

  protected _accessClient: MapLayerAccessClient|undefined;
  protected _lastAccessToken: MapLayerAccessToken|undefined;

  /** Flag indicating if access token should be added to request.
  * @note We assume a service to require access token for the entire viewing session.
  */
  protected _accessTokenRequired = false;

  protected _querySupported = false;

  public override get supportsMapFeatureInfo() { return this._querySupported;}

  constructor(settings: ImageMapLayerSettings, usesCachedTiles: boolean) {
    super(settings, usesCachedTiles);
    this._accessClient = IModelApp.mapLayerFormatRegistry?.getAccessClient(settings.formatId);
  }

  /** Updates the accessClient token state whenever the status of the provider change.
   *  @internal
   * */
  protected override onStatusUpdated(status: MapLayerImageryProviderStatus) {
    if (status === MapLayerImageryProviderStatus.RequireAuth) {

      // Invalidate the token, so a new one get generated
      if (this._accessClient?.invalidateToken !== undefined && this._lastAccessToken !== undefined) {
        this._accessClient.invalidateToken(this._lastAccessToken);
      }

      // Make sure we don't re-use this token again (i.e force login process)
      this._lastAccessToken = undefined;
    }
  }

  /**
   * Fetch an ArcGIS service metadata, and returns its JSON representation.
   * This wrapper maintains token state and should be used instead of the the ArcGisUtilities version.
  */
  protected async getServiceJson() {
    let metadata: ArcGISServiceMetadata|undefined;
    try {
      metadata = await ArcGisUtilities.getServiceJson({url: this._settings.url, formatId: this._settings.formatId, userName: this._settings.userName, password: this._settings.password, queryParams: this._settings.collectQueryParams()});

    } catch (_e) {
    }
    if (metadata && metadata.accessTokenRequired) {
      const accessClient = IModelApp.mapLayerFormatRegistry.getAccessClient(this._settings.formatId);
      if (accessClient) {
        try {
          // Keep track of last used access token, so we can invalidate it later when an errors occurs
          const accessToken = await accessClient.getAccessToken({mapLayerUrl: new URL(this._settings.url)});
          this._lastAccessToken = accessToken;
        } catch {
        }
      }
      // By turning this ON, tiles requests will include security token
      this._accessTokenRequired = metadata.accessTokenRequired;
    }
    return metadata;
  }

  /**
   * Make a request to an ArcGIS service using the provided URL and init parameters.
   * @param url URL to query
   * @param options Custom settings to apply to the request.
   * Refer to fetch API for more details (https://developer.mozilla.org/en-US/docs/Web/API/fetch)
   */
  protected async fetch(url: URL, options?: RequestInit) {

    let errorCode: number | undefined;
    const urlObj = new URL(url);
    const queryParams = this._settings.collectQueryParams();
    Object.keys(queryParams).forEach((paramKey) => {
      if (!urlObj.searchParams.has(paramKey))
        urlObj.searchParams.append(paramKey, queryParams[paramKey]);
    });

    if (this._accessTokenRequired && this._accessClient) {
      this._lastAccessToken = await ArcGisUtilities.appendSecurityToken(urlObj, this._accessClient, {
        mapLayerUrl: new URL(this._settings.url),
        userName: this._settings.userName,
        password: this._settings.password });
    }

    // We want to complete the first request before letting other requests go;
    // this done to avoid flooding server with requests missing credentials
    if (!this._firstRequestPromise)
      this._firstRequestPromise  = new Promise<void>((resolve: any) => this.onFirstRequestCompleted.addOnce(()=>resolve()));
    else
      await this._firstRequestPromise;

    let response: Response|undefined;
    try {
      response = await fetch(urlObj.toString(), {...options, credentials: this._includeUserCredentials ?  "include" : undefined});

      if (response.status === 401 && !this._lastAccessToken && headersIncludeAuthMethod(response.headers, ["ntlm", "negotiate"])) {
      // We got a http 401 challenge, lets try again with SSO enabled (i.e. Windows Authentication)
        response = await fetch(url, {...options, credentials: "include" });
        if (response.status === 200) {
          this._includeUserCredentials = true;    // avoid going through 401 challenges over and over
        }
      }

      if ((this._lastAccessToken && response.status === 400)
       || response.headers.get("content-type")?.toLowerCase().includes("htm")) {
      // For some reasons when we make a request with the fetch() api and there is a token error
      // we receive a status 400 instead of proper json response. (i.e doing the same request in the browser gives a different response)
      // For some other request, we also seen error message  in html.
      // When it occurs, we fall back to root service request so we get a proper JSON response with error code.
        const tmpUrl = new URL(this._settings.url);
        if (this._lastAccessToken && this._accessTokenRequired)
          tmpUrl.searchParams.append("token", this._lastAccessToken.token);
        tmpUrl.searchParams.append("f","json");
        response = await  fetch(tmpUrl.toString(), options);
      }

      errorCode = await ArcGisUtilities.checkForResponseErrorCode(response);

      if (errorCode !== undefined &&
       (errorCode === ArcGisErrorCode.TokenRequired || errorCode === ArcGisErrorCode.InvalidToken) ) {

        if (this._settings.userName && this._settings.userName.length > 0 && this._lastAccessToken ) {
        // **** Legacy token ONLY ***

          // Token might have expired, make a second attempt by forcing new token.
          if (this._accessClient?.invalidateToken !== undefined && this._lastAccessToken !== undefined)
            this._accessClient.invalidateToken(this._lastAccessToken);

          const urlObj2 = new URL(url);
          if (this._accessClient) {
            try {
              this._lastAccessToken = await ArcGisUtilities.appendSecurityToken(urlObj, this._accessClient, {mapLayerUrl: urlObj, userName: this._settings.userName, password: this._settings.password });
            } catch {
            }
          }

          // Make a second attempt with refreshed token
          response = await fetch(urlObj2.toString(), options);
          errorCode  = await ArcGisUtilities.checkForResponseErrorCode(response);
        }

        if (errorCode === ArcGisErrorCode.TokenRequired || errorCode === ArcGisErrorCode.InvalidToken) {
          // Looks like the initially generated token has expired.

          if (this.status === MapLayerImageryProviderStatus.Valid ) {
            // Only report new status change to avoid spamming the UI
            this.setStatus(MapLayerImageryProviderStatus.RequireAuth);
            this.onStatusChanged.raiseEvent(this);
            const msg = IModelApp.localization.getLocalizedString("iModelJs:MapLayers.Messages.FetchTooltipTokenError", { layerName: this._settings.name });
            IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Warning, msg));
          }
        }
      }
    } finally {
      this.onFirstRequestCompleted.raiseEvent();
    }

    if (response === undefined)
      throw new Error("fetch call failed");

    return response;
  }
}
