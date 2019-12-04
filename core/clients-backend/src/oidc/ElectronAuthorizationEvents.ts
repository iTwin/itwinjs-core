/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Authentication */

import { BeEvent } from "@bentley/bentleyjs-core";
import { AuthorizationErrorJson, AuthorizationResponseJson } from "@openid/appauth";

/** @internal */
export type AuthorizationResponseCompletedListener = (error?: AuthorizationErrorJson) => void;

/** @internal */
export type AuthorizationResponseListener = (error: AuthorizationErrorJson | null, response: AuthorizationResponseJson | null) => void;

/**
 * Internal events used by authorization by OidcDesktopClient and related classes
 * @internal
 */
export class ElectronAuthorizationEvents {
  /** Event raised when the authorization is completed */
  public static readonly onAuthorizationResponseCompleted = new BeEvent<AuthorizationResponseCompletedListener>();

  /** Event raised when a response is received from the authorization server with the authorization code */
  public static readonly onAuthorizationResponse = new BeEvent<AuthorizationResponseListener>();
}
