/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utils
 */

/**
 * Wrapper function designed to be used for callbacks called by setInterval or setTimeout in order to propagate any
 * exceptions thrown in the callback to the main promise chain. It does this by creating a new promise for the callback
 * invocation and adding it to the timerPromises set. The main promise chain can then await
 * Promise.all(timerPromises) to catch any exceptions thrown in any of the callbacks. Note that if the callback
 * completes successfully, the promise is resolved and removed from the set. If it throws an exception, the promise is
 * rejected but not removed from the set, so that the main promise chain can detect that an error occurred and handle
 * it appropriately.
 * @param timerPromises A set of promises representing the currently active timer callbacks.
 * @param callback The async callback to be executed within the timer.
 * @beta
 */
export async function wrapTimerCallback(timerPromises: Set<Promise<void>>, callback: () => Promise<void>) {
  let resolvePromise: (() => void) | undefined;
  let rejectPromise: ((reason?: any) => void) | undefined;

  // The callback of the Promise constructor does not have access to the promise itself, so all we do there is
  // capture the resolve and reject functions for use in the async callback that would have otherwise been
  // placed in the setInterval or setTimeout callback.
  const timerPromise = new Promise<void>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  // Note: when we get here, resolvePromise and rejectPromise will always be defined, but there is no way to
  // convince TS of that fact without extra unnecessary checks, so we use ?. when accessing them.

  // Prevent unhandled rejection warnings. The rejection is still observable
  // when the consumer awaits Promise.all(promises).
  timerPromise.catch(() => {});

  timerPromises.add(timerPromise);

  const cleanupAndResolve = () => {
    resolvePromise?.();
    // No need to keep track of this promise anymore since it's resolved.
    timerPromises.delete(timerPromise);
  };

  try {
    await callback();
    cleanupAndResolve();
  } catch (err) {
    rejectPromise?.(err);
  }
}
