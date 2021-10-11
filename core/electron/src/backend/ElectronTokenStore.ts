/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// Code based on the blog article @ https://authguidance.com

/** @packageDocumentation
 * @module Authentication
 */

import * as OperatingSystemUserName from "username";
import { TokenResponse, TokenResponseJson } from "@openid/appauth";
import { IModelHost } from "@itwin/core-backend";

/**
 * Utility to store OIDC AppAuth in secure storage
 * @internal
 */
export class ElectronTokenStore {
  private _appStorageKey: string;

  public constructor(clientId: string) {
    this._appStorageKey = `Bentley.iModelJs.OidcTokenStore.${clientId}`;
  }

  private _userName?: string; // Cached user name
  private async getUserName(): Promise<string | undefined> {
    if (!this._userName)
      this._userName = await OperatingSystemUserName();
    return this._userName;
  }

  /** Load token if available */
  public async load(): Promise<TokenResponse | undefined> {
    if (undefined === IModelHost.platform.KeyTar) // no keytar on Linux yet
      return undefined;

    const userName = await this.getUserName();
    if (!userName)
      return;

    const tokenResponseStr = await IModelHost.platform.KeyTar.getPassword(this._appStorageKey, userName);
    if (!tokenResponseStr) {
      return undefined;
    }

    const tokenResponseJson = JSON.parse(tokenResponseStr) as TokenResponseJson;
    return new TokenResponse(tokenResponseJson);
  }

  /** Save token after signin */
  public async save(tokenResponse: TokenResponse): Promise<void> {
    if (undefined === IModelHost.platform.KeyTar) // no keytar on Linux yet
      return;

    const userName = await this.getUserName();
    if (!userName)
      return;

    const tokenResponseObj = new TokenResponse(tokenResponse.toJson()); // Workaround for 'stub received bad data' error on windows - see https://github.com/atom/node-keytar/issues/112
    tokenResponseObj.accessToken = "";
    tokenResponseObj.idToken = "";

    const tokenResponseStr = JSON.stringify(tokenResponseObj.toJson());
    await IModelHost.platform.KeyTar.setPassword(this._appStorageKey, userName, tokenResponseStr);
  }

  /** Delete token after signout */
  public async delete(): Promise<void> {
    if (undefined === IModelHost.platform.KeyTar) // no keytar on Linux yet
      return;

    const userName = await this.getUserName();
    if (!userName)
      return;

    await IModelHost.platform.KeyTar.deletePassword(this._appStorageKey, userName);
  }
}
