/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utils
 */

import { ClientRequestContext, Guid } from "@bentley/bentleyjs-core";
import { AccessToken, AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { IModelHost } from "./IModelHost";

/**
 * Provides some generic context for downstream server applications to get details of a request that
 * originated at the backend. The context is meant for use in applications that require authorization.
 * @see BackendRequestContext
 * @public
 */
export class AuthorizedBackendRequestContext extends AuthorizedClientRequestContext {
  /**
   * Create a new context for agent applications or long running backend operations to pass to various services
   * @see [[AuthorizedBackendRequestContext.create]] to create the request based on the authorization information supplied to IModelHost.
   */
  public constructor(accessToken: AccessToken, activityId: string = Guid.createValue()) {
    super(accessToken, activityId, IModelHost.applicationId, IModelHost.applicationVersion, IModelHost.sessionId);
  }

  /**
   * Create a new context for agent applications or long running backend operations to pass to various services that require
   * authorization. Uses the authorization information supplied to IModelHost to setup an accessToken within the context.
   * @throws [[BentleyError]] if the application cannot be authorized.
   * @see [[IModelHost.authorizationClient]] to setup authorization for the backend application.
   */
  public static async create(activityId: string = Guid.createValue()): Promise<AuthorizedBackendRequestContext> {
    const accessToken = await IModelHost.getAccessToken();
    return new AuthorizedBackendRequestContext(accessToken, activityId);
  }
}

/**
 * Provides generic context for downstream server applications to get details of a request that
 * originated at the backend. The context is meant for use in applications that do NOT require authorization.
 * @see AuthorizedBackendRequestContext
 * @public
 */
export class BackendRequestContext extends ClientRequestContext {
  /**
   * Create a new context for agent applications or long running backend operations to pass to various services
   */
  public constructor(activityId: string = Guid.createValue()) {
    super(activityId, IModelHost.applicationId, IModelHost.applicationVersion, IModelHost.sessionId);
  }
}
