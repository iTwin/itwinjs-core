/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module OIDC
 */

import { AccessToken, BeEvent } from "@itwin/core-bentley";
import { AuthorizationClient } from "@itwin/core-common";

/** Utility to provide and cache auth tokens from native mobile apps.
 * @internal
 */
export class MobileAuthorizationClient implements AuthorizationClient {
  private _accessToken: AccessToken = "";
  private _expirationDate: Date | undefined;
  private _expiryBuffer = 60 * 10; // ten minutes
  private _fetchingToken = false;

  private get _hasExpired(): boolean {
    return this._expirationDate !== undefined && this._expirationDate.getTime() - Date.now() <= this._expiryBuffer * 1000;
  }

  constructor(private _getAccessToken: () => Promise<[string, string | undefined]>) { }

  public async getAccessToken(): Promise<AccessToken> {
    if (this._fetchingToken) {
      // NOTE: This function is from the AuthorizationClient interface. That interface documents
      // this function to return an empty string if no token is available, NOT throw an exception.
      return ""; // short-circuits any recursive use of this function
    }

    if (this._accessToken && !this._hasExpired) {
      return this._accessToken;
    } else {
      try {
        this._fetchingToken = true;
        const result = await this._getAccessToken();
        this._accessToken = result[0];
        this._expirationDate = result[1] ? new Date(result[1]) : undefined;
        return this._accessToken;
      } catch (_ex) {
        return "";
      } finally {
        this._fetchingToken = false;
      }
    }
  }

  public readonly onAccessTokenChanged = new BeEvent<(token: AccessToken) => void>();

  public setAccessToken(accessToken?: string, expirationDate?: string) {
    this._accessToken = accessToken ?? "";
    this._expirationDate = expirationDate ? new Date(expirationDate) : undefined;
    this.onAccessTokenChanged.raiseEvent(this._accessToken);
  }
}
