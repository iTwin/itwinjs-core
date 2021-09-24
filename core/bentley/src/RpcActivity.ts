/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utils
 */

import { GuidString } from "./Id";

// cSpell:ignore csrf

/** Properties that identify a session.
 * @public
 */
export interface SessionProps {
  /** Used for logging and usage tracking to identify the application  */
  readonly applicationId: string;

  /** Used for logging and usage tracking to identify the application version  */
  readonly applicationVersion: string;

  /** Used for logging to identify a session  */
  readonly sessionId: GuidString;
}

/**
 * A string that contains an access token.
 * @beta
 */
export type AccessToken = string;

/** The properties of an RpcActivity.
 * @beta
 */
export interface RpcActivity extends SessionProps {
  /** Used for logging to correlate an Rpc activity between frontend and backend */
  readonly activityId: GuidString;

  /** access token for authorization  */
  readonly accessToken?: AccessToken;
}

export interface AuthorizedRpcActivity extends Omit<RpcActivity, "accessToken"> {
  readonly accessToken: AccessToken;
}

/** Use this for logging for ClientRequestContext.
   * It returns only sanitized members, intentionally removing all others to avoid logging secrets or violating user-privacy rules.
   */
export function sanitizeRpcActivity(activity: RpcActivity) {
  return {
    activityId: activity.activityId,
    applicationId: activity.applicationId,
    applicationVersion: activity.applicationVersion,
    sessionId: activity.sessionId,
  };
}

/** Serialized format for sending the request across the RPC layer
 * @public
 */
export interface SerializedRpcActivity {
  id: string;
  applicationId: string;
  applicationVersion: string;
  sessionId: string;
  authorization: string;
  csrfToken?: { headerName: string, headerValue: string };
}
