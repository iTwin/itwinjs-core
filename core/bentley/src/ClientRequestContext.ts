/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utils
 */

import { Guid, GuidString } from "./Id";

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

/** The properties of ClientRequestContext.
 * @public
 */
export interface ClientRequestContextProps extends SessionProps {
  /** Used for logging to correlate all service requests that originated from this client request */
  readonly activityId?: GuidString;
}

/** Provides generic context for a server application to get details of a particular
 * request that originated at the client. This context is used to pass information for various
 * purposes including usage tracking and logging. Services that require authorization are
 * passed an instance of the subclass:
 * [AuthorizedClientRequestContext]($itwin-client)
 * @see [AuthorizedClientRequestContext]($itwin-client)
 * @public
 */
export class ClientRequestContext {
  /** Used for logging to correlate all service requests that originated from this client request */
  public readonly activityId: GuidString;

  /** Used for logging and usage tracking to identify the application that created this client request */
  public readonly applicationId: string;

  /** Used for logging and usage tracking to identify the application version that created this client request */
  public readonly applicationVersion: string;

  /** Used for logging to identify the session that created this client request */
  public readonly sessionId: GuidString;

  /** Create a new ClientRequestContext */
  public constructor(activityId: GuidString = Guid.createValue(), applicationId: string = "", applicationVersion: string = "", sessionId: GuidString = Guid.empty) {
    this.activityId = activityId;
    this.applicationId = applicationId;
    this.applicationVersion = applicationVersion;
    this.sessionId = sessionId;
    this._useContextForRpc = false;
  }

  /** Use this for logging for ClientRequestContext.
   * It returns only sanitized members, intentionally removing all others to avoid logging secrets or violating user-privacy rules.
   */
  public sanitize() {
    return {
      activityId: this.activityId,
      applicationId: this.applicationId,
      applicationVersion: this.applicationVersion,
      sessionId: this.sessionId,
    };
  }

  /** Setup use of this context for the next RPC call
   * @internal
   */
  private _useContextForRpc: boolean;
  public get useContextForRpc(): boolean { return this._useContextForRpc; }
  public set useContextForRpc(value: boolean) { this._useContextForRpc = value; }
  /** @internal */
  public toJSON(): ClientRequestContextProps {
    return {
      activityId: this.activityId,
      applicationId: this.applicationId,
      applicationVersion: this.applicationVersion,
      sessionId: this.sessionId,
    };
  }
  public static fromJSON(json: ClientRequestContextProps): ClientRequestContext {
    return new ClientRequestContext(json.activityId, json.applicationId, json.applicationVersion, json.sessionId);
  }
}

/** Serialized format for sending the client request context across the RPC layer
 * @public
 */
export interface SerializedClientRequestContext {
  id: string;
  applicationId: string;
  applicationVersion: string;
  sessionId: string;
  authorization?: string;
  userId?: string;
  csrfToken?: { headerName: string, headerValue: string };
}
