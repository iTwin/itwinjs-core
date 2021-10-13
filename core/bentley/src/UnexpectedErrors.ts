/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Errors
 */

import { Logger } from "./Logger";

/** A function to be notified when an unexpected error happens
 * @public
 */
export type OnUnexpectedError = (error: any) => void;

/**
 * Utility for handling/reporting unexpected runtime errors. This class establishes a global handler for
 * unexpected errors, and programmers should use its `handle` method when they occur. Generally, unexpected
 * errors should not cause program termination, and should instead be logged and swallowed. However, for
 * development/debugging, it can be helpful to re-throw exceptions so they are not missed.
 * @public
 */
export class UnexpectedErrors {
  /** handler for re-throwing exceptions directly */
  public static readonly reThrowImmediate = (e: any) => { throw e; };
  /** handler for re-throwing exceptions from an asynchronous interval (so the current call stack is not aborted) */
  public static readonly reThrowDeferred = (e: any) => setTimeout(() => { throw e; }, 0);
  /** handler for logging exception to console */
  public static readonly consoleLog = (e: any) => console.error(e); // eslint-disable-line no-console
  /** handler for logging exception with [[Logger]] */
  public static readonly errorLog = (e: any) => Logger.logException("unhandled", e);

  private static _telemetry: OnUnexpectedError[] = [];
  private static _handler = this.errorLog; // default to error logging
  private constructor() { } // this is a singleton

  /** Add a "telemetry tracker" for unexpected errors. Useful for tracking/reporting errors without changing handler.
   * @returns a method to remove the tracker
   */
  public static addTelemetry(tracker: OnUnexpectedError): () => void {
    this._telemetry.push(tracker);
    return () => this._telemetry.splice(this._telemetry.indexOf(tracker), 1);
  }

  /** call this method when an unexpected error happens so the global handler can process it.
   * @param error the unexpected error
   * @param notifyTelemetry if false, don't notify telemetry trackers. Use this for exceptions from third-party code, for example.
   */
  public static handle(error: any, notifyTelemetry = true): void {
    this._handler(error);
    if (notifyTelemetry)
      this._telemetry.forEach((telemetry) => {
        try { telemetry(error); } catch (_) { } // ignore errors from telemetry trackers
      });
  }

  /** establish a new global *unexpected error* handler.
   * @param handler the new global handler. You may provide your own function or use one of the static members of this class.
   * The default is [[errorLog]].
   * @returns the previous handler. Useful to temporarily change the handler.
   */
  public static setHandler(handler: OnUnexpectedError): OnUnexpectedError {
    const oldHandler = this._handler;
    this._handler = handler;
    return oldHandler;
  }
}
