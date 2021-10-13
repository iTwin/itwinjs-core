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

  private static _listeners: OnUnexpectedError[] = [];
  private static _handler: OnUnexpectedError = this.errorLog; // default to error logging
  private constructor() { } // this is a singleton

  /** Add a "listener" for unexpected errors. This is useful for telemetry, for example.
   * @returns a method to remove the listener
   */
  public static addListener(listener: OnUnexpectedError): () => void {
    this._listeners.push(listener);
    return () => this._listeners.splice(this._listeners.indexOf(listener), 1);
  }

  /** call this method when an unexpected error happens so the global handler can process it */
  public static handle(e: any, noListeners?: true): void {
    this._handler(e);
    if (!noListeners)
      this._listeners.forEach((listener) => {
        try { listener(e); } catch (_) { } // ignore errors from listeners
      });
  }

  /** establish a new global *unexpected error* handler.
   * @param handler the new global handler. You may provide your own function or use one of the static members of this class.
   * The default is [[errorLog]].
   */
  public static setHandler(handler: OnUnexpectedError) {
    this._handler = handler;
  }

}
