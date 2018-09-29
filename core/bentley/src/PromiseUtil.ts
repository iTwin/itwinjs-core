/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Utils */

export class BusyError extends Error {
  public static check(err: Error) {
    if (err instanceof BusyError || err.message === "abort") {
      // console.log("Busy error: " + err.message);
    } else {
      // console.log("re-throwing from BusyError");
      throw err; // unrecognized exception
    }
  }
}

/**
 * An object that returns a Promise when you call [[init]], but supplies a way to abort the promise if it is no longer relevant.
 * When you call abort, the promise will be rejected. You must supply a [[run]] method to the constructor that
 * creates the real Promise for the underlying action. Notice that to use this class there are really two
 * Promises involved that are chained together. That makes this class less efficient than just using a Promise directly.
 */
class PromiseWithAbort<T> {
  /** Method to abort the Promise created by [[init]] while it is outstanding. The promise will be rejected. */
  public abort!: () => void;
  private _resolve!: (val: any) => void;

  /** Create a PromiseWithAbort. After this call you must call [[init]] to create the underlying Promise.
   * @param _run The method that creates the underlying Promise.
   * @param _args An array of args to be passed to run when [[start]] is called.
   */
  constructor(private _run: (...args: any[]) => Promise<T>, private _args: any[]) { }

  /** Create a Promise that is chained to the underlying Promise, but is connected to the abort method. */
  public init(msg: string): Promise<T> { return new Promise<T>((resolve, reject) => { this.abort = () => reject(new BusyError(msg)); this._resolve = resolve; }); }

  /** Call the [[run]] method supplied to the ctor to start the underlying Promise. */
  public start() { this._run(this._args).then((val) => this._resolve(val)); }
}

/**
 * Orchestrator of a one-at-a-time Promise. This concept is useful only for *replaceable* operations (that is, operations where subsequent requests replace and obviate
 * the need for previous requests) over slow HTTP connections. In that case, without this class, the stream of requests can overwhelm the connection, and cause the HTTP
 * request queue to grow such that the delay to service new requests is unbounded.
 *
 * With this class, we issue the initial request immediately. When the second request arrives before the first one completes, it becomes *pending*. If subsequent
 * requests arrive with a pending request, the current pending request is *aborted* (its Promise is rejected) and the new request becomes pending.
 * When the active request completes, the pending request (if present) is started. In this manner there will only ever be one outstanding HTTP request for this type
 * of operation, but the last request will always eventually complete.
 *
 */
export class OneAtATimePromise<T> {
  private _active?: PromiseWithAbort<T>;
  private _pending?: PromiseWithAbort<T>;

  /** Ctor for OneAtATimePromise.
   * @param _msg A message to be passed to the constructor of [[BusyError]] when pending requests are aborted.
   * @param _run The method that performs an action that creates the Promise.
   */
  constructor(private _msg: string, private _run: (...args: any[]) => Promise<T>, private _allowPending = true) { }

  /** Add a new request to this OneAtATimePromise. The request will only run when no other outstanding requests are active.
   * @note Callers of this method *must* handle BusyError exceptions.
   */
  public async addRequest(...args: any[]) {
    const entry = new PromiseWithAbort<T>(this._run, args); // create an "abortable promise" object
    const promise = entry.init(this._msg); // create the Promise from PromiseWithAbort. Note: this must be called before we call start.

    if (this._active !== undefined) { // is there an active request?
      if (this._pending) // yes. If there is also a pending request, this one replaces it and previous one is aborted
        this._pending.abort(); // rejects previous call to this method, throwing BusyError.
      if (this._allowPending)
        this._pending = entry;
    } else {
      this._active = entry; // this is the first request, start it.
      entry.start();
    }

    await promise; // wait until we're finally completed
    this._active = this._pending; // see if there's a pending request waiting
    this._pending = undefined; // clear pending
    if (this._active)
      this._active.start(); // now start the pending request
    return promise; // return fulfilled promise
  }
}
