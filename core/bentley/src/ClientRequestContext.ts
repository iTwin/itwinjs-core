/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Utils */

import { Guid } from "./Id";

/** Provides generic context for a server application to get details of a particular
 * request that originated at the client. This context is used to pass information for various
 * purposes including usage tracking and logging. Services that require authorization are
 * passed an instance of the subclass:
 * [[AuthorizedClientRequestContext]].
 * @see [ClientRequestContext rules]($docs/learning/backend/managingclientrequestcontext.md).
 * @see [[AuthorizedClientRequestContext]]
 */
export class ClientRequestContext {

  /** Used for logging to correlate all service requests that originated from this client request */
  public readonly activityId: string;

  /** Used for logging and usage tracking to identify the application that created this client request */
  public readonly applicationId: string;

  /** Used for logging and usage tracking to identify the application version that created this client request */
  public readonly applicationVersion: string;

  /** Used for logging to to identify the session that created this client request */
  public readonly sessionId: string;

  /** Create a new ClientRequestContext */
  public constructor(activityId: string = Guid.createValue(), applicationId: string = "", applicationVersion: string = "", sessionId: string = "") {
    this.activityId = activityId;
    this.applicationId = applicationId;
    this.applicationVersion = applicationVersion;
    this.sessionId = sessionId;
    this._useContextForRpc = false;
  }

  /** Get the current client request context */
  public static get current() { return ClientRequestContext._current; }
  protected static _current: ClientRequestContext = new ClientRequestContext();

  /**
   * Set or reset the current ClientRequestContext to be this object. Should be called by async functions and the functions that they call
   * at every resume point. See [ClientRequestContext rules]($docs/learning/backend/managingclientrequestcontext.md).
   */
  public enter(): this {
    ClientRequestContext._current = this;
    return this;
  }

  /** Setup use of this context for the next RPC call
   * @internal
   */
  private _useContextForRpc: boolean;
  public get useContextForRpc(): boolean {
    return this._useContextForRpc;
  }
  public set useContextForRpc(value: boolean) {
    this._useContextForRpc = value;
  }
}

/** Serialized format for sending the client request context across the RPC layer */
export interface SerializedClientRequestContext {
  id: string;
  applicationId: string;
  applicationVersion: string;
  sessionId: string;
  authorization?: string;
  userId?: string;
}
