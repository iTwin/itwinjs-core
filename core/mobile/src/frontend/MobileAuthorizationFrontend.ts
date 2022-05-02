/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module OIDC
 */

import { AccessToken } from "@itwin/core-bentley";
import { AuthorizationClient } from "@itwin/core-common";
import { MobileApp } from "./MobileApp";

/** Utility to request OIDC/OAuth tokens from mobile frontend to mobile backend.
 * @beta
 */
export class MobileAuthorizationFrontend implements AuthorizationClient {
  private _accessToken: AccessToken = "";
  private _expirationDate: Date | undefined;
  private _expiryBuffer = 60 * 10; // ten minutes
  private _fetchingToken = false;

  private get hasExpired(): boolean {
    return this._expirationDate !== undefined && this._expirationDate.getTime() - Date.now() <= this._expiryBuffer * 1000;
  }

  public async getAccessToken(): Promise<AccessToken> {
    if (this._fetchingToken) {
      return Promise.reject(); // short-circuits any recursive use of this function
    }

    if (this._accessToken && !this.hasExpired) {
      return this._accessToken;
    } else {
      this._fetchingToken = true;
      const result = await MobileApp.callBackend("getAccessToken");
      this._accessToken = result[0];
      if (result[1])
        this._expirationDate = new Date(result[1]);
      this._fetchingToken = false;
      return this._accessToken;
    }
  }
}
