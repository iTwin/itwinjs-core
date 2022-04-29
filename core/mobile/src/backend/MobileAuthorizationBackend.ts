/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module OIDC
 */

import { AccessToken } from "@itwin/core-bentley";
import { AuthorizationClient } from "@itwin/core-common";
import { MobileHost } from "./MobileHost";

/** Utility to provide OIDC/OAuth tokens from native ios app to frontend
 * @beta
 */
export class MobileAuthorizationBackend implements AuthorizationClient {
  protected _accessToken: AccessToken = "";

  public async getAccessToken(): Promise<AccessToken> {
    return new Promise<AccessToken>((resolve, reject) => {
      if (this._accessToken) {
        resolve(this._accessToken);
      } else {
        MobileHost.device.authGetAccessToken((tokenString?: AccessToken, error?: String) => {
          if (error) {
            this._accessToken = "";
            reject(error);
          }
          this._accessToken = tokenString ?? "";
          resolve(this._accessToken);
        });
      }
    });
  }
}
