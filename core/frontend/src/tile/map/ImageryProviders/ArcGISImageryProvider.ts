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
  protected _accessTokenRequired = false;
  protected _invalidOAuthEndpoint = false;

  constructor(settings: ImageMapLayerSettings, usesCachedTiles: boolean) {
    super(settings, usesCachedTiles);
    this._accessClient = IModelApp.mapLayerFormatRegistry?.getAccessClient(settings.formatId);
  }

  /** @internal */
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

  /** @internal */
  protected async getServiceJson() {
    let metadata: ArcGISServiceMetadata|undefined;
    try {
      metadata = await ArcGisUtilities.getServiceJson(this._settings.url, this._settings.formatId, this._settings.userName, this._settings.password);

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

    if (this._accessTokenRequired && this._accessClient) {
      this._lastAccessToken = await ArcGisUtilities.appendSecurityToken(urlObj, this._accessClient, {
        mapLayerUrl: new URL(this._settings.url),
        userName: this._settings.userName,
        password: this._settings.password });
    }

    let response = await  fetch(urlObj.toString(), options);

    if (response.status === 400 && this._lastAccessToken) {
      // For some reasons when we make a request with the fetch() api and there is a token error
      // we receive a status 400 instead of proper json response. (i.e doing the same request in the browser gives a different response)
      // In that case, we fall back to the general service request so we get a proper JSON response with error code.
      const tmpUrl = new URL(this._settings.url);
      tmpUrl.searchParams.append("token", this._lastAccessToken.token);
      response = await  fetch(urlObj.toString(), options);
    }

    errorCode = await ArcGisUtilities.checkForResponseErrorCode(response.clone(), new URL(urlObj), options);

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
        errorCode  = await ArcGisUtilities.checkForResponseErrorCode(response.clone());
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
    return response;
  }
}
