/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Workspace
 */

import { SQLiteDb, VersionedSqliteDb } from "../../SQLiteDb";
import { SqliteError } from "@itwin/core-common";
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
    } catch (e) {
      if (SqliteError.isError(e, "invalid-versions-property"))
        return { readVersion: "^1", writeVersion: "^1" };
      throw e;
    }
  }

  protected override createDDL(args: any): void {
    const timeStampCol = "lastMod TIMESTAMP NOT NULL DEFAULT(julianday('now'))";
    this.executeSQL(`CREATE TABLE strings(id TEXT PRIMARY KEY NOT NULL,value TEXT,${timeStampCol})`);
    this.executeSQL(`CREATE TRIGGER strings_timeStamp AFTER UPDATE ON strings WHEN old.lastMod=new.lastMod AND old.lastMod != julianday('now') BEGIN UPDATE strings SET lastMod=julianday('now') WHERE id=new.id; END`);
    if (args?.manifest)
      this[_nativeDb].saveFileProperty(settingsManifestProperty, JSON.stringify(args.manifest));
  }
}
