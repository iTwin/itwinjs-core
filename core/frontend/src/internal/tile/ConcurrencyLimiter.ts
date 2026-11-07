/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tiles
 */

interface Waiter {
  resolve: () => void;
  reject: (error: Error) => void;
}

/** Runs asynchronous operations with at most `maxConcurrent` of them in progress at once. Operations beyond that wait in a queue and
 * start in the order they were requested.
 * A slot is held only while an operation's own promise is pending, so operations must not await other operations run by the same limiter,
 * or they can deadlock.
 * @internal
 */
export class ConcurrencyLimiter {
  private _numActive = 0;
  private _isDisposed = false;
  private readonly _queue: Waiter[] = [];

  public constructor(public readonly maxConcurrent: number) {
    if (!(maxConcurrent >= 1)) // Also rejects NaN.
      throw new Error("ConcurrencyLimiter requires maxConcurrent >= 1");
  }

  /** Run `operation` once a slot is free, and resolve or reject with its result.
   * @throws Error if the limiter is disposed before the operation starts.
   */
  public async run<T>(operation: () => Promise<T>): Promise<T> {
    if (this._isDisposed)
      throw new Error("ConcurrencyLimiter is disposed");

    if (this._numActive < this.maxConcurrent && 0 === this._queue.length) {
      ++this._numActive;
    } else {
      // A finishing operation hands its slot directly to the first waiter (see release), so an operation requested in the meantime cannot take it.
      await new Promise<void>((resolve, reject) => this._queue.push({ resolve, reject }));
    }

    try {
      return await operation();
    } finally {
      this.release();
    }
  }

  /** Reject every waiting operation without starting it, and refuse new ones. Operations already in progress run to completion. */
  public dispose(): void {
    if (this._isDisposed)
      return;

    this._isDisposed = true;
    const waiters = this._queue.splice(0);
    for (const waiter of waiters)
      waiter.reject(new Error("ConcurrencyLimiter is disposed"));
  }

  private release(): void {
    const next = this._queue.shift();
    if (next)
      next.resolve();
    else
      --this._numActive;
  }
}
