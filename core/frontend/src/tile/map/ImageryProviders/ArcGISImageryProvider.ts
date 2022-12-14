/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

import { ImageMapLayerSettings } from "@itwin/core-common";
import { ArcGisErrorCode, ArcGisUtilities, MapLayerAccessClient, MapLayerAccessToken, MapLayerImageryProvider, MapLayerImageryProviderStatus } from "../../internal";
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
  private static _serviceCache = new Map<string, any>();

  constructor(settings: ImageMapLayerSettings, usesCachedTiles: boolean) {
    super(settings, usesCachedTiles);
    this._accessClient = IModelApp.mapLayerFormatRegistry?.getAccessClient(settings.formatId);
  }

  /**
   * Make a request to an ArcGIS service using the provided URL and init parameters.
   * @param url URL to query
   * @param options Custom settings to apply to the request.
   * Refer to fetch API for more details (https://developer.mozilla.org/en-US/docs/Web/API/fetch)
   */
  protected async fetch(url: URL, options?: RequestInit) {

    const urlObj = new URL(url);
    if (this._accessTokenRequired && this._accessClient) {
      // Only append token if we previously had a failure
      try {
        this._lastAccessToken = await ArcGisUtilities.appendSecurityToken(urlObj, this._accessClient, {
          mapLayerUrl: new URL(this._settings.url),
          userName: this._settings.userName,
          password: this._settings.password });

      } catch{

      }

    }

    let response = await fetch(urlObj.toString(), options);
    let errorCode  = await ArcGisUtilities.checkForResponseErrorCode(response.clone(), new URL(urlObj), options);

    if (errorCode !== undefined &&
       (errorCode === ArcGisErrorCode.TokenRequired || errorCode === ArcGisErrorCode.InvalidToken) ) {

      // **** Legacy token ONLY ***
      // Token might have expired, make a second attempt by forcing new token.
      if (this._settings.userName && this._settings.userName.length > 0 && this._lastAccessToken ) {

        // Invalidate previously used token to force token re-generation
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
        if (errorCode !== undefined && errorCode === ArcGisErrorCode.TokenRequired || errorCode === ArcGisErrorCode.InvalidToken) {
          // OK at this point, if response still contain a token error, we assume end-user will
          // have to provide credentials again.  Change the layer status so we
          // don't make additional invalid requests..
          if (this._accessClient?.invalidateToken !== undefined && this._lastAccessToken !== undefined) {
            this._accessClient.invalidateToken(this._lastAccessToken);
            this._lastAccessToken = undefined;
          }
        }
      } else {
        if (!this._accessTokenRequired) {
          // Looks like this is the first time we get a 'TokenRequired' error, lets try to get one from the access client
          // and a second request attempt
          const urlObj2 = new URL(url);
          if (this._accessClient) {
            try {
              this._lastAccessToken = await ArcGisUtilities.appendSecurityToken(urlObj2, this._accessClient, {
                mapLayerUrl: new URL(this._settings.url),
                userName: this._settings.userName,
                password: this._settings.password });

            } catch {
            }

            response = await fetch(urlObj2.toString(), options);
            if (undefined === await ArcGisUtilities.checkForResponseErrorCode(response.clone())) {
              // Error code is gone, we solved the problem by providing an access token
              return response;
            }
          }
        }

        if (this.status === MapLayerImageryProviderStatus.Valid ) {
          // Only report if status is currently valid (avoid reporting twice the same error)
          this.status = MapLayerImageryProviderStatus.RequireAuth;
          this.onStatusChanged.raiseEvent(this);
          const msg = IModelApp.localization.getLocalizedString("iModelJs:MapLayers.Messages.FetchTooltipTokenError", { layerName: this._settings.name });
          IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Warning, msg));
        }
      }

      this._accessTokenRequired = true;
    }
    return response;
  }
}
