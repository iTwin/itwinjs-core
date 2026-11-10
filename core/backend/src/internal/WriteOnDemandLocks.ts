/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module iModels
 */

// SPIKE: lock control for a write-on-demand briefcase while it is read-only.

import { Id64Arg } from "@itwin/core-bentley";
import { LockControl } from "../LockControl";
import { _close, _elementWasCreated, _implementationProhibited, _releaseAllLocks } from "./Symbols";

/** The parts of BriefcaseDb that write-on-demand locks need. */
interface WriteOnDemandBriefcase {
  readonly locks: LockControl;
  makeWritable(): void;
}

/** A read-only write-on-demand briefcase holds no lock control of its own.
 * Asking for locks means the caller is about to write, so the briefcase switches to
 * read-write first, and the request goes to the lock control of the writable briefcase.
 */
class WriteOnDemandLocks implements LockControl {
  public readonly [_implementationProhibited] = undefined;

  public constructor(private readonly _briefcase: WriteOnDemandBriefcase) { }

  public get isServerBased() { return false; }
  public [_close](): void { }
  public clearAllLocks(): void { }
  public holdsExclusiveLock(): boolean { return false; }
  public holdsSharedLock(): boolean { return false; }
  public checkExclusiveLock(): void { }
  public checkSharedLock(): void { }
  public [_elementWasCreated](): void { }

  public async acquireLocks(arg: { shared?: Id64Arg, exclusive?: Id64Arg }): Promise<void> {
    return this.writableLocks().acquireLocks(arg);
  }

  public async [_releaseAllLocks](): Promise<void> {
    return this.writableLocks()[_releaseAllLocks]();
  }

  public async releaseAllLocks(): Promise<void> {
    return this.writableLocks().releaseAllLocks();
  }

  public async abandonAllLocks(): Promise<void> {
    return this.writableLocks().abandonAllLocks();
  }

  public async abandonLocksForReversedTxn(): Promise<boolean> { return false; }
  public async abandonLocksForCurrentUnsavedTxn(): Promise<boolean> { return false; }
  public async acquireLocksForReinstatingTxn(): Promise<boolean> { return false; }
  public holdsNecessaryLocksForReinstatingTxn(): boolean { return true; }
  public clearTxnLockRecords(): void { }

  private writableLocks(): LockControl {
    this._briefcase.makeWritable();
    return this._briefcase.locks;
  }
}

export function createWriteOnDemandLocks(briefcase: WriteOnDemandBriefcase): LockControl {
  return new WriteOnDemandLocks(briefcase);
}
