/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utils
 */

import { AuthStatus, BentleyError, ClientRequestContext } from "@bentley/bentleyjs-core";
import { AccessToken, AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { IModelApp } from "./IModelApp";

/**
 * Provides some generic context for downstream server applications to get details of a request that
 * originated at the frontend. The context is meant for use in applications that require authorization.
 * @see FrontendRequestContext
 * @public
 */
export class AuthorizedFrontendRequestContext extends AuthorizedClientRequestContext {

  /**
   * Create a new context for frontend operations to pass to various services
   * @see [[AuthorizedFrontendRequestContext.create]] to create the request based on the authorization information supplied to IModelHost.
   */
  public constructor(accessToken: AccessToken, activityId?: string) {
    super(accessToken, activityId, IModelApp.applicationId, IModelApp.applicationVersion, IModelApp.sessionId);
  }

  /**
   * Create a new context for frontend operations to pass to various services that require
   * authorization. Uses the authorization information supplied to IModelApp to setup an accessToken within the context.
   * @throws [[BentleyError]] if the application cannot be authorized.
   * @see [[IModelApp.authorizationClient]] to setup authorization for the frontend application.
   */
  public static async create(activityId?: string): Promise<AuthorizedFrontendRequestContext> {
    if (!IModelApp.authorizationClient)
      throw new BentleyError(AuthStatus.Error, "authorizationClient not initialized");

    const accessToken = await IModelApp.authorizationClient.getAccessToken();
    return new AuthorizedFrontendRequestContext(accessToken, activityId);
  }
}

/**
 * Provides generic context for downstream server applications to get details of a request that
 * originated at the frontend. The context is meant for use in applications that do NOT require authorization.
 * @see AuthorizedFrontendRequestContext
 * @public
 */
export class FrontendRequestContext extends ClientRequestContext {
  /** Create a new context for agent applications or long running frontend operations to pass to various services */
  public constructor(activityId?: string) {
    super(activityId, IModelApp.applicationId, IModelApp.applicationVersion, IModelApp.sessionId);
  }
}
