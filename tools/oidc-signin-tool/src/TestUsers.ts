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
      email: process.env.IMJS_TEST_REGULAR_USER_NAME ?? "",
      password: process.env.IMJS_TEST_REGULAR_USER_PASSWORD ?? "",
    };
  }

  /** User with typical permissions of the iTwin administrator - Co-Admin: Yes, Connect-Services-Admin: No */
  public static get manager(): TestUserCredentials {
    return {
      email: process.env.IMJS_TEST_MANAGER_USER_NAME ?? "",
      password: process.env.IMJS_TEST_MANAGER_USER_PASSWORD ?? "",
    };
  }

  /** User with the typical permissions of the connected services administrator - Co-Admin: No, Connect-Services-Admin: Yes */
  public static get super(): TestUserCredentials {
    return {
      email: process.env.IMJS_TEST_SUPER_USER_NAME ?? "",
      password: process.env.IMJS_TEST_SUPER_USER_PASSWORD ?? "",
    };
  }

  /** User with the typical permissions of the connected services administrator - Co-Admin: Yes, Connect-Services-Admin: Yes */
  public static get superManager(): TestUserCredentials {
    return {
      email: process.env.IMJS_TEST_SUPER_MANAGER_USER_NAME ?? "",
      password: process.env.IMJS_TEST_SUPER_MANAGER_USER_PASSWORD ?? "",
    };
  }

  /**
   * Gets the default iModel.js OIDC SPA client registration available at the config variables:
   *
   *  - IMJS_OIDC_BROWSER_TEST_CLIENT_ID
   *  - IMJS_OIDC_BROWSER_TEST_REDIRECT_URI
   *  - IMJS_OIDC_BROWSER_TEST_SCOPES
   */
  public static getTestBrowserAuthorizationClientConfiguration(): TestBrowserAuthorizationClientConfiguration {
    if (process.env.IMJS_OIDC_BROWSER_TEST_CLIENT_ID === undefined)
      throw new Error("Could not find IMJS_OIDC_BROWSER_TEST_CLIENT_ID");
    if (process.env.IMJS_OIDC_BROWSER_TEST_REDIRECT_URI === undefined)
      throw new Error("Could not find IMJS_OIDC_BROWSER_TEST_REDIRECT_URI");
    if (process.env.IMJS_OIDC_BROWSER_TEST_SCOPES === undefined)
      throw new Error("Could not find IMJS_OIDC_BROWSER_TEST_SCOPES");

    return {
      clientId: process.env.IMJS_OIDC_BROWSER_TEST_CLIENT_ID ?? "",
      redirectUri: process.env.IMJS_OIDC_BROWSER_TEST_REDIRECT_URI ?? "",
      scope: process.env.IMJS_OIDC_BROWSER_TEST_SCOPES ?? "",
    };
  }
}
