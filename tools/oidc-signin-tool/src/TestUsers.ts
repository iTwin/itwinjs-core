/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
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
      email: process.env.imjs_test_regular_user_name ?? "",
      password: process.env.imjs_test_regular_user_password ?? "",
    };
  }

  /** User with typical permissions of the project administrator - Co-Admin: Yes, Connect-Services-Admin: No */
  public static get manager(): TestUserCredentials {
    return {
      email: process.env.imjs_test_manager_user_name ?? "",
      password: process.env.imjs_test_manager_user_password ?? "",
    };
  }

  /** User with the typical permissions of the connected services administrator - Co-Admin: No, Connect-Services-Admin: Yes */
  public static get super(): TestUserCredentials {
    return {
      email: process.env.imjs_test_super_user_name ?? "",
      password: process.env.imjs_test_super_user_password ?? "",
    };
  }

  /** User with the typical permissions of the connected services administrator - Co-Admin: Yes, Connect-Services-Admin: Yes */
  public static get superManager(): TestUserCredentials {
    return {
      email: process.env.imjs_test_super_manager_user_name ?? "",
      password: process.env.imjs_test_super_manager_user_password ?? "",
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
    if (process.env.imjs_oidc_browser_test_client_id === undefined)
      throw new Error("Could not find imjs_oidc_browser_test_client_id");
    if (process.env.imjs_oidc_browser_test_redirect_uri === undefined)
      throw new Error("Could not find imjs_oidc_browser_test_redirect_uri");
    if (process.env.imjs_oidc_browser_test_scopes === undefined)
      throw new Error("Could not find imjs_oidc_browser_test_scopes");

    return {
      clientId: process.env.imjs_oidc_browser_test_client_id ?? "",
      redirectUri: process.env.imjs_oidc_browser_test_redirect_uri ?? "",
      scope: process.env.imjs_oidc_browser_test_scopes ?? "",
    };
  }
}
