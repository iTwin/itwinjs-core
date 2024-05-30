/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import "./StartupShutdown"; // calls startup/shutdown IModelHost before/after all tests
import { expect } from "chai";
import * as fs from "fs-extra";
import { join } from "path";
import {
    CreateNewWorkspaceDbVersionProps,
  EditableWorkspaceContainer, EditableWorkspaceDb, IModelHost, IModelJsFs, SettingsContainer, SettingsPriority, StandaloneDb, Workspace, WorkspaceContainerProps, 
  WorkspaceDbCloudProps, 
  WorkspaceDbLoadError, 
  WorkspaceDbLoadErrors, 
  WorkspaceDbQueryResourcesArgs, WorkspaceEditor, getWorkspaceBlob, getWorkspaceString, queryWorkspaceResources,
} from "@itwin/core-backend";
import { assert, Guid } from "@itwin/core-bentley";
import { AzuriteTest } from "./AzuriteTest";

// cspell:ignore premajor

describe("Cloud workspace containers", () => {
  const iTwin1Id = Guid.createValue();
  const iTwin2Id = Guid.createValue();
  const iModel1 = Guid.createValue();
  let orgContainer: EditableWorkspaceContainer;
  let itwin2Container: EditableWorkspaceContainer;
  let branchContainer: EditableWorkspaceContainer;
  let editor: WorkspaceEditor;
  let orgContainerProps: WorkspaceContainerProps;
  let branchContainerProps: WorkspaceContainerProps;
  let itwin2ContainerProps: WorkspaceContainerProps;
  let styles1: EditableWorkspaceContainer;
  let styles2: EditableWorkspaceContainer;

  const orgWsName = "all settings for org";
  const itwin2WsName = "all settings for itwin2";
  const iModelWsName = "all settings for imodel";

  before(async () => {
    IModelHost.settingsSchemas.addGroup({
      description: "settings for test app 1",
      schemaPrefix: "app1/styles",
      settingDefs: {
        textStyleDbs: {
          type: "array",
          description: "array of app1 text styles",
          extends: "itwin/core/workspaces/workspaceDbList",
          combineArray: true,
        },
        lineStyleDbs: {
          type: "array",
          description: "array of app1 line styles",
          extends: "itwin/core/workspaces/workspaceDbList",
          combineArray: true,
        },
      },
    });

    IModelHost.authorizationClient = new AzuriteTest.AuthorizationClient();
    AzuriteTest.userToken = AzuriteTest.service.userToken.admin;
    editor = WorkspaceEditor.construct();
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

  it("edit cloud workspace", async () => {
    let user: string;
    const makeVersion = async (args: CreateNewWorkspaceDbVersionProps) => {
      expect(orgContainer.cloudContainer).not.undefined;
      orgContainer.acquireWriteLock(user);
      const copied = await orgContainer.createNewWorkspaceDbVersion(args);

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

    newVer = await orgContainer.createNewWorkspaceDbVersion({ versionType: "patch" });
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

  const withPatchVersion = async (container: EditableWorkspaceContainer, fn: (db: EditableWorkspaceDb) => void) => {
    container.acquireWriteLock("admin3");
    const copied = await container.createNewWorkspaceDbVersion({ versionType: "patch" });
    const editDb = container.getEditableDb(copied.newDb);
    editDb.open();
    fn(editDb);
    editDb.sqliteDb.vacuum();
    editDb.close();
    container.releaseWriteLock();
  };

  it("Edit Settings and Workspaces", async () => {
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
      priority: SettingsPriority.branch,
    };

    const imodelSettings: SettingsContainer = {};
    imodelSettings[Workspace.settingName.settingsWorkspaces] = [settingsWorkspaces];
    imodelSettings["app1/max1"] = 100;
    imodel.saveSettingDictionary("Dict2", imodelSettings);
    imodel.close();

    let errors: WorkspaceDbLoadErrors | undefined;
    const loadedDictionaries: Workspace.SettingsDictionaryLoaded[] = [];
    const resetErrors = () => errors = undefined;
    Workspace.exceptionDiagnosticFn = (e: WorkspaceDbLoadErrors) => errors = e;
    Workspace.onSettingsDictionaryLoadedFn = (dict: Workspace.SettingsDictionaryLoaded) => loadedDictionaries.push(dict);

    const appSettings: SettingsContainer = {};
    appSettings["app1/styles/lineStyleDbs"] = [{ ...orgContainerProps!, loadingHelp: "see org admin for access to org ws", description: "org workspace", version: "^1" }];
    IModelHost.appWorkspace.settings.addDictionary({ name: "app settings", priority: SettingsPriority.application }, appSettings);

    let imodel2 = await StandaloneDb.open({ fileName });
    imodel2.close();
    assert(errors !== undefined);
    expect(errors.message).contains("settings resource tests");
    let loadErrors = errors.wsLoadErrors;
    assert(loadErrors !== undefined);
    expect(loadErrors.length).equal(1);
    expect(loadErrors[0].wsDb?.version).equal("1.0.0");

    const style1Props: WorkspaceDbCloudProps = { ...styles1.cloudProps!, loadingHelp: "see admin1 for access to style1 workspace", description: "styles 1", version: "^1", prefetch: true };
    const style2Props: WorkspaceDbCloudProps = { ...styles2.cloudProps!, loadingHelp: "see admin2 for access to style2 workspace", description: "styles 2", version: "^1" };
    const style3Props: WorkspaceDbCloudProps = { ...styles2.cloudProps!, containerId: "not there", loadingHelp: "see admin2 for access to style3 workspace", description: "more text styles for branch", version: "^1" };
    await withPatchVersion(branchContainer, (editDb) => {
      const branchSettings: SettingsContainer = {};
      branchSettings["app1/max1"] = 10;
      branchSettings["app1/max2"] = 20;
      branchSettings["app1/styles/lineStyleDbs"] = [style1Props, style3Props]; // style3 purposely causes a load error
      branchSettings["app1/styles/textStyleDbs"] = [style2Props];
      branchSettings[Workspace.settingName.settingsWorkspaces] = [{ ...itwin2ContainerProps, priority: SettingsPriority.iTwin }];

      editDb.updateSettingsResource(branchSettings);
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
      const iTwin2WsSettings: SettingsContainer = {};
      iTwin2WsSettings["app1/max1"] = 1;
      iTwin2WsSettings["app1/max2"] = 2;
      iTwin2WsSettings["app1/max3"] = 3;
      iTwin2WsSettings["app1/styles/lineStyleDbs"] = [style2Props];
      iTwin2WsSettings["app1/styles/textStyleDbs"] = [style1Props, style2Props]; // style2 is redundant with branch
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

    const defineStyles = (editDb: EditableWorkspaceDb, prefix: string, bias: number) => {
      for (let i = 0; i < 10; ++i) {
        const thisName = `styles/num-${i}`;
        editDb.updateString(thisName, `${prefix}/value ${i}`);
        editDb.updateBlob(thisName, new Uint8Array([i + bias]));
      }
    };

    await withPatchVersion(styles1, (editDb) => defineStyles(editDb, "batch1", 100));
    await withPatchVersion(styles2, (editDb) => defineStyles(editDb, "batch2", 200));

    const textDbProps = imodel2.workspace.resolveWorkspaceDbSetting("app1/styles/textStyleDbs");
    expect(textDbProps.length).equal(3);
    const lineStyleDbProps = imodel2.workspace.resolveWorkspaceDbSetting("app1/styles/lineStyleDbs");
    expect(lineStyleDbProps.length).equal(4);

    const problems: WorkspaceDbLoadError[] = [];
    let textDbs = await imodel2.workspace.getWorkspaceDbs({ settingName: "app1/styles/textStyleDbs", problems });
    expect(textDbs.length).equal(2);
    expect(problems.length).equal(0);
    textDbs = await imodel2.workspace.getWorkspaceDbs({ dbs: textDbProps, problems });
    expect(textDbs.length).equal(2);
    expect(problems.length).equal(0);

    problems.length = 0;
    let lineStyleDbs = await imodel2.workspace.getWorkspaceDbs({
      settingName: "app1/styles/lineStyleDbs", problems, filter: (_dbProps, dict) => {
        return (dict.props.priority === SettingsPriority.branch as number);
      },
    });
    expect(lineStyleDbs.length).equal(1);
    expect(lineStyleDbs[0].manifest.workspaceName).equal("styles 1 ws");

    problems.length = 0;

    lineStyleDbs = await imodel2.workspace.getWorkspaceDbs({ settingName: "app1/styles/lineStyleDbs", problems });
    expect(lineStyleDbs.length).equal(3);
    expect(problems.length).equal(1);
    expect(problems[0].wsDbProps?.loadingHelp).contains("for access to style3");

    let found: string[] = [];
    const globSearch: WorkspaceDbQueryResourcesArgs = {
      namePattern: "styles/*",
      nameCompare: "GLOB",
      callback: (names) => found = Array.from(names),
      type: "string",
    };
    textDbs[0].queryResources(globSearch);
    expect(found.length).equal(10);

    found.length = 0;
    globSearch.type = "blob";
    textDbs[0].queryResources(globSearch);
    expect(found.length).equal(10);

    found.length = 0;
    queryWorkspaceResources({
      ...globSearch,
      type: "string",
      dbs: textDbs,
      callback: (resources) => found = Array.from(resources).map((x) => x.name),
    });
    expect(found.length).equal(20);

    // Note: the order of the two style WorkspaceDbs is reversed in the text vs. line style settings so
    // we should find different values for the same name depending on which list we use
    const styleName = "styles/num-0";
    expect(getWorkspaceString({ dbs: lineStyleDbs, name: styleName })).equal("batch1/value 0");
    expect(getWorkspaceString({ dbs: textDbs, name: styleName })).equal("batch2/value 0");
    expect(getWorkspaceBlob({ dbs: lineStyleDbs, name: styleName })).deep.equal(new Uint8Array([100]));
    expect(getWorkspaceBlob({ dbs: textDbs, name: styleName })).deep.equal(new Uint8Array([200]));

    // get a value from org workspace specified at "app priority" (lowest) in appSetting for "app1/styles/linestyleDbs"
    expect(getWorkspaceString({ dbs: lineStyleDbs, name: "string 1" })).equal("value of string 1");

    found.length = 0;
    queryWorkspaceResources({
      dbs: textDbs,
      namePattern: "styles/num-1",
      type: "string",
      callback: (results) => found = Array.from(results).map((x) => x.name),
    });
    expect(found.length).equal(2);

    found.length = 0;
    queryWorkspaceResources({
      dbs: lineStyleDbs,
      namePattern: "styles/num-1",
      type: "string",
      callback: (results) => {
        for (const result of results) {
          found.push(result.name);
          break;
        }
      },
    });
    expect(found.length).equal(1); // aborted after first entry

    imodel2.close();
  });

});

