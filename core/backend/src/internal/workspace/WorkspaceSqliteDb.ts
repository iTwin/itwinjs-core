/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Workspace
 */

import { SQLiteDb, VersionedSqliteDb } from "../../SQLiteDb";
import { _nativeDb } from "../Symbols";
import { workspaceManifestProperty } from "./WorkspaceImpl";

export class WorkspaceSqliteDb extends VersionedSqliteDb {
  public override myVersion = "1.0.0";
  public override getRequiredVersions(): SQLiteDb.RequiredVersionRanges {
    try {
      return super.getRequiredVersions();
    } catch (e) {
      // early versions didn't have a version range, but they're fine
      return { readVersion: "^1", writeVersion: "^1" };
    }
  }

  protected override createDDL(args: any): void {
    const timeStampCol = "lastMod TIMESTAMP NOT NULL DEFAULT(julianday('now'))";
    this.executeSQL(`CREATE TABLE strings(id TEXT PRIMARY KEY NOT NULL,value TEXT,${timeStampCol})`);
    this.executeSQL(`CREATE TABLE blobs(id TEXT PRIMARY KEY NOT NULL,value BLOB,${timeStampCol})`);
    const createTrigger = (tableName: string) => {
      this.executeSQL(`CREATE TRIGGER ${tableName}_timeStamp AFTER UPDATE ON ${tableName} WHEN old.lastMod=new.lastMod AND old.lastMod != julianday('now') BEGIN UPDATE ${tableName} SET lastMod=julianday('now') WHERE id=new.id; END`);
    };
    createTrigger("strings");
    createTrigger("blobs");
    if (args?.manifest)
      this[_nativeDb].saveFileProperty(workspaceManifestProperty, JSON.stringify(args.manifest));
  }
}

