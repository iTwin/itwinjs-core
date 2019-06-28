/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Core */

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
