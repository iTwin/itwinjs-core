/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Workspace
 */

import { SQLiteDb, VersionedSqliteDb } from "../../SQLiteDb";
import { _nativeDb } from "../Symbols";
import { settingsManifestProperty } from "./SettingsDbImpl";

/** A [[VersionedSqliteDb]] that stores settings dictionaries. Unlike [[WorkspaceSqliteDb]], the
 * manifest is stored using [[settingsManifestProperty]] so that settings and workspace databases
 * can coexist in the same container without ambiguity.
 */
export class SettingsSqliteDb extends VersionedSqliteDb {
  public override myVersion = "1.0.0";
  public override getRequiredVersions(): SQLiteDb.RequiredVersionRanges {
    try {
      return super.getRequiredVersions();
    } catch {
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
      this[_nativeDb].saveFileProperty(settingsManifestProperty, JSON.stringify(args.manifest));
  }
}
