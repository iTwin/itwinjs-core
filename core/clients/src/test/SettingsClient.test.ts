/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import { ConnectClient } from "../ConnectClients";
import { ConnectSettingsClient } from "../SettingsClient";
import { SettingsStatus, SettingsResult } from "../SettingsAdmin";
import { AuthorizationToken, AccessToken } from "../Token";
import { TestConfig, TestUsers } from "./TestConfig";
import { ActivityLoggingContext } from "@bentley/bentleyjs-core";

// compare simple arrays
function arraysEqual(array1: any, array2: any) {
  if (!array1 || !array2)
    return false;
  if (!(array1 instanceof Array) || !(array2 instanceof Array))
    return false;
  if (array1.length !== array2.length)
    return false;
  for (let index: number = 0; index < array1.length; index++) {
    if (array1[index] !== array2[index])
      return false;
  }
  return true;
}

chai.should();

describe("ConnectSettingsClient-User", () => {
  let accessToken: AccessToken;
  let authToken: AuthorizationToken;
  let projectId: string;
  let iModelId: string;
  let connectClient: ConnectClient;
  let settingsClient: ConnectSettingsClient;
  const actx = new ActivityLoggingContext("");

  before(async function (this: Mocha.IHookCallbackContext) {
    if (TestConfig.enableMocks)
      return;

    TestConfig.deploymentEnv = "DEV";
    connectClient = new ConnectClient(TestConfig.deploymentEnv);
    settingsClient = new ConnectSettingsClient(TestConfig.deploymentEnv, "1001");
    authToken = await TestConfig.login();
    accessToken = await connectClient.getAccessToken(actx, authToken);

    const { project, iModel } = await TestConfig.queryTestCase(accessToken, TestConfig.deploymentEnv, TestConfig.projectName, "test");

    projectId = project.wsgId;
    chai.expect(projectId);

    iModelId = iModel!.wsgId;
    chai.expect(iModelId);

  });

  it("should setup its URLs", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks)
      this.skip();

    const url: string = await settingsClient.getUrl(actx);
    if ((TestConfig.deploymentEnv === "QA") || (TestConfig.deploymentEnv === "PERF"))
      chai.expect(url).equals("https://qa-connect-productsettingsservice.bentley.com");

    else if (TestConfig.deploymentEnv === "DEV")
      chai.expect(url).equals("https://dev-connect-productsettingsservice.bentley.com");

    else
      chai.expect(url).equals("https://connect-productsettingsservice.bentley.com");
  });

  // Application User Setting
  it("should save and retrieve a User setting for this Application", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks)
      this.skip();

    const appUserSetting = { appString: "application User String", appNumber: 7, appArray: [1, 2, 3, 4] };

    // start by deleting the setting we're going to create.
    const deleteResult: SettingsResult = await settingsClient.deleteUserSetting(actx, "TestSettings", "AppUser", authToken, true);
    chai.assert((SettingsStatus.Success === deleteResult.status) || (SettingsStatus.SettingNotFound === deleteResult.status), "Delete should work or give SettingNotFound");

    // save a new setting (deleted above, so we know it's new)
    const saveResult: SettingsResult = await settingsClient.saveUserSetting(actx, appUserSetting, "TestSettings", "AppUser", authToken, true);
    chai.assert(SettingsStatus.Success === saveResult.status, "Save should work");

    // read back the result.
    const getResult: SettingsResult = await settingsClient.getUserSetting(actx, "TestSettings", "AppUser", authToken, true);
    chai.assert(SettingsStatus.Success === getResult.status, "Retrieval should work");
    chai.assert(getResult.setting, "Setting should be returned");
    chai.expect(getResult.setting.appString).equals(appUserSetting.appString);
    chai.expect(getResult.setting.appNumber).equals(appUserSetting.appNumber);
    chai.assert(arraysEqual(getResult.setting.appArray, appUserSetting.appArray), "retrieved array contents correct");

    // change the value of an existing setting
    appUserSetting.appString = "new Application User String";
    appUserSetting.appNumber = 8;
    appUserSetting.appArray.splice(2, 1);  // is now 1, 2, 4
    const saveResult2: SettingsResult = await settingsClient.saveUserSetting(actx, appUserSetting, "TestSettings", "AppUser", authToken, true);
    chai.assert(SettingsStatus.Success === saveResult2.status, "Second save should work");
    const getResult2: SettingsResult = await settingsClient.getUserSetting(actx, "TestSettings", "AppUser", authToken, true);
    chai.assert(SettingsStatus.Success === getResult2.status, "Retrieval should work");
    chai.assert(getResult2.setting, "Setting should be returned");
    chai.expect(getResult2.setting.appString).equals(appUserSetting.appString);
    chai.expect(getResult2.setting.appNumber).equals(appUserSetting.appNumber);
    chai.assert(arraysEqual(getResult2.setting.appArray, appUserSetting.appArray), "retrieved array contents correct");

  });

  // Project/Application/User -specific  Setting
  it("should save and retrieve a Project User setting for this Application", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks)
      this.skip();

    const appProjectUserSetting = { appString: "application/Project User String", appNumber: 213, appArray: [10, 20, 30, 40, 50] };

    // start by deleting the setting we're going to create.
    const deleteResult: SettingsResult = await settingsClient.deleteUserSetting(actx, "TestSettings", "AppProjectUser", authToken, true, projectId);
    chai.assert((SettingsStatus.Success === deleteResult.status) || (SettingsStatus.SettingNotFound === deleteResult.status), "Delete should work or give SettingNotFound");

    // save a new setting (deleted above, so we know it's new)
    const saveResult: SettingsResult = await settingsClient.saveUserSetting(actx, appProjectUserSetting, "TestSettings", "AppProjectUser", authToken, true, projectId);
    chai.assert(SettingsStatus.Success === saveResult.status, "Save should work");

    // read back the result.
    const getResult: SettingsResult = await settingsClient.getUserSetting(actx, "TestSettings", "AppProjectUser", authToken, true, projectId);
    chai.assert(SettingsStatus.Success === getResult.status, "Retrieval should work");
    chai.assert(getResult.setting, "Setting should be returned");
    chai.expect(getResult.setting.appString).equals(appProjectUserSetting.appString);
    chai.expect(getResult.setting.appNumber).equals(appProjectUserSetting.appNumber);
    chai.assert(arraysEqual(getResult.setting.appArray, appProjectUserSetting.appArray), "retrieved array contents correct");

    // change the value of an existing setting
    appProjectUserSetting.appString = "new Application Project User String";
    appProjectUserSetting.appNumber = 8;
    appProjectUserSetting.appArray.splice(2, 1);
    const saveResult2: SettingsResult = await settingsClient.saveUserSetting(actx, appProjectUserSetting, "TestSettings", "AppProjectUser", authToken, true, projectId);
    chai.assert(SettingsStatus.Success === saveResult2.status, "Second save should work");
    const getResult2: SettingsResult = await settingsClient.getUserSetting(actx, "TestSettings", "AppProjectUser", authToken, true, projectId);
    chai.assert(SettingsStatus.Success === getResult2.status, "Retrieval should work");
    chai.assert(getResult2.setting, "Setting should be returned");
    chai.expect(getResult2.setting.appString).equals(appProjectUserSetting.appString);
    chai.expect(getResult2.setting.appNumber).equals(appProjectUserSetting.appNumber);
    chai.assert(arraysEqual(getResult2.setting.appArray, appProjectUserSetting.appArray), "retrieved array contents correct");

  });

  // iModel/Application/User -specific  Setting
  it("should save and retrieve an iModel User setting for this Application", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks)
      this.skip();

    const appIModelUserSetting = { appString: "application/iModel User String", appNumber: 41556, appArray: [1, 2, 3, 5, 8, 13, 21, 34] };

    // start by deleting the setting we're going to create.
    const deleteResult: SettingsResult = await settingsClient.deleteUserSetting(actx, "TestSettings", "AppIModelUser", authToken, true, projectId, iModelId);
    chai.assert((SettingsStatus.Success === deleteResult.status) || (SettingsStatus.SettingNotFound === deleteResult.status), "Delete should work or give SettingNotFound");

    // save a new setting (deleted above, so we know it's new)
    const saveResult: SettingsResult = await settingsClient.saveUserSetting(actx, appIModelUserSetting, "TestSettings", "AppIModelUser", authToken, true, projectId, iModelId);
    chai.assert(SettingsStatus.Success === saveResult.status, "Save should work");

    // read back the result.
    const getResult: SettingsResult = await settingsClient.getUserSetting(actx, "TestSettings", "AppIModelUser", authToken, true, projectId, iModelId);
    chai.assert(SettingsStatus.Success === getResult.status, "Retrieval should work");
    chai.assert(getResult.setting, "Setting should be returned");
    chai.expect(getResult.setting.appString).equals(appIModelUserSetting.appString);
    chai.expect(getResult.setting.appNumber).equals(appIModelUserSetting.appNumber);
    chai.assert(arraysEqual(getResult.setting.appArray, appIModelUserSetting.appArray), "retrieved array contents correct");

    // change the value of an existing setting
    appIModelUserSetting.appString = "new Application User iModel String";
    appIModelUserSetting.appNumber = 32757;
    appIModelUserSetting.appArray.splice(3, 2);
    const saveResult2: SettingsResult = await settingsClient.saveUserSetting(actx, appIModelUserSetting, "TestSettings", "AppIModelUser", authToken, true, projectId, iModelId);
    chai.assert(SettingsStatus.Success === saveResult2.status, "Second save should work");
    const getResult2: SettingsResult = await settingsClient.getUserSetting(actx, "TestSettings", "AppIModelUser", authToken, true, projectId, iModelId);
    chai.assert(SettingsStatus.Success === getResult2.status, "Retrieval should work");
    chai.assert(getResult2.setting, "Setting should be returned");
    chai.expect(getResult2.setting.appString).equals(appIModelUserSetting.appString);
    chai.expect(getResult2.setting.appNumber).equals(appIModelUserSetting.appNumber);
    chai.assert(arraysEqual(getResult2.setting.appArray, appIModelUserSetting.appArray), "retrieved array contents correct");
  });

  // Project/User -specific  Setting
  it("should save and retrieve a Project User setting (Application independent)", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks)
      this.skip();

    const projectUserSetting = { projString: "Project User String", projNumber: 213, projArray: [1, 3, 5, 7, 11, 13, 17] };

    // start by deleting the setting we're going to create.
    const deleteResult: SettingsResult = await settingsClient.deleteUserSetting(actx, "TestSettings", "ProjectUser", authToken, false, projectId);
    chai.assert((SettingsStatus.Success === deleteResult.status) || (SettingsStatus.SettingNotFound === deleteResult.status), "Delete should work or give SettingNotFound");

    // save a new setting (deleted above, so we know it's new)
    const saveResult: SettingsResult = await settingsClient.saveUserSetting(actx, projectUserSetting, "TestSettings", "ProjectUser", authToken, false, projectId);
    chai.assert(SettingsStatus.Success === saveResult.status, "Save should work");

    // read back the result.
    const getResult: SettingsResult = await settingsClient.getUserSetting(actx, "TestSettings", "ProjectUser", authToken, false, projectId);
    chai.assert(SettingsStatus.Success === getResult.status, "Retrieval should work");
    chai.assert(getResult.setting, "Setting should be returned");
    chai.expect(getResult.setting.projString).equals(projectUserSetting.projString);
    chai.expect(getResult.setting.projNumber).equals(projectUserSetting.projNumber);
    chai.assert(arraysEqual(getResult.setting.projArray, projectUserSetting.projArray), "retrieved array contents correct");

    // change the value of an existing setting
    projectUserSetting.projString = "new Project User String";
    projectUserSetting.projNumber = 8;
    projectUserSetting.projArray.splice(2, 2);
    const saveResult2: SettingsResult = await settingsClient.saveUserSetting(actx, projectUserSetting, "TestSettings", "ProjectUser", authToken, false, projectId);
    chai.assert(SettingsStatus.Success === saveResult2.status, "Second save should work");
    const getResult2: SettingsResult = await settingsClient.getUserSetting(actx, "TestSettings", "ProjectUser", authToken, false, projectId);
    chai.assert(SettingsStatus.Success === getResult2.status, "Retrieval should work");
    chai.assert(getResult2.setting, "Setting should be returned");
    chai.expect(getResult2.setting.projString).equals(projectUserSetting.projString);
    chai.expect(getResult2.setting.projNumber).equals(projectUserSetting.projNumber);
    chai.assert(arraysEqual(getResult2.setting.projArray, projectUserSetting.projArray), "retrieved array contents correct");

  });

  // IModel/User -specific  Setting
  it("should save and retrieve an IModel User setting (Application independent)", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks)
      this.skip();

    const iModelUserSetting = { iModelString: "iModel User String", iModelNumber: 723, iModelArray: [99, 98, 97, 96, 95] };

    // start by deleting the setting we're going to create.
    const deleteResult: SettingsResult = await settingsClient.deleteUserSetting(actx, "TestSettings", "IModelUser", authToken, false, projectId, iModelId);
    chai.assert((SettingsStatus.Success === deleteResult.status) || (SettingsStatus.SettingNotFound === deleteResult.status), "Delete should work or give SettingNotFound");

    // save a new setting (deleted above, so we know it's new)
    const saveResult: SettingsResult = await settingsClient.saveUserSetting(actx, iModelUserSetting, "TestSettings", "IModelUser", authToken, false, projectId, iModelId);
    chai.assert(SettingsStatus.Success === saveResult.status, "Save should work");

    // read back the result.
    const getResult: SettingsResult = await settingsClient.getUserSetting(actx, "TestSettings", "IModelUser", authToken, false, projectId, iModelId);
    chai.assert(SettingsStatus.Success === getResult.status, "Retrieval should work");
    chai.assert(getResult.setting, "Setting should be returned");
    chai.expect(getResult.setting.iModelString).equals(iModelUserSetting.iModelString);
    chai.expect(getResult.setting.iModelNumber).equals(iModelUserSetting.iModelNumber);
    chai.assert(arraysEqual(getResult.setting.iModelArray, iModelUserSetting.iModelArray), "retrieved array contents correct");

    // change the value of an existing setting
    iModelUserSetting.iModelString = "new iModel User String";
    iModelUserSetting.iModelNumber = 327;
    iModelUserSetting.iModelArray.splice(2, 2);
    const saveResult2: SettingsResult = await settingsClient.saveUserSetting(actx, iModelUserSetting, "TestSettings", "IModelUser", authToken, false, projectId, iModelId);
    chai.assert(SettingsStatus.Success === saveResult2.status, "Second save should work");
    const getResult2: SettingsResult = await settingsClient.getUserSetting(actx, "TestSettings", "IModelUser", authToken, false, projectId, iModelId);
    chai.assert(SettingsStatus.Success === getResult2.status, "Retrieval should work");
    chai.assert(getResult2.setting, "Setting should be returned");
    chai.expect(getResult2.setting.iModelString).equals(iModelUserSetting.iModelString);
    chai.expect(getResult2.setting.iModelNumber).equals(iModelUserSetting.iModelNumber);
    chai.assert(arraysEqual(getResult2.setting.iModelArray, iModelUserSetting.iModelArray), "retrieved array contents correct");

  });

});

describe("ConnectSettingsClient-Administrator", () => {
  let accessToken: AccessToken;
  let authToken: AuthorizationToken;
  let projectId: string;
  let iModelId: string;
  let connectClient: ConnectClient;
  let settingsClient: ConnectSettingsClient;
  const actx = new ActivityLoggingContext("");

  before(async function (this: Mocha.IHookCallbackContext) {
    if (TestConfig.enableMocks)
      return;

    TestConfig.deploymentEnv = "DEV";
    connectClient = new ConnectClient(TestConfig.deploymentEnv);
    settingsClient = new ConnectSettingsClient(TestConfig.deploymentEnv, "1001");
    authToken = await TestConfig.login(TestUsers.super);
    accessToken = await connectClient.getAccessToken(actx, authToken);

    const { project, iModel } = await TestConfig.queryTestCase(accessToken, TestConfig.deploymentEnv, TestConfig.projectName, "test");

    projectId = project.wsgId;
    chai.expect(projectId);

    iModelId = iModel!.wsgId;
    chai.expect(iModelId);

  });

  // Application Setting
  it("should save and retrieve an Application Setting", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks)
      this.skip();

    const appSetting = { appString: "application String", appNumber: 112, appArray: [101, 102, 103, 104] };

    // start by deleting the setting we're going to create.
    const deleteResult: SettingsResult = await settingsClient.deleteSetting(actx, "TestSettings", "AppSetting", authToken, true);
    chai.assert((SettingsStatus.Success === deleteResult.status) || (SettingsStatus.SettingNotFound === deleteResult.status), "Delete should work or give SettingNotFound");

    // save a new setting (deleted above, so we know it's new)
    const saveResult: SettingsResult = await settingsClient.saveSetting(actx, appSetting, "TestSettings", "AppSetting", authToken, true);
    chai.assert(SettingsStatus.Success === saveResult.status, "Save should work");

    // read back the result.
    const getResult: SettingsResult = await settingsClient.getSetting(actx, "TestSettings", "AppSetting", authToken, true);
    chai.assert(SettingsStatus.Success === getResult.status, "Retrieval should work");
    chai.assert(getResult.setting, "Setting should be returned");
    chai.expect(getResult.setting.appString).equals(appSetting.appString);
    chai.expect(getResult.setting.appNumber).equals(appSetting.appNumber);
    chai.assert(arraysEqual(getResult.setting.appArray, appSetting.appArray), "retrieved array contents correct");

    // change the value of an existing setting
    appSetting.appString = "new Application String";
    appSetting.appArray.splice(2, 1);
    const saveResult2: SettingsResult = await settingsClient.saveSetting(actx, appSetting, "TestSettings", "AppSetting", authToken, true);
    chai.assert(SettingsStatus.Success === saveResult2.status, "Second save should work");
    const getResult2: SettingsResult = await settingsClient.getSetting(actx, "TestSettings", "AppSetting", authToken, true);
    chai.assert(SettingsStatus.Success === getResult2.status, "Retrieval should work");
    chai.assert(getResult2.setting, "Setting should be returned");
    chai.expect(getResult2.setting.appString).equals(appSetting.appString);
    chai.expect(getResult2.setting.appNumber).equals(appSetting.appNumber);
    chai.assert(arraysEqual(getResult2.setting.appArray, appSetting.appArray), "retrieved array contents correct");

  });

  // Application/Project Setting
  it("should save and retrieve a Project/Application Setting", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks)
      this.skip();

    const projectAppSetting = { projAppString: "project Application String", projAppNumber: 592, projAppArray: [2101, 2102, 2103, 2104] };

    // start by deleting the setting we're going to create.
    const deleteResult: SettingsResult = await settingsClient.deleteSetting(actx, "TestSettings", "AppProjectSetting", authToken, true, projectId);
    chai.assert((SettingsStatus.Success === deleteResult.status) || (SettingsStatus.SettingNotFound === deleteResult.status), "Delete should work or give SettingNotFound");

    // save a new setting (deleted above, so we know it's new)
    const saveResult: SettingsResult = await settingsClient.saveSetting(actx, projectAppSetting, "TestSettings", "AppProjectSetting", authToken, true, projectId);
    chai.assert(SettingsStatus.Success === saveResult.status, "Save should work");

    // read back the result.
    const getResult: SettingsResult = await settingsClient.getSetting(actx, "TestSettings", "AppProjectSetting", authToken, true, projectId);
    chai.assert(SettingsStatus.Success === getResult.status, "Retrieval should work");
    chai.assert(getResult.setting, "Setting should be returned");
    chai.expect(getResult.setting.projAppString).equals(projectAppSetting.projAppString);
    chai.expect(getResult.setting.projAppNumber).equals(projectAppSetting.projAppNumber);
    chai.assert(arraysEqual(getResult.setting.projAppArray, projectAppSetting.projAppArray), "retrieved array contents correct");

    // change the value of an existing setting
    projectAppSetting.projAppString = "new Project Application String";
    projectAppSetting.projAppNumber = 1578;
    projectAppSetting.projAppArray.splice(2, 1);
    const saveResult2: SettingsResult = await settingsClient.saveSetting(actx, projectAppSetting, "TestSettings", "AppProjectSetting", authToken, true, projectId);
    chai.assert(SettingsStatus.Success === saveResult2.status, "Second save should work");
    const getResult2: SettingsResult = await settingsClient.getSetting(actx, "TestSettings", "AppProjectSetting", authToken, true, projectId);
    chai.assert(SettingsStatus.Success === getResult2.status, "Retrieval should work");
    chai.assert(getResult2.setting, "Setting should be returned");
    chai.expect(getResult2.setting.projAppString).equals(projectAppSetting.projAppString);
    chai.expect(getResult2.setting.projAppNumber).equals(projectAppSetting.projAppNumber);
    chai.assert(arraysEqual(getResult2.setting.projAppArray, projectAppSetting.projAppArray), "retrieved array contents correct");

  });

  // Application/IModel Setting
  it("should save and retrieve an iModel/Application Setting", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks)
      this.skip();

    const iModelAppSetting = { iModelAppString: "iModel Application String", iModelAppNumber: 592, iModelAppArray: [3211, 3212, 3213, 3214, 3215] };

    // start by deleting the setting we're going to create.
    const deleteResult: SettingsResult = await settingsClient.deleteSetting(actx, "TestSettings", "AppIModelSettings", authToken, true, projectId, iModelId);
    chai.assert((SettingsStatus.Success === deleteResult.status) || (SettingsStatus.SettingNotFound === deleteResult.status), "Delete should work or give SettingNotFound");

    // save a new setting (deleted above, so we know it's new)
    const saveResult: SettingsResult = await settingsClient.saveSetting(actx, iModelAppSetting, "TestSettings", "AppIModelSettings", authToken, true, projectId, iModelId);
    chai.assert(SettingsStatus.Success === saveResult.status, "Save should work");

    // read back the result.
    const getResult: SettingsResult = await settingsClient.getSetting(actx, "TestSettings", "AppIModelSettings", authToken, true, projectId, iModelId);
    chai.assert(SettingsStatus.Success === getResult.status, "Retrieval should work");
    chai.assert(getResult.setting, "Setting should be returned");
    chai.expect(getResult.setting.iModelAppString).equals(iModelAppSetting.iModelAppString);
    chai.expect(getResult.setting.iModelAppNumber).equals(iModelAppSetting.iModelAppNumber);
    chai.assert(arraysEqual(getResult.setting.iModelAppArray, iModelAppSetting.iModelAppArray), "retrieved array contents correct");

    // change the value of an existing setting
    iModelAppSetting.iModelAppString = "new IModel Application String";
    iModelAppSetting.iModelAppNumber = 1578;
    iModelAppSetting.iModelAppArray.splice(2, 1);
    const saveResult2: SettingsResult = await settingsClient.saveSetting(actx, iModelAppSetting, "TestSettings", "AppIModelSettings", authToken, true, projectId, iModelId);
    chai.assert(SettingsStatus.Success === saveResult2.status, "Second save should work");
    const getResult2: SettingsResult = await settingsClient.getSetting(actx, "TestSettings", "AppIModelSettings", authToken, true, projectId, iModelId);
    chai.assert(SettingsStatus.Success === getResult2.status, "Retrieval should work");
    chai.assert(getResult2.setting, "Setting should be returned");
    chai.expect(getResult2.setting.iModelAppString).equals(iModelAppSetting.iModelAppString);
    chai.expect(getResult2.setting.iModelAppNumber).equals(iModelAppSetting.iModelAppNumber);
    chai.assert(arraysEqual(getResult2.setting.iModelAppArray, iModelAppSetting.iModelAppArray), "retrieved array contents correct");

  });

  // Project Setting (application independent)
  it("should save and retrieve a Project Setting (Application independent)", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks)
      this.skip();

    const projectSetting = { projString: "project String", projNumber: 592, projArray: [8765, 4321, 9876, 5432, 1987] };

    // start by deleting the setting we're going to create.
    const deleteResult: SettingsResult = await settingsClient.deleteSetting(actx, "TestSettings", "ProjectSettings", authToken, false, projectId);
    chai.assert((SettingsStatus.Success === deleteResult.status) || (SettingsStatus.SettingNotFound === deleteResult.status), "Delete should work or give SettingNotFound");

    // save a new setting (deleted above, so we know it's new)
    const saveResult: SettingsResult = await settingsClient.saveSetting(actx, projectSetting, "TestSettings", "ProjectSettings", authToken, false, projectId);
    chai.assert(SettingsStatus.Success === saveResult.status, "Save should work");

    // read back the result.
    const getResult: SettingsResult = await settingsClient.getSetting(actx, "TestSettings", "ProjectSettings", authToken, false, projectId);
    chai.assert(SettingsStatus.Success === getResult.status, "Retrieval should work");
    chai.assert(getResult.setting, "Setting should be returned");
    chai.expect(getResult.setting.projString).equals(projectSetting.projString);
    chai.expect(getResult.setting.projNumber).equals(projectSetting.projNumber);
    chai.assert(arraysEqual(getResult.setting.projArray, projectSetting.projArray), "retrieved array contents correct");

    // change the value of an existing setting
    projectSetting.projString = "new Project String";
    projectSetting.projNumber = 1578;
    projectSetting.projArray.splice(2, 1);
    const saveResult2: SettingsResult = await settingsClient.saveSetting(actx, projectSetting, "TestSettings", "ProjectSettings", authToken, false, projectId);
    chai.assert(SettingsStatus.Success === saveResult2.status, "Second save should work");
    const getResult2: SettingsResult = await settingsClient.getSetting(actx, "TestSettings", "ProjectSettings", authToken, false, projectId);
    chai.assert(SettingsStatus.Success === getResult2.status, "Retrieval should work");
    chai.assert(getResult2.setting, "Setting should be returned");
    chai.expect(getResult2.setting.projString).equals(projectSetting.projString);
    chai.expect(getResult2.setting.projNumber).equals(projectSetting.projNumber);
    chai.assert(arraysEqual(getResult2.setting.projArray, projectSetting.projArray), "retrieved array contents correct");

  });

  // IModel Setting (application independent)
  it("should save and retrieve an iModel Setting (Application independent)", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks)
      this.skip();

    const iModelSetting = { iModelString: "iModel String", iModelNumber: 592, iModelArray: [33482, 29385, 99742, 32195, 99475] };

    // start by deleting the setting we're going to create.
    const deleteResult: SettingsResult = await settingsClient.deleteSetting(actx, "TestSettings", "IModelSettings", authToken, false, projectId, iModelId);
    chai.assert((SettingsStatus.Success === deleteResult.status) || (SettingsStatus.SettingNotFound === deleteResult.status), "Delete should work or give SettingNotFound");

    // save a new setting (deleted above, so we know it's new)
    const saveResult: SettingsResult = await settingsClient.saveSetting(actx, iModelSetting, "TestSettings", "IModelSettings", authToken, false, projectId, iModelId);
    chai.assert(SettingsStatus.Success === saveResult.status, "Save should work");

    // read back the result.
    const getResult: SettingsResult = await settingsClient.getSetting(actx, "TestSettings", "IModelSettings", authToken, false, projectId, iModelId);
    chai.assert(SettingsStatus.Success === getResult.status, "Retrieval should work");
    chai.assert(getResult.setting, "Setting should be returned");
    chai.expect(getResult.setting.iModelString).equals(iModelSetting.iModelString);
    chai.expect(getResult.setting.iModelNumber).equals(iModelSetting.iModelNumber);
    chai.assert(arraysEqual(getResult.setting.iModelArray, iModelSetting.iModelArray), "retrieved array contents correct");

    // change the value of an existing setting
    iModelSetting.iModelString = "new IModel Application String";
    iModelSetting.iModelNumber = 1578;
    iModelSetting.iModelArray.splice(3, 1);
    const saveResult2: SettingsResult = await settingsClient.saveSetting(actx, iModelSetting, "TestSettings", "IModelSettings", authToken, false, projectId, iModelId);
    chai.assert(SettingsStatus.Success === saveResult2.status, "Second save should work");
    const getResult2: SettingsResult = await settingsClient.getSetting(actx, "TestSettings", "IModelSettings", authToken, false, projectId, iModelId);
    chai.assert(SettingsStatus.Success === getResult2.status, "Retrieval should work");
    chai.assert(getResult2.setting, "Setting should be returned");
    chai.expect(getResult2.setting.iModelString).equals(iModelSetting.iModelString);
    chai.expect(getResult2.setting.iModelNumber).equals(iModelSetting.iModelNumber);
    chai.assert(arraysEqual(getResult2.setting.iModelArray, iModelSetting.iModelArray), "retrieved array contents correct");

  });

});

