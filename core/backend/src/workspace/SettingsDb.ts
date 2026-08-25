/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Workspace
 */

import type { WorkspaceDb, WorkspaceDbName } from "./Workspace";

/**
 * The fixed db name used by [[WorkspaceDb]]'s meant to hold settings.
 * [[Workspace.loadSettingsDictionary]] will treat rows in the 'strings' table as setting dictionary entries when [[WorkspaceDbSettingsProps.dbName]] matches this value.
 * @see [[Workspace.loadSettingsDictionary]]
 * @internal
 */
export const settingsWorkspaceDbName: WorkspaceDbName = "settings-db";

/** The db name type for the iTwin settings [[WorkspaceDb]].
 * @internal
 */
export type SettingsDbName = typeof settingsWorkspaceDbName;

/** A [[WorkspaceDb]] whose name is the fixed iTwin settings db name.
 * @internal
 */
export type SettingsDb = WorkspaceDb & { readonly dbName: SettingsDbName };

/** Return true if a [[WorkspaceDb]] is a [[SettingsDb]].
 * @internal
 */
export function isSettingsDb(db: WorkspaceDb): db is SettingsDb {
  return db.dbName === settingsWorkspaceDbName;
}

/** Query all string resource names from a [[SettingsDb]].
 * @internal
 */
export function queryStringResourceNames(db: SettingsDb): WorkspaceDbName[] {
  const resourceNames: string[] = [];
  db.queryResources({ type: "string", callback: (names) => { for (const n of names) resourceNames.push(n); } });
  return resourceNames;
}
