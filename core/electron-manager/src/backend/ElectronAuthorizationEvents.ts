/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// Code based on the blog article @ https://authguidance.com

/** @packageDocumentation
 * @module Authentication
 */

import { BeEvent } from "@bentley/bentleyjs-core";
import { AuthorizationErrorJson, AuthorizationResponseJson } from "@openid/appauth";

/** @internal */
export type AuthorizationResponseCompletedListener = (error?: AuthorizationErrorJson) => void;

/** @internal */
export type AuthorizationResponseListener = (error: AuthorizationErrorJson | null, response: AuthorizationResponseJson | null) => void;

/**
 * Internal events used by authorization by DesktopAuthorizationClient and related classes
 * @internal
 */
export class ElectronAuthorizationEvents {
  /** Event raised when the authorization is completed */
  public readonly onAuthorizationResponseCompleted = new BeEvent<AuthorizationResponseCompletedListener>();

  /** Event raised when a response is received from the authorization server with the authorization code */
  public readonly onAuthorizationResponse = new BeEvent<AuthorizationResponseListener>();
}
