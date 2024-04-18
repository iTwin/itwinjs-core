/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "./StartupShutdown"; // calls startup/shutdown IModelHost before/after all tests
import { expect } from "chai";
import * as fs from "fs-extra";
import { join } from "path";
import { IModelHost, IModelJsFs, SettingObject, Settings, StandaloneDb, Workspace, WorkspaceContainer, WorkspaceDb, WorkspaceSettings } from "@itwin/core-backend";
import { assert, Guid } from "@itwin/core-bentley";
import { AzuriteTest } from "./AzuriteTest";

describe.only("Cloud workspace containers", () => {
  const iTwin1Id = Guid.createValue();
  const iTwin2Id = Guid.createValue();
  const iModel1 = Guid.createValue();
  let orgContainer: Workspace.Editor.Container;
  let itwin2Container: Workspace.Editor.Container;
  let iModelContainer: Workspace.Editor.Container;
  let editor: Workspace.Editor;
  let orgContainerProps: WorkspaceContainer.Props;
  let iModelContainerProps: WorkspaceContainer.Props;
  let itwin2ContainerProps: WorkspaceContainer.Props;

  before(async () => {
    IModelHost.authorizationClient = new AzuriteTest.AuthorizationClient();
    AzuriteTest.userToken = AzuriteTest.service.userToken.admin;
    editor = Workspace.constructEditor();
    orgContainer = await editor.createNewCloudContainer({ metadata: { label: "orgContainer1", description: "org workspace1" }, scope: { iTwinId: iTwin1Id }, manifest: { workspaceName: "all settings for itwin1" } });
    itwin2Container = await editor.createNewCloudContainer({ metadata: { label: "orgContainer2", description: "org workspace2" }, scope: { iTwinId: iTwin2Id }, manifest: { workspaceName: "all settings for itwin2" } });
    iModelContainer = await editor.createNewCloudContainer({ metadata: { label: "iModel container", description: "imodel workspace" }, scope: { iTwinId: iTwin2Id, iModelId: iModel1 }, manifest: { workspaceName: "all settings for imodel" } });
    AzuriteTest.userToken = AzuriteTest.service.userToken.readWrite;

    itwin2ContainerProps = itwin2Container.cloudProps!;
    orgContainerProps = orgContainer.cloudProps!;
    iModelContainerProps = iModelContainer.cloudProps!;

    assert(itwin2ContainerProps !== undefined);
    assert(orgContainerProps !== undefined);
    assert(iModelContainerProps !== undefined);
  });
  after(async () => {
    IModelHost.authorizationClient = undefined;
    editor.close();
  });

  it("edit cloud workspace", async () => {
    let user: string;
    const makeVersion = async (args: Workspace.Editor.Container.MakeNewVersionProps) => {
      expect(itwin2Container.cloudContainer).not.undefined;
      itwin2Container.acquireWriteLock(user);
      const copied = await itwin2Container.makeNewVersion(args);

      const wsDbEdit = itwin2Container.getEditableDb(copied.newDb);
      wsDbEdit.open();
      wsDbEdit.updateString("myVersion", wsDbEdit.dbFileName.split(":")[1]);
      wsDbEdit.updateString("string 1", "value of string 1");
      wsDbEdit.close();
      itwin2Container.releaseWriteLock();
      return copied;
    };

    user = "admin1";
    expect((await makeVersion({ versionType: "patch" })).newDb.version).equals("1.0.1");
    expect((await makeVersion({ versionType: "patch" })).newDb.version).equals("1.0.2");
    let newVer = await makeVersion({ versionType: "minor" });
    expect(newVer.oldDb.version).equal("1.0.2");
    expect(newVer.newDb.version).equal("1.1.0");

    // make a patch to an older version
    newVer = await makeVersion({ fromProps: { version: "1.0" }, versionType: "patch" });
    expect(newVer.oldDb.version).equal("1.0.2");
    expect(newVer.newDb.version).equal("1.0.3");
    newVer = await makeVersion({ fromProps: { version: "^1" }, versionType: "patch" });
    expect(newVer.oldDb.version).equal("1.1.0");
    expect(newVer.newDb.version).equal("1.1.1");

    newVer = await makeVersion({ fromProps: { version: "~1.0" }, versionType: "major" });
    expect(newVer.oldDb.version).equal("1.0.3");
    expect(newVer.newDb.version).equal("2.0.0");

    newVer = await makeVersion({ fromProps: { version: "~2.0" }, versionType: "premajor", identifier: "beta" });
    expect(newVer.oldDb.version).equal("2.0.0");
    expect(newVer.newDb.version).equal("3.0.0-beta.0");

    user = "admin2";
    itwin2Container.acquireWriteLock(user);

    newVer = await itwin2Container.makeNewVersion({ versionType: "patch" });
    const editDb = itwin2Container.getEditableDb(newVer.newDb);

    editDb.open();
    expect(editDb.getString("myVersion")).equal("2.0.0"); // the patch is from 2.0.0, but we didn't update this string so its value is still from previous version.
    expect(editDb.manifest.lastEditedBy).equal("admin1");
    expect(editDb.manifest.workspaceName).equal("all settings for itwin2");
    editDb.updateString("string 1", "new string 1");
    editDb.close();
    itwin2Container.abandonChanges();

    // after abandoning changes, the patch version we just made is gone
    expect(() => itwin2Container.getEditableDb(newVer.newDb)).throws("No version of [workspace-db] available");

    // make sure we can read the workspace from another CloudCache
    const wsDb = await IModelHost.appWorkspace.getWorkspaceDb({ ...itwin2ContainerProps, version: "~2.0" });
    expect(wsDb.manifest.workspaceName).equal("all settings for itwin2");
    expect(wsDb.getString("myVersion")).equal("2.0.0");
  });

  it.only("Settings Workspaces", async () => {
    const tmpdir = join(__dirname, "output", "settingsTest");
    IModelJsFs.recursiveMkDirSync(tmpdir);
    fs.emptyDirSync(tmpdir);

    const fileName = join(tmpdir, "settings.bim");
    const imodel = StandaloneDb.createEmpty(fileName, {
      rootSubject: { name: "settings resource tests" },
      globalOrigin: { x: 0, y: 0 },
      projectExtents: { low: { x: -500, y: -500, z: -50 }, high: { x: 500, y: 500, z: 50 } },
    });

    const settingsWorkspaces: WorkspaceSettings.Props = {
      ...iModelContainerProps,
      resourceName: "settingsDictionary",
      priority: Settings.Priority.iModel,
    };

    const imodelSettings: SettingObject = {};
    imodelSettings[Workspace.settingName.settingsWorkspaces] = [settingsWorkspaces];

    imodel.saveSettingDictionary("Dict2", imodelSettings);
    imodel.close();

    const errors: WorkspaceDb.LoadErrors[] = [];
    const loadedDictionaries: Workspace.SettingsDictionaryLoaded[] = [];
    Workspace.exceptionDiagnosticFn = (e: any) => errors.push(e);
    Workspace.onSettingsDictionaryLoadedFn = (dict: Workspace.SettingsDictionaryLoaded) => loadedDictionaries.push(dict);

    let imodel2 = await StandaloneDb.open({ fileName });
    imodel2.close();
    expect(errors.length).equal(1);
    expect(errors[0].message).contains("settings resource tests");
    expect(errors[0].wsLoadErrors?.length).equal(1);
    expect(errors[0].wsLoadErrors?.[0].wsDb?.dbFileName).contains("1.0.0");

    iModelContainer.acquireWriteLock("admin3");
    const copied = await iModelContainer.makeNewVersion({ versionType: "patch" });
    // somehow, it should not be possible to edit a db after it's been published.
    const editDb = iModelContainer.getEditableDb(copied.newDb);
    editDb.open();
    const iModelWsSettings: SettingObject = {};
    iModelWsSettings["app1/maxVal"] = 10;
    iModelWsSettings[Workspace.settingName.settingsWorkspaces] = [{ ...itwin2ContainerProps, priority: Settings.Priority.iTwin }];
    editDb.updateString("settingsDictionary", JSON.stringify(iModelWsSettings));
    editDb.close();
    iModelContainer.releaseWriteLock();
    const c1 = IModelHost.appWorkspace.getContainer(iModelContainerProps);
    c1.cloudContainer?.checkForChanges();

    errors.length = 0;
    loadedDictionaries.length = 0;
    imodel2 = await StandaloneDb.open({ fileName });
    imodel2.close();
    expect(loadedDictionaries.length).equal(1);
  });

});

