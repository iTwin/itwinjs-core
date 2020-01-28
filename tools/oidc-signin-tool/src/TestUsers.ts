/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Config, AccessToken, IAuthorizationClient, AuthorizedClientRequestContext } from "@bentley/imodeljs-clients";
import { TestUserCredentials, TestOidcClient, TestOidcConfiguration } from "./TestOidcClient";

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

  private static _clients = new Map<string, IAuthorizationClient>();

  /**
   * Gets the default iModel.js internal OIDC SPA client registration
   */
  private static getTestOidcConfiguration(): TestOidcConfiguration {
    return {
      clientId: Config.App.getString("imjs_oidc_browser_test_client_id"),
      redirectUri: Config.App.getString("imjs_oidc_browser_test_redirect_uri"),
      scope: Config.App.getString("imjs_oidc_browser_test_scopes"),
    };
  }

  /**
   * Gets the authorization client for the specified iModel.js test user.
   * - Caches the client for future use.
   * - Uses the default iModel.js internal OIDC SPA client registration
   * @param user Test user credentials
   * @internal
   */
  public static getAuthorizationClient(user: TestUserCredentials): IAuthorizationClient {
    let client = this._clients.get(user.email);
    if (client !== undefined)
      return client;

    const config = this.getTestOidcConfiguration();
    client = new TestOidcClient(config, user);
    this._clients.set(user.email, client);
    return client;
  }

  /**
   * Get the access token for the specified iModel.js test user.
   * - Retrieves a previously cached token if that's available, or otherwise uses [[TestOidcClient]]
   * to signin the user through a headless browser.
   * - Uses the default iModel.js internal OIDC SPA client registration
   * @param user Test user credentials
   * @internal
   */
  public static async getAccessToken(user: TestUserCredentials): Promise<AccessToken> {
    const client = this.getAuthorizationClient(user);
    return client.getAccessToken();
  }

  /**
   * Create or retrieve the client request context for the specified iModel.js test user
   * - A previously cached token is reused if available to construct the context, or otherwise uses [[TestOidcClient]]
   * to signin the user through a headless browser.
   * - Uses the default iModel.js internal OIDC SPA client registration
   * @param user Test user credentials
   * @internal
   */
  public static async getAuthorizedClientRequestContext(user: TestUserCredentials): Promise<AuthorizedClientRequestContext> {
    const accessToken = await this.getAccessToken(user);
    return new AuthorizedClientRequestContext(accessToken);
  }
}
