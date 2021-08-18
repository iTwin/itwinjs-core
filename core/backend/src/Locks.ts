/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import { LockProps } from "./BackendHubAccess";
import { BriefcaseDb } from "./IModelDb";
import { IModelHost } from "./IModelHost";

export class Locks {

  constructor(private _iModel: BriefcaseDb) {
  }

  public hasLock(_lock: LockProps): boolean {
    return false;
  }

  public async acquireLock(lock: LockProps): Promise<void> {
    if (!this.hasLock(lock))
      await IModelHost.hubAccess.acquireLocks(this._iModel, lock);
  }

}