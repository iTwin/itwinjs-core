/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module iModels
 */

import { LockControl } from "../LockControl";
import { _close, _elementWasCreated, _implementationProhibited, _releaseAllLocks } from "./Symbols";

/** A null-implementation of LockControl that does not attempt to limit access between briefcases. This relies on change-merging to resolve conflicts. */
class NoLocks implements LockControl {
  public readonly [_implementationProhibited] = undefined;
  public get isServerBased() { return false; }
  public [_close](): void { }
  public clearAllLocks(): void { }
  public holdsExclusiveLock(): boolean { return false; }
  public holdsSharedLock(): boolean { return false; }
  public checkExclusiveLock(): void { }
  public checkSharedLock(): void { }
  public [_elementWasCreated](): void { }
  public async acquireLocks() { }
  public async [_releaseAllLocks](): Promise<void> { }
  public async releaseAllLocks(): Promise<void> { }
}

export function createNoOpLockControl(): LockControl {
  return new NoLocks();
}
