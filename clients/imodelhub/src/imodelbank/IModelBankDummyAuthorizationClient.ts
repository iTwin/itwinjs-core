/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { AccessToken, BeEvent } from "@itwin/core-bentley";
import { AuthorizationClient } from "@itwin/core-common";

/** Implements the user permission abstraction by creating a dummy AccessToken. Note that the corresponding IModelBank server must
 * be able to tolerate this dummy token.
 * @internal
 */
export class IModelBankDummyAuthorizationClient implements AuthorizationClient {
  private _token: AccessToken = "";

  public constructor(private _userCredentials: any) {
  }

  public async signIn(): Promise<void> {
    const userInfo = {
      id: "",
      email: {
        id: this._userCredentials.email,
      },
      profile: {
        name: "",
        firstName: "",
        lastName: "",
      },
    };

    const foreignAccessTokenWrapper: any = {};
    foreignAccessTokenWrapper.ForeignProjectAccessToken = { userInfo };
    this._token = JSON.stringify(foreignAccessTokenWrapper);
    this.onAccessTokenChanged.raiseEvent(this._token);
  }

  public async signOut(): Promise<void> {
    this._token = "";
    this.onAccessTokenChanged.raiseEvent(this._token);
  }

  public readonly onAccessTokenChanged = new BeEvent<(token: AccessToken) => void>();
  public get isAuthorized(): boolean {
    return this._token !== "";
  }
  public get hasExpired(): boolean {
    return false;
  }
  public get hasSignedIn(): boolean {
    return this._token !== "";
  }

  public async getAccessToken(): Promise<AccessToken> {
    return this._token;
  }
}
