/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Logging */

/** A notion of the logging context in which a backend operation is performed, used to correlate
 * a frontend request with all of the backend operations that it requests.
 * See [ActivityLoggingContext rules]($docs/learning/backend/managingactivityloggingcontext.md).
 * @beta ActivityLoggingContext is scheduled to be renamed before the 1.0 release.
 */
export class ActivityLoggingContext {
  /** The current activity context. */
  public static get current() { return ActivityLoggingContext._current; }
  protected static _current = new ActivityLoggingContext("", "");

  /** The unique id of the frontend's request -- this id is associated with many backend operations, even across multiple servers. */
  public readonly activityId: string;

  /** The version id of the frontend application. */
  public readonly versionId: string;

  /** Construct a logging context, based on a given activityId. This should be called by RpcInvocation. */
  public constructor(activityId: string, versionId: string = "") {
    this.activityId = activityId;
    this.versionId = versionId;
  }

  /**
   * Set or reset the current ActivityLoggingContext to be this object. Should be called by backend async functions and the functions that they call
   * at every resume point. See [ActivityLoggingContext rules]($docs/learning/backend/managingactivityloggingcontext.md).
   */
  public enter(): this {
    ActivityLoggingContext._current = this;
    return this;
  }
}
