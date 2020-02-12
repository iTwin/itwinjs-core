/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Core
 */

import { Guid, IDisposable, GuidString } from "@bentley/bentleyjs-core";

/**
 * A helper to track ongoing async tasks. Usage:
 * ```
 * await using(tracker.trackAsyncTask(), async (_r) => {
 *   await doSomethingAsync();
 * });
 * ```
 * @internal
 */
export class AsyncTasksTracker {
  private _asyncsInProgress = new Set<GuidString>();
  public get pendingAsyncs() { return this._asyncsInProgress; }
  public trackAsyncTask(): IDisposable {
    const id = Guid.createValue();
    this._asyncsInProgress.add(id);
    return {
      dispose: () => this._asyncsInProgress.delete(id),
    };
  }
}
