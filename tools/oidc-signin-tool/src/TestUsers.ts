/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Config } from "@bentley/bentleyjs-core";

// Keep the dependencies of this file to only ones that can be used from both the frontend and backend.  This allows the same class for
// test users to be used in either case.

/**
 * Interface for test user credentials
 * @internal
 */
export interface TestUserCredentials {
  email: string;
  password: string;
}

/**
 * Configuration used by [[TestBrowserAuthorizationClient]]
 * @internal
 */
export interface TestBrowserAuthorizationClientConfiguration {
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
  public static getTestBrowserAuthorizationClientConfiguration(): TestBrowserAuthorizationClientConfiguration {
    return {
      clientId: Config.App.getString("imjs_oidc_browser_test_client_id"),
      redirectUri: Config.App.getString("imjs_oidc_browser_test_redirect_uri"),
      scope: Config.App.getString("imjs_oidc_browser_test_scopes"),
    };
  }
}
