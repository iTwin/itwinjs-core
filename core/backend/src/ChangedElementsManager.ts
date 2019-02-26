/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { BriefcaseManager } from "./BriefcaseManager";
import { GuidString } from "@bentley/bentleyjs-core";
import { ChangedElements } from "@bentley/imodeljs-common";
import { ChangedElementsDb } from "./ChangedElementsDb";
import { IModelJsFs } from "./IModelJsFs";

interface ChangedElementsDbCacheEntry {
  iModelId: GuidString;
  db: ChangedElementsDb;
}

/** Utilities for querying changed elements caches */
export class ChangedElementsManager {
  /** Maintains a single entry since we will only have a cache per iModel, which means a ChangedElementsDb per backend instance */
  private static _entry: ChangedElementsDbCacheEntry | undefined;

  public static getChangedElementsPathName(iModelId: GuidString): string { return BriefcaseManager.getChangedElementsPathName(iModelId); }

  /** Get changed elements Db */
  private static getChangedElementsDb(iModelId: GuidString): ChangedElementsDb | undefined {
    if (this._entry && this._entry.iModelId === iModelId)
      return this._entry.db;
    if (this._entry && this._entry.iModelId !== iModelId) {
      this._entry.db.closeDb();
      this._entry = undefined;
    }
    if (!this._entry) {
      const path = ChangedElementsManager.getChangedElementsPathName(iModelId);
      if (!IModelJsFs.existsSync(path))
        return undefined;

      const db: ChangedElementsDb = ChangedElementsDb.openDb(path);
      this._entry = {
        iModelId,
        db,
      };

      return db;
    }

    return undefined;
  }

  /** Gets the changed elements from the cache if found
   * @param iModelId Id of the iModel
   * @param startChangesetId Start changeset Id
   * @param endChangesetId End changeset Id
   * @returns Changed elements if found
   */
  public static getChangedElements(iModelId: GuidString, startChangesetId: string, endChangesetId: string): ChangedElements | undefined {
    const db: ChangedElementsDb | undefined = ChangedElementsManager.getChangedElementsDb(iModelId);
    if (!db)
      return undefined;

    return db.getChangedElements(startChangesetId, endChangesetId);
  }

  /** Checks if the cache contains information about the changeset
   * @param iModelId Id of the iModel
   * @param changesetId Changeset to check for
   * @returns true if the changeset has been processed and exists in the cache
   */
  public static isProcessed(iModelId: GuidString, changesetId: string): boolean {
    const db: ChangedElementsDb | undefined = ChangedElementsManager.getChangedElementsDb(iModelId);
    if (!db)
      return false;

    return db.isProcessed(changesetId);
  }
}
