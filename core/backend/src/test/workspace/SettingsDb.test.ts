/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { isSettingsDb, queryStringResourceNames, type SettingsDb, type SettingsDbName, settingsWorkspaceDbName } from "../../workspace/SettingsDb";
import type { WorkspaceDb } from "../../workspace/Workspace";

describe("SettingsDb", () => {
  it("exports the fixed settings workspace db name", () => {
    expect(settingsWorkspaceDbName).to.equal("settings-db");
  });

  it("SettingsDbName matches the runtime constant literal", () => {
    const typedName: SettingsDbName = settingsWorkspaceDbName;
    expect(typedName).to.equal(settingsWorkspaceDbName);
  });

  it("SettingsDb constrains dbName to SettingsDbName", () => {
    const workspaceDb = {
      dbName: settingsWorkspaceDbName,
    } as unknown as WorkspaceDb;

    const settingsDb = workspaceDb as SettingsDb;
    const typedName: SettingsDbName = settingsDb.dbName;
    expect(typedName).to.equal(settingsWorkspaceDbName);
  });

  it("isSettingsDb returns true only for settings db name", () => {
    const settingsDb = { dbName: settingsWorkspaceDbName } as unknown as WorkspaceDb;
    const nonSettingsDb = { dbName: "workspace-db" } as unknown as WorkspaceDb;

    expect(isSettingsDb(settingsDb)).to.equal(true);
    expect(isSettingsDb(nonSettingsDb)).to.equal(false);
  });

  it("queryStringResourceNames returns all string resource names", () => {
    const settingsDb = {
      dbName: settingsWorkspaceDbName,
      queryResources: ({ callback }: { callback: (names: Iterable<string>) => void }) => callback(["a", "b", "c"]),
    } as unknown as SettingsDb;

    expect(queryStringResourceNames(settingsDb)).to.deep.equal(["a", "b", "c"]);
  });
});
