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
  protected _accessToken: AccessToken = "";

  public async getAccessToken(): Promise<AccessToken> {
    if (!this._accessToken) {
      this._accessToken = (await MobileApp.callBackend("getAccessToken")) ?? "";
    }
    return this._accessToken;
  }
}
