/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "./StartupShutdown"; // calls startup/shutdown IModelHost before/after all tests
import { expect } from "chai";
import * as fs from "fs-extra";
import { join } from "path";
import { IModelHost, IModelJsFs, SettingObject, Settings, StandaloneDb, Workspace, WorkspaceContainer, WorkspaceDb, WorkspaceResource } from "@itwin/core-backend";
import { assert, Guid } from "@itwin/core-bentley";
import { AzuriteTest } from "./AzuriteTest";

describe.only("Cloud workspace containers", () => {
  const iTwin1Id = Guid.createValue();
  const iTwin2Id = Guid.createValue();
  const iModel1 = Guid.createValue();
  let orgContainer: Workspace.Editor.Container;
  let itwin2Container: Workspace.Editor.Container;
  let branchContainer: Workspace.Editor.Container;
  let editor: Workspace.Editor;
  let orgContainerProps: WorkspaceContainer.Props;
  let branchContainerProps: WorkspaceContainer.Props;
  let itwin2ContainerProps: WorkspaceContainer.Props;
  let styles1: Workspace.Editor.Container;
  let styles2: Workspace.Editor.Container;

  const orgWsName = "all settings for org";
  const itwin2WsName = "all settings for itwin2";
  const iModelWsName = "all settings for imodel";

  before(async () => {
    IModelHost.authorizationClient = new AzuriteTest.AuthorizationClient();
    AzuriteTest.userToken = AzuriteTest.service.userToken.admin;
    editor = Workspace.constructEditor();
    orgContainer = await editor.createNewCloudContainer({ metadata: { label: "orgContainer1", description: "org workspace1" }, scope: { iTwinId: iTwin1Id }, manifest: { workspaceName: orgWsName } });
    itwin2Container = await editor.createNewCloudContainer({ metadata: { label: "orgContainer2", description: "org workspace2" }, scope: { iTwinId: iTwin2Id }, manifest: { workspaceName: itwin2WsName } });
    branchContainer = await editor.createNewCloudContainer({ metadata: { label: "iModel container", description: "imodel workspace" }, scope: { iTwinId: iTwin2Id, iModelId: iModel1 }, manifest: { workspaceName: iModelWsName } });
    styles1 = await editor.createNewCloudContainer({ metadata: { label: "styles 1 container", description: "styles definitions 1" }, scope: { iTwinId: iTwin1Id }, manifest: { workspaceName: "styles 1 ws" } });
    styles2 = await editor.createNewCloudContainer({ metadata: { label: "styles 2 container", description: "styles definitions 2" }, scope: { iTwinId: iTwin1Id }, manifest: { workspaceName: "styles 2 ws" } });
    AzuriteTest.userToken = AzuriteTest.service.userToken.readWrite;

    itwin2ContainerProps = itwin2Container.cloudProps!;
    orgContainerProps = orgContainer.cloudProps!;
    branchContainerProps = branchContainer.cloudProps!;

    assert(itwin2ContainerProps !== undefined);
    assert(orgContainerProps !== undefined);
    assert(branchContainerProps !== undefined);
  });
  after(async () => {
    editor.close();
    IModelHost.authorizationClient = undefined;
  });

  it.only("edit cloud workspace", async () => {
    let user: string;
    const makeVersion = async (args: Workspace.Editor.Container.MakeNewVersionProps) => {
      expect(orgContainer.cloudContainer).not.undefined;
      orgContainer.acquireWriteLock(user);
      const copied = await orgContainer.makeNewVersion(args);

      const wsDbEdit = orgContainer.getEditableDb(copied.newDb);
      wsDbEdit.open();
      wsDbEdit.updateString("myVersion", wsDbEdit.version);
      wsDbEdit.updateString("string 1", "value of string 1");
      wsDbEdit.close();
      orgContainer.releaseWriteLock();
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
    orgContainer.acquireWriteLock(user);

    newVer = await orgContainer.makeNewVersion({ versionType: "patch" });
    const editDb = orgContainer.getEditableDb(newVer.newDb);

    editDb.open();
    expect(editDb.getString("myVersion")).equal("2.0.0"); // the patch is from 2.0.0, but we didn't update this string so its value is still from previous version.
    expect(editDb.manifest.lastEditedBy).equal("admin1");
    expect(editDb.manifest.workspaceName).equal(orgWsName);
    editDb.updateString("string 1", "new string 1");
    editDb.close();
    orgContainer.abandonChanges();

    // after abandoning changes, the patch version we just made is gone
    expect(() => orgContainer.getEditableDb(newVer.newDb)).throws("No version of 'workspace-db' available");

    // make sure we can read the workspace from another CloudCache
    const wsDb = await IModelHost.appWorkspace.getWorkspaceDb({ ...orgContainerProps, version: "~2.0" });
    expect(wsDb.manifest.workspaceName).equal(orgWsName);
    expect(wsDb.getString("myVersion")).equal("2.0.0");
  });

  const withPatchVersion = async (container: Workspace.Editor.Container, fn: (db: Workspace.Editor.EditableDb) => void) => {
    container.acquireWriteLock("admin3");
    const copied = await container.makeNewVersion({ versionType: "patch" });
    const editDb = container.getEditableDb(copied.newDb);
    editDb.open();
    fn(editDb);
    editDb.close();
    container.releaseWriteLock();
  };

  it.only("Edit Settings and Workspaces", async () => {
    const tmpdir = join(__dirname, "output", "settingsTest");
    IModelJsFs.recursiveMkDirSync(tmpdir);
    fs.emptyDirSync(tmpdir);

    const fileName = join(tmpdir, "settings.bim");
    const imodel = StandaloneDb.createEmpty(fileName, {
      rootSubject: { name: "settings resource tests" },
      globalOrigin: { x: 0, y: 0 },
      projectExtents: { low: { x: -500, y: -500, z: -50 }, high: { x: 500, y: 500, z: 50 } },
    });

    const settingsWorkspaces = {
      ...branchContainerProps,
      priority: Settings.Priority.branch,
    };

    const imodelSettings: SettingObject = {};
    imodelSettings[Workspace.settingName.settingsWorkspaces] = [settingsWorkspaces];
    imodelSettings["app1/max1"] = 100;
    imodel.saveSettingDictionary("Dict2", imodelSettings);
    imodel.close();

    let errors: WorkspaceDb.LoadErrors | undefined;
    const loadedDictionaries: Workspace.SettingsDictionaryLoaded[] = [];
    const resetErrors = () => errors = undefined;
    Workspace.exceptionDiagnosticFn = (e: WorkspaceDb.LoadErrors) => errors = e;
    Workspace.onSettingsDictionaryLoadedFn = (dict: Workspace.SettingsDictionaryLoaded) => loadedDictionaries.push(dict);

    let imodel2 = await StandaloneDb.open({ fileName });
    imodel2.close();
    assert(errors !== undefined);
    expect(errors.message).contains("settings resource tests");
    let loadErrors = errors.wsLoadErrors;
    assert(loadErrors !== undefined);
    expect(loadErrors.length).equal(1);
    expect(loadErrors[0].wsDb?.version).equal("1.0.0");

    await withPatchVersion(branchContainer, (editDb) => {
      const iModelWsSettings: SettingObject = {};
      iModelWsSettings["app1/max1"] = 10;
      iModelWsSettings["app1/max2"] = 20;
      iModelWsSettings[Workspace.settingName.settingsWorkspaces] = [{ ...itwin2ContainerProps, priority: Settings.Priority.iTwin }];
      editDb.updateSettingsResource(iModelWsSettings);
    });

    const c1 = await IModelHost.appWorkspace.getContainerAsync(branchContainerProps);
    assert(c1.cloudContainer !== undefined);
    c1.cloudContainer.checkForChanges();

    resetErrors();
    loadedDictionaries.length = 0;
    imodel2 = await StandaloneDb.open({ fileName });
    imodel2.close();
    expect(loadedDictionaries.length).equal(1);
    expect(loadedDictionaries[0].from.manifest.workspaceName).equal(iModelWsName);
    expect(loadedDictionaries[0].from.version).equal("1.0.1");

    assert(errors !== undefined);
    expect(errors.message).contains("settings resource tests");
    loadErrors = errors.wsLoadErrors;
    assert(loadErrors !== undefined);
    expect(loadErrors.length).equal(1);
    expect(loadErrors[0].wsDb?.version).equal("1.0.0");
    expect(loadErrors[0].message).contains(itwin2WsName);

    await withPatchVersion(itwin2Container, (editDb) => {
      const iTwin2WsSettings: SettingObject = {};
      iTwin2WsSettings["app1/max1"] = 1;
      iTwin2WsSettings["app1/max2"] = 2;
      iTwin2WsSettings["app1/max3"] = 3;
      editDb.updateSettingsResource(iTwin2WsSettings);
    });
    resetErrors();
    loadedDictionaries.length = 0;
    imodel2 = await StandaloneDb.open({ fileName });
    expect(loadedDictionaries.length).equal(2);
    expect(loadedDictionaries[1].from.version).equal("1.0.1");

    // test loading settings from containers and iModel
    const settings = imodel2.workspace.settings;
    expect(settings.dictionaries.length).equal(3);
    expect(settings.getNumber("app1/max1")).equal(100); // resolved from settings stored in iModel
    expect(settings.getNumber("app1/max2")).equal(20); // resolved from branch container, found from iModel settings
    expect(settings.getNumber("app1/max3")).equal(3); // resolved from iTwin container, found from resource in branch container

    const defineStyles = (editDb: Workspace.Editor.EditableDb, prefix: string, bias: number) => {
      for (let i = 0; i < 10; ++i) {
        const styleName = `styles/num-${i}`;
        editDb.updateString(styleName, `${prefix}/value ${i}`);
        editDb.updateBlob(styleName, new Uint8Array([i + bias]));
      }
    };

    await withPatchVersion(styles1, (editDb) => {
      defineStyles(editDb, "batch1", 100);
    });
    await withPatchVersion(styles2, (editDb) => {
      defineStyles(editDb, "batch2", 200);
    });

    const db1 = await imodel2.workspace.getWorkspaceDb(styles1.cloudProps!);
    const styles: string[] = [];
    const globSearch: WorkspaceResource.Search = { nameSearch: "styles/*", nameCompare: "GLOB" };
    Workspace.queryStringResource(db1, globSearch, (result) => {
      styles.push(result.rscName);
    });
    expect(styles.length).equal(10);
    styles.length = 0;
    Workspace.queryBlobResource(db1, globSearch, (result) => {
      styles.push(result.rscName);
    });
    expect(styles.length).equal(10);

    styles.length = 0;
    const db2 = await imodel2.workspace.getWorkspaceDb(styles2.cloudProps!);
    Workspace.queryStringResource([db1, db2], globSearch, (result) => {
      styles.push(result.rscName);
    });
    expect(styles.length).equal(20);
    const testStyle = "styles/num-0";
    expect(Workspace.loadStringResource([db1, db2], testStyle)).equal("batch1/value 0");
    expect(Workspace.loadStringResource([db2, db1], testStyle)).equal("batch2/value 0");
    expect(Workspace.loadBlobResource([db1, db2], testStyle)).deep.equal(new Uint8Array([100]));
    expect(Workspace.loadBlobResource([db2, db1], testStyle)).deep.equal(new Uint8Array([200]));

    styles.length = 0;
    Workspace.queryStringResource([db1, db2], { nameSearch: "styles/num-1" }, (result) => {
      styles.push(result.rscName);
    });
    expect(styles.length).equal(2);

    imodel2.close();
  });

});

