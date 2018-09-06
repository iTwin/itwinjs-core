/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Logging */

/** A notion of the logging context in which a backend operation is performed, used to correlate a frontend request with all of the backend operations that it requests. */
export class ActivityLoggingContext {
  /** The current activity context (if available). */
  public static get current() { return ActivityLoggingContext._current; }
  protected static _current: ActivityLoggingContext | undefined;

  /** The unique id of the frontend's request -- this id is associated with many backend operations, even across multiple servers. */
  public readonly activityId: string;

  /** Construct a logging context, based on a given activityId. This should be called by RpcInvocation. */
  public constructor(activityId: string) {
    this.activityId = activityId;
  }

  /**
   * Set or reset the logging context. Should be called by a backend async function.
   * All async backend functions must call this at every resume point, that is, at beginning of the function and on the line after each await.
   */
  public enter(): this {
    ActivityLoggingContext._current = this;
    return this;
  }

}
