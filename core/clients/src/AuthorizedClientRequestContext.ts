/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Utils */

import { AccessToken } from "./Token";
import { Guid, ClientRequestContext, GuidString } from "@bentley/bentleyjs-core";

/** Provides generic context for a server application to get details of a particular request that originated at the client.
 * This context includes an [[AccessToken]] that carries authorization information. For services that do not require authorization
 * it's sufficient to pass an instance of the base class [[ClientRequestContext]].
 * @see [ClientRequestContext rules]($docs/learning/backend/managingclientrequestcontext.md).
 * @see [[ClientRequestContext]]
 * @beta
 */
export class AuthorizedClientRequestContext extends ClientRequestContext {
  /** The access token value of the client application. */
  public accessToken: AccessToken;

  /** Constructor */
  public constructor(accessToken: AccessToken, activityId: GuidString = Guid.createValue(), applicationId: string = "", applicationVersion: string = "", sessionId: GuidString = Guid.empty) {
    super(activityId, applicationId, applicationVersion, sessionId);
    this.accessToken = accessToken;
  }
}
