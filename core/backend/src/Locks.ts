/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module iModels
 */

import { DbResult, Id64String } from "@bentley/bentleyjs-core";
import { IModelError } from "@bentley/imodeljs-common";
import { LockProps } from "./BackendHubAccess";
import { BriefcaseDb } from "./IModelDb";
import { IModelHost } from "./IModelHost";

export class Locks {

  constructor(private _iModel: BriefcaseDb) {
  }

  private getParentAndModel(id: Id64String): { modelId: Id64String, parentId: Id64String } {
    return this._iModel.withPreparedSqliteStatement("SELECT ModelId,ParentId FROM bis_Element WHERE id=?", (stmt) => {
      stmt.bindId(1, id);
      const rc = stmt.step();
      if (DbResult.BE_SQLITE_ROW !== rc)
        throw new IModelError(rc, `element ${id} not found`);

      return { modelId: stmt.getValueId(0), parentId: stmt.getValueId(1) };
    });
  }

  public hasLock(_lock: LockProps): boolean {
    return false;
  }

  public async acquireLock(lock: LockProps): Promise<void> {
    if (!this.hasLock(lock))
      await IModelHost.hubAccess.acquireLocks(this._iModel, lock);
  }

}