describe("Reading non-user settings from ordinary user", () => {
  let accessToken: AccessToken;
  let authToken: AuthorizationToken;
  let projectId: string;
  let iModelId: string;
  let connectClient: ConnectClient;
  let settingsClient: ConnectSettingsClient;
  const actx = new ActivityLoggingContext("");

  before(async function (this: Mocha.IHookCallbackContext) {
    if (TestConfig.enableMocks)
      return;

    TestConfig.deploymentEnv = "DEV";
    connectClient = new ConnectClient(TestConfig.deploymentEnv);
    settingsClient = new ConnectSettingsClient(TestConfig.deploymentEnv, "1001");
    authToken = await TestConfig.login();
    accessToken = await connectClient.getAccessToken(actx, authToken);

    const { project, iModel } = await TestConfig.queryTestCase(accessToken, TestConfig.deploymentEnv, TestConfig.projectName, "test");

    projectId = project.wsgId;
    chai.expect(projectId);

    iModelId = iModel!.wsgId;
    chai.expect(iModelId);

  });

  // Application Setting
  it("should successfully retrieve an Application Setting", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks)
      this.skip();

    const getResult: SettingsResult = await settingsClient.getSetting(actx, "TestSettings", "AppSetting", authToken, true);
    chai.assert(SettingsStatus.Success === getResult.status, "Retrieval should work");
    chai.assert(getResult.setting, "Setting should be returned");
    chai.expect(getResult.setting.appString).equals("new Application String");
  });

  // Application/Project Setting
  it("should successfully retrieve a Project/Application Setting", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks)
      this.skip();

    // read back the result.
    const getResult: SettingsResult = await settingsClient.getSetting(actx, "TestSettings", "AppProjectSetting", authToken, true, projectId);
    chai.assert(SettingsStatus.Success === getResult.status, "Retrieval should work");
    chai.assert(getResult.setting, "Setting should be returned");
    chai.expect(getResult.setting.projAppString).equals("new Project Application String");
  });

  // Application/IModel Setting
  it("should successfully retrieve an iModel/Application Setting", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks)
      this.skip();

    // read back the result.
    const getResult: SettingsResult = await settingsClient.getSetting(actx, "TestSettings", "AppIModelSettings", authToken, true, projectId, iModelId);
    chai.assert(SettingsStatus.Success === getResult.status, "Retrieval should work");
    chai.assert(getResult.setting, "Setting should be returned");
    chai.expect(getResult.setting.iModelAppString).equals("new IModel Application String");
  });

  // Project Setting (application independent)
  it("should successfully retrieve a Project Setting (Application independent)", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks)
      this.skip();

    // read back the result.
    const getResult: SettingsResult = await settingsClient.getSetting(actx, "TestSettings", "ProjectSettings", authToken, false, projectId);
    chai.assert(SettingsStatus.Success === getResult.status, "Retrieval should work");
    chai.assert(getResult.setting, "Setting should be returned");
    chai.expect(getResult.setting.projString).equals("new Project String");
  });

  // IModel Setting (application independent)
  it("should successfully retrieve an iModel Setting (Application independent)", async function (this: Mocha.ITestCallbackContext) {
    if (TestConfig.enableMocks)
      this.skip();

    // read back the result.
    const getResult: SettingsResult = await settingsClient.getSetting(actx, "TestSettings", "IModelSettings", authToken, false, projectId, iModelId);
    chai.assert(SettingsStatus.Success === getResult.status, "Retrieval should work");
    chai.assert(getResult.setting, "Setting should be returned");
    chai.expect(getResult.setting.iModelString).equals("new IModel Application String");
  });

});
