/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { AccessToken, IAuthorizationClient, Config } from "@bentley/imodeljs-clients";
import { BentleyError, AuthStatus } from "@bentley/bentleyjs-core";

// Keep the dependencies of this file to only ones that can be used from both the frontend and backend.  This allows the same class for
// test users to be used in either case.

/**
 * Interface for test user credentials
 * @alpha
 */
export interface TestUserCredentials {
  email: string;
  password: string;
}

/**
 * Configuration used by [[TestOidcClient]]
 * @alpha
 */
export interface TestOidcConfiguration {
  clientId: string;
  redirectUri: string;
  scope: string;
}

/**
 * Test users with various permissions for the iModel.js integration tests
 * @internal
 */
export class TestUsers {
  /** User with the typical permissions of the regular/average user - Co-Admin: No, Connect-Services-Admin: No */
  public static get regular(): TestUserCredentials {
    return {
      email: Config.App.getString("imjs_test_regular_user_name"),
      password: Config.App.getString("imjs_test_regular_user_password"),
    };
  }

  /** User with typical permissions of the project administrator - Co-Admin: Yes, Connect-Services-Admin: No */
  public static get manager(): TestUserCredentials {
    return {
      email: Config.App.getString("imjs_test_manager_user_name"),
      password: Config.App.getString("imjs_test_manager_user_password"),
    };
  }

  /** User with the typical permissions of the connected services administrator - Co-Admin: No, Connect-Services-Admin: Yes */
  public static get super(): TestUserCredentials {
    return {
      email: Config.App.getString("imjs_test_super_user_name"),
      password: Config.App.getString("imjs_test_super_user_password"),
    };
  }

  /** User with the typical permissions of the connected services administrator - Co-Admin: Yes, Connect-Services-Admin: Yes */
  public static get superManager(): TestUserCredentials {
    return {
      email: Config.App.getString("imjs_test_super_manager_user_name"),
      password: Config.App.getString("imjs_test_super_manager_user_password"),
    };
  }

  /**
   * Gets the default iModel.js OIDC SPA client registration available at the config variables:
   *
   *  - imjs_oidc_browser_test_client_id
   *  - imjs_oidc_browser_test_redirect_uri
   *  - imjs_oidc_browser_test_scopes
   */
  public static getTestOidcConfiguration(): TestOidcConfiguration {
    return {
      clientId: Config.App.getString("imjs_oidc_browser_test_client_id"),
      redirectUri: Config.App.getString("imjs_oidc_browser_test_redirect_uri"),
      scope: Config.App.getString("imjs_oidc_browser_test_scopes"),
    };
  }
}

/**
 * Basic AuthorizationClient to use with an already created access token.
 * @internal
 */
export class TestAuthorizationClient implements IAuthorizationClient {
  constructor(private _accessToken?: AccessToken) { }

  public get isAuthorized(): boolean {
    return !!this._accessToken;
  }

  public get hasExpired(): boolean {
    return !this._accessToken;
  }

  public get hasSignedIn(): boolean {
    return !!this._accessToken;
  }

  public async getAccessToken(): Promise<AccessToken> {
    if (!this._accessToken)
      throw new BentleyError(AuthStatus.Error, "Cannot get access token");
    return this._accessToken;
  }

  public setAccessToken(accessToken?: AccessToken) {
    this._accessToken = accessToken;
  }
}
