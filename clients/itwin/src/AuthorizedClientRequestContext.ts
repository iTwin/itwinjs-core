/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Authentication
 */

import { ClientRequestContext, ClientRequestContextProps, Guid, GuidString, SessionProps } from "@bentley/bentleyjs-core";
import { AccessTokenProps, AccessTokenString } from "./Token";

/** The properties of AuthorizedSession.
 * @beta
 */
export interface AuthorizedSessionProps extends SessionProps {
  accessTokenProps: AccessTokenProps;
}

/** @beta */
export interface AuthorizedSession extends SessionProps {
  accessToken?: AccessTokenString;
}

/** The properties of AuthorizedClientRequestContext.
 * @beta
 */
export interface AuthorizedClientRequestContextProps extends ClientRequestContextProps {
  accessToken: AccessTokenProps;
}

/** Provides generic context for a server application to get details of a particular request that originated at the client.
 * This context includes an [[AccessToken]] that carries authorization information. For services that do not require authorization
 * it's sufficient to pass an instance of the base class [[ClientRequestContext]].
 * @see [ClientRequestContext rules]($docs/learning/backend/managingclientrequestcontext.md).
 * @see [ClientRequestContext]($bentley)
 * @public
 */
export class AuthorizedClientRequestContext extends ClientRequestContext {
  /** The access token value of the client application.
   * @beta
   */
  public accessToken?: AccessTokenString;

  /** Constructor
   * @beta
   */
  public constructor(accessToken?: AccessTokenString, activityId: GuidString = Guid.createValue(), applicationId: string = "", applicationVersion: string = "", sessionId: GuidString = Guid.empty) {
    super(activityId, applicationId, applicationVersion, sessionId);
    this.accessToken = accessToken;
  }

  /** @internal */
  public override toJSON(): AuthorizedClientRequestContextProps {
    const obj = super.toJSON() as AuthorizedClientRequestContextProps;
    return obj;
  }
  /** @internal */
  public static override fromJSON(json: AuthorizedClientRequestContextProps): AuthorizedClientRequestContext {
    return new AuthorizedClientRequestContext(json.accessToken.tokenString, json.activityId, json.applicationId, json.applicationVersion, json.sessionId);

  }
}

/** AuthorizedClientRequestContext type guard.
 * @beta
 */
export const isAuthorizedClientRequestContext = (requestContext: ClientRequestContext): requestContext is AuthorizedClientRequestContext => {
  return (requestContext as AuthorizedClientRequestContext).accessToken !== undefined;
};
