/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utils
 */

/**
 * Type of method to unlock the held mutex
 * @see [[AsyncMutex]]
 * @alpha
 */
export type AsyncMutexUnlockFnType = () => void;

/**
 * Utility to ensure a block of async code executes atomically.
 * Even if JavaScript precludes the possibility of race conditions between threads, there is potential for
 * race conditions with async code. This utility is needed in cases where a block of async code needs to run
 * to completion before another block is started.
 * This utility was based on this article: https://spin.atomicobject.com/2018/09/10/javascript-concurrency/
 * @alpha
 */
export class AsyncMutex {
  private _mutex = Promise.resolve();

  /**
   * Await the return value to setup a lock. The return value
   * is also the unlock function that can be called to unlock
   * the mutex.
   */
  public async lock(): Promise<AsyncMutexUnlockFnType> {
    /**
     * Note: The promise returned by this method will resolve (with the unlock function, which is actually the
     * mutex’s then’s resolve function) once any previous mutexes have finished and called their
     * respective unlock function that was yielded over their promise.
     */
    let begin: (unlock: AsyncMutexUnlockFnType) => void = (_unlock) => { };

    this._mutex = this._mutex.then(async (): Promise<void> => {
      return new Promise(begin);
    });

    return new Promise((res) => {
      begin = res;
    });
  }
}
