/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { Guid, GuidString } from "@itwin/core-bentley";

/**
 * A helper to track ongoing async tasks. Usage:
 * ```
 * { 
 *   using _r = tracker.trackAsyncTask();
 *   await doSomethingAsync();
 * }
 * ```
 *
 * Can be used with `waitForPendingAsyncs` in test helpers to wait for all
 * async tasks to complete.
 *
 * @internal
 */
export class AsyncTasksTracker {
  private _asyncsInProgress = new Set<GuidString>();
  public get pendingAsyncs() {
    return this._asyncsInProgress;
  }
  public trackAsyncTask(): Disposable {
    const id = Guid.createValue();
    this._asyncsInProgress.add(id);
    return {
      [Symbol.dispose]: () => this._asyncsInProgress.delete(id),
    };
  }
}
