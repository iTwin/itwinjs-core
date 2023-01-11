/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";
import { ClientRequestContext, Config, Guid, GuidString } from "@bentley/bentleyjs-core";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { TestUsers } from "@bentley/oidc-signin-tool/lib/frontend";
import { SettingsMapResult, SettingsResult, SettingsStatus } from "../SettingsAdmin";
import { ConnectSettingsClient } from "../SettingsClient";
import { TestConfig } from "./TestConfig";

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

// Multiple test runs could potentially collide if we use the same name of settings
// so we setup guids for each test run.
// NOTE: The tests should clean up after themselves to avoid leaving a large amount of settings.
const settingGuids = [
  Guid.createValue(),
  Guid.createValue(),
  Guid.createValue(),
  Guid.createValue(),
  Guid.createValue(),
  Guid.createValue(),
];

chai.should();

describe("ConnectSettingsClient-User (#integration)", () => {
  let projectId: GuidString;
  let iModelId: GuidString;
  const settingsClient = new ConnectSettingsClient("1001");
  let requestContext: AuthorizedClientRequestContext;

  before(async () => {
    requestContext = await TestConfig.getAuthorizedClientRequestContext();

    projectId = (await TestConfig.queryProject(requestContext, TestConfig.projectName)).wsgId;
    chai.assert.isDefined(projectId);
    iModelId = (await TestConfig.queryIModel(requestContext, projectId)).wsgId;
    chai.assert.isDefined(iModelId);
  });

  interface AppSetting {
    appString: string;
    appNumber: number;
    appArray: number[];
  }

  // Application User Setting
  it("should save and retrieve a User setting for this Application (#integration)", async () => {
    const appUserSettings: AppSetting[] = [];

    // create an array of settings.
    for (let iSetting: number = 0; iSetting < 6; iSetting++) {
      const multiplier = Math.pow(10, iSetting);
      appUserSettings.push({ appString: `application User String ${iSetting}`, appNumber: 7 * iSetting, appArray: [(iSetting + 1) * multiplier, (iSetting + 2) * multiplier, (iSetting + 3) * multiplier, (iSetting + 4) * multiplier] });
    }

    // delete all the settings, so we know we are creating new ones.
    for (let iSetting: number = 0; iSetting < 6; iSetting++) {
      const deleteResult: SettingsResult = await settingsClient.deleteUserSetting(requestContext, "TestSettings", `AppUser${settingGuids[iSetting]}`, true);
      chai.assert((SettingsStatus.Success === deleteResult.status) || (SettingsStatus.SettingNotFound === deleteResult.status), "Delete should work or give SettingNotFound");
    }

    // save new settings (deleted above, so we know it's new)
    for (let iSetting: number = 0; iSetting < 6; iSetting++) {
      const saveResult: SettingsResult = await settingsClient.saveUserSetting(requestContext, appUserSettings[iSetting], "TestSettings", `AppUser${settingGuids[iSetting]}`, true);
      chai.assert(SettingsStatus.Success === saveResult.status, "Save should work");
    }

    // read back the AppUser results.
    for (let iSetting: number = 0; iSetting < 6; iSetting++) {
      const getResult: SettingsResult = await settingsClient.getUserSetting(requestContext, "TestSettings", `AppUser${settingGuids[iSetting]}`, true);
      chai.assert(SettingsStatus.Success === getResult.status, "Retrieval should work");
      chai.assert(getResult.setting, "Setting should be returned");
      chai.expect(getResult.setting.appString).equals(appUserSettings[iSetting].appString);
      chai.expect(getResult.setting.appNumber).equals(appUserSettings[iSetting].appNumber);
      chai.assert(arraysEqual(getResult.setting.appArray, appUserSettings[iSetting].appArray), "retrieved array contents correct");
    }

    // change the value of an existing setting
    appUserSettings[0].appString = "new Application User String";
    appUserSettings[0].appNumber = 8;
    appUserSettings[0].appArray.splice(2, 1);  // is now 1, 2, 4
    const saveResult2: SettingsResult = await settingsClient.saveUserSetting(requestContext, appUserSettings[0], "TestSettings", `AppUser${settingGuids[0]}`, true);
    chai.assert(SettingsStatus.Success === saveResult2.status, "Second save should work");
    const getResult2: SettingsResult = await settingsClient.getUserSetting(requestContext, "TestSettings", `AppUser${settingGuids[0]}`, true);
    chai.assert(SettingsStatus.Success === getResult2.status, "Retrieval should work");
    chai.assert(getResult2.setting, "Setting should be returned");
    chai.expect(getResult2.setting.appString).equals(appUserSettings[0].appString);
    chai.expect(getResult2.setting.appNumber).equals(appUserSettings[0].appNumber);
    chai.assert(arraysEqual(getResult2.setting.appArray, appUserSettings[0].appArray), "retrieved array contents correct");

    // now try getting all settings by namespace
    const filterResult: SettingsMapResult = await settingsClient.getUserSettingsByNamespace(requestContext, "TestSettings", true);
    chai.assert(SettingsStatus.Success === filterResult.status, "Return by namespace should work");
    for (let iSetting: number = 0; iSetting < 6; iSetting++) {
      const setting: any | undefined = filterResult.settingsMap!.get(`AppUser${settingGuids[iSetting]}`);
      chai.assert(setting !== undefined, `Setting named 'appUser${iSetting}' should be found in namespace 'TestSettings'`);
      chai.assert(setting.appNumber === appUserSettings[iSetting].appNumber, `Setting named 'appUser${iSetting}' should have appNumber of ${appUserSettings[iSetting].appNumber}`);
      chai.assert(setting.appString === appUserSettings[iSetting].appString, `Setting named 'appUser${iSetting}' should have appString of ${appUserSettings[iSetting].appString}`);
      chai.assert(arraysEqual(setting.appArray, appUserSettings[iSetting].appArray), `Setting named 'appUser${iSetting}' should have correct appArray`);
    }

    // clean up all the settings.
    for (let iSetting: number = 0; iSetting < 6; iSetting++) {
      const deleteResult: SettingsResult = await settingsClient.deleteUserSetting(requestContext, "TestSettings", `AppUser${settingGuids[iSetting]}`, true);
      chai.assert((SettingsStatus.Success === deleteResult.status) || (SettingsStatus.SettingNotFound === deleteResult.status), "Delete should work or give SettingNotFound");
    }
  });

  // Project/Application/User -specific  Setting
  it("should save and retrieve a Project User setting for this Application (#integration)", async () => {
    const appProjectUserSetting = { appString: "application/Project User String", appNumber: 213, appArray: [10, 20, 30, 40, 50] };
    const settingName = `AppProjectUser${settingGuids[0]}`;

    // start by deleting the setting we're going to create.
    let deleteResult: SettingsResult = await settingsClient.deleteUserSetting(requestContext, "TestSettings", settingName, true, projectId);
    chai.assert((SettingsStatus.Success === deleteResult.status) || (SettingsStatus.SettingNotFound === deleteResult.status), `Delete should work or give SettingNotFound for ${settingName} instead returned ${deleteResult.status}.`);

    // save a new setting (deleted above, so we know it's new)
    const saveResult: SettingsResult = await settingsClient.saveUserSetting(requestContext, appProjectUserSetting, "TestSettings", settingName, true, projectId);
    chai.assert(SettingsStatus.Success === saveResult.status, `Save should work for ${settingName}.`);

    // read back the result.
    const getResult: SettingsResult = await settingsClient.getUserSetting(requestContext, "TestSettings", settingName, true, projectId);
    chai.assert(SettingsStatus.Success === getResult.status, `Retrieval should work for ${settingName}.`);
    chai.assert(getResult.setting, `Setting should be returned for ${settingName}.`);
    chai.expect(getResult.setting.appString).equals(appProjectUserSetting.appString);
    chai.expect(getResult.setting.appNumber).equals(appProjectUserSetting.appNumber);
    chai.assert(arraysEqual(getResult.setting.appArray, appProjectUserSetting.appArray), `Retrieved array contents are not equal for ${settingName}.`);

    // change the value of an existing setting
    appProjectUserSetting.appString = "new Application Project User String";
    appProjectUserSetting.appNumber = 8;
    appProjectUserSetting.appArray.splice(2, 1);
    const saveResult2: SettingsResult = await settingsClient.saveUserSetting(requestContext, appProjectUserSetting, "TestSettings", settingName, true, projectId);
    chai.assert(SettingsStatus.Success === saveResult2.status, "Second save should work");
    const getResult2: SettingsResult = await settingsClient.getUserSetting(requestContext, "TestSettings", settingName, true, projectId);
    chai.assert(SettingsStatus.Success === getResult2.status, "Retrieval should work");
    chai.assert(getResult2.setting, "Setting should be returned");
    chai.expect(getResult2.setting.appString).equals(appProjectUserSetting.appString);
    chai.expect(getResult2.setting.appNumber).equals(appProjectUserSetting.appNumber);
    chai.assert(arraysEqual(getResult2.setting.appArray, appProjectUserSetting.appArray), "retrieved array contents correct");

    // Clean up the setting
    deleteResult = await settingsClient.deleteUserSetting(requestContext, "TestSettings", settingName, true, projectId);
    chai.assert((SettingsStatus.Success === deleteResult.status) || (SettingsStatus.SettingNotFound === deleteResult.status), "Delete should work or give SettingNotFound");
  });

  // iModel/Application/User -specific  Setting
  it("should save and retrieve an iModel User setting for this Application (#integration)", async () => {
    const appIModelUserSetting = { appString: "application/iModel User String", appNumber: 41556, appArray: [1, 2, 3, 5, 8, 13, 21, 34] };
    const settingName = `AppIModelUser${settingGuids[0]}`;

    // start by deleting the setting we're going to create.
    let deleteResult: SettingsResult = await settingsClient.deleteUserSetting(requestContext, "TestSettings", settingName, true, projectId, iModelId);
    chai.assert((SettingsStatus.Success === deleteResult.status) || (SettingsStatus.SettingNotFound === deleteResult.status), `Delete should work or give SettingNotFound for ${settingName} instead returned ${deleteResult.status}.`);

    // save a new setting (deleted above, so we know it's new)
    const saveResult: SettingsResult = await settingsClient.saveUserSetting(requestContext, appIModelUserSetting, "TestSettings", settingName, true, projectId, iModelId);
    chai.assert(SettingsStatus.Success === saveResult.status, "Save should work");

    // read back the result.
    const getResult: SettingsResult = await settingsClient.getUserSetting(requestContext, "TestSettings", settingName, true, projectId, iModelId);
    chai.assert(SettingsStatus.Success === getResult.status, `Retrieval should work, instead returned ${getResult.status}`);
    chai.assert(getResult.setting, "Setting should be returned");
    chai.expect(getResult.setting.appString).equals(appIModelUserSetting.appString);
    chai.expect(getResult.setting.appNumber).equals(appIModelUserSetting.appNumber);
    chai.assert(arraysEqual(getResult.setting.appArray, appIModelUserSetting.appArray), "retrieved array contents correct");

    // change the value of an existing setting
    appIModelUserSetting.appString = "new Application User iModel String";
    appIModelUserSetting.appNumber = 32757;
    appIModelUserSetting.appArray.splice(3, 2);
    const saveResult2: SettingsResult = await settingsClient.saveUserSetting(requestContext, appIModelUserSetting, "TestSettings", settingName, true, projectId, iModelId);
    chai.assert(SettingsStatus.Success === saveResult2.status, "Second save should work");
    const getResult2: SettingsResult = await settingsClient.getUserSetting(requestContext, "TestSettings", settingName, true, projectId, iModelId);
    chai.assert(SettingsStatus.Success === getResult2.status, "Retrieval should work");
    chai.assert(getResult2.setting, "Setting should be returned");
    chai.expect(getResult2.setting.appString).equals(appIModelUserSetting.appString);
    chai.expect(getResult2.setting.appNumber).equals(appIModelUserSetting.appNumber);
    chai.assert(arraysEqual(getResult2.setting.appArray, appIModelUserSetting.appArray), "retrieved array contents correct");

    // Clean up the setting
    deleteResult = await settingsClient.deleteUserSetting(requestContext, "TestSettings", settingName, true, projectId, iModelId);
    chai.assert((SettingsStatus.Success === deleteResult.status) || (SettingsStatus.SettingNotFound === deleteResult.status), "Delete should work or give SettingNotFound");
  });

  // Project/User -specific  Setting
  it("should save and retrieve a Project User setting (Application independent) (#integration)", async () => {
    const projectUserSetting = { projString: "Project User String", projNumber: 213, projArray: [1, 3, 5, 7, 11, 13, 17] };
    const settingName = `ProjectUser${settingGuids[0]}`;

    // start by deleting the setting we're going to create.
    let deleteResult: SettingsResult = await settingsClient.deleteUserSetting(requestContext, "TestSettings", settingName, false, projectId);
    chai.assert((SettingsStatus.Success === deleteResult.status) || (SettingsStatus.SettingNotFound === deleteResult.status), `Delete should work or give SettingNotFound for ${settingName} instead returned ${deleteResult.status}.`);

    // save a new setting (deleted above, so we know it's new)
    const saveResult: SettingsResult = await settingsClient.saveUserSetting(requestContext, projectUserSetting, "TestSettings", settingName, false, projectId);
    chai.assert(SettingsStatus.Success === saveResult.status, "Save should work");

    // read back the result.
    const getResult: SettingsResult = await settingsClient.getUserSetting(requestContext, "TestSettings", settingName, false, projectId);
    chai.assert(SettingsStatus.Success === getResult.status, "Retrieval should work");
    chai.assert(getResult.setting, "Setting should be returned");
    chai.expect(getResult.setting.projString).equals(projectUserSetting.projString);
    chai.expect(getResult.setting.projNumber).equals(projectUserSetting.projNumber);
    chai.assert(arraysEqual(getResult.setting.projArray, projectUserSetting.projArray), "retrieved array contents correct");

    // change the value of an existing setting
    projectUserSetting.projString = "new Project User String";
    projectUserSetting.projNumber = 8;
    projectUserSetting.projArray.splice(2, 2);
    const saveResult2: SettingsResult = await settingsClient.saveUserSetting(requestContext, projectUserSetting, "TestSettings", settingName, false, projectId);
    chai.assert(SettingsStatus.Success === saveResult2.status, "Second save should work");
    const getResult2: SettingsResult = await settingsClient.getUserSetting(requestContext, "TestSettings", settingName, false, projectId);
    chai.assert(SettingsStatus.Success === getResult2.status, "Retrieval should work");
    chai.assert(getResult2.setting, "Setting should be returned");
    chai.expect(getResult2.setting.projString).equals(projectUserSetting.projString);
    chai.expect(getResult2.setting.projNumber).equals(projectUserSetting.projNumber);
    chai.assert(arraysEqual(getResult2.setting.projArray, projectUserSetting.projArray), "retrieved array contents correct");

    // Clean up the setting
    deleteResult = await settingsClient.deleteUserSetting(requestContext, "TestSettings", settingName, false, projectId);
    chai.assert((SettingsStatus.Success === deleteResult.status) || (SettingsStatus.SettingNotFound === deleteResult.status), "Delete should work or give SettingNotFound");
  });

  // IModel/User -specific  Setting
  it("should save and retrieve an IModel User setting (Application independent) (#integration)", async () => {
    const iModelUserSetting = { iModelString: "iModel User String", iModelNumber: 723, iModelArray: [99, 98, 97, 96, 95] };
    const settingName = `IModelUser${settingGuids[0]}`;

    // start by deleting the setting we're going to create.
    let deleteResult: SettingsResult = await settingsClient.deleteUserSetting(requestContext, "TestSettings", settingName, false, projectId, iModelId);
    chai.assert((SettingsStatus.Success === deleteResult.status) || (SettingsStatus.SettingNotFound === deleteResult.status), "Delete should work or give SettingNotFound");

    // save a new setting (deleted above, so we know it's new)
    const saveResult: SettingsResult = await settingsClient.saveUserSetting(requestContext, iModelUserSetting, "TestSettings", settingName, false, projectId, iModelId);
    chai.assert(SettingsStatus.Success === saveResult.status, "Save should work");

    // read back the result.
    const getResult: SettingsResult = await settingsClient.getUserSetting(requestContext, "TestSettings", settingName, false, projectId, iModelId);
    chai.assert(SettingsStatus.Success === getResult.status, "Retrieval should work");
    chai.assert(getResult.setting, "Setting should be returned");
    chai.expect(getResult.setting.iModelString).equals(iModelUserSetting.iModelString);
    chai.expect(getResult.setting.iModelNumber).equals(iModelUserSetting.iModelNumber);
    chai.assert(arraysEqual(getResult.setting.iModelArray, iModelUserSetting.iModelArray), "retrieved array contents correct");

    // change the value of an existing setting
    iModelUserSetting.iModelString = "new iModel User String";
    iModelUserSetting.iModelNumber = 327;
    iModelUserSetting.iModelArray.splice(2, 2);
    const saveResult2: SettingsResult = await settingsClient.saveUserSetting(requestContext, iModelUserSetting, "TestSettings", settingName, false, projectId, iModelId);
    chai.assert(SettingsStatus.Success === saveResult2.status, "Second save should work");
    const getResult2: SettingsResult = await settingsClient.getUserSetting(requestContext, "TestSettings", settingName, false, projectId, iModelId);
    chai.assert(SettingsStatus.Success === getResult2.status, "Retrieval should work");
    chai.assert(getResult2.setting, "Setting should be returned");
    chai.expect(getResult2.setting.iModelString).equals(iModelUserSetting.iModelString);
    chai.expect(getResult2.setting.iModelNumber).equals(iModelUserSetting.iModelNumber);
    chai.assert(arraysEqual(getResult2.setting.iModelArray, iModelUserSetting.iModelArray), "retrieved array contents correct");

    // Clean up the setting
    deleteResult = await settingsClient.deleteUserSetting(requestContext, "TestSettings", settingName, false, projectId, iModelId);
    chai.assert((SettingsStatus.Success === deleteResult.status) || (SettingsStatus.SettingNotFound === deleteResult.status), "Delete should work or give SettingNotFound");
  });
});

describe("ConnectSettingsClient-Administrator (#integration)", () => {
  let projectId: GuidString;
  let iModelId: GuidString;
  let settingsClient: ConnectSettingsClient;
  let requestContext: AuthorizedClientRequestContext;

  before(async () => {
    settingsClient = new ConnectSettingsClient("1001");

    requestContext = await TestConfig.getAuthorizedClientRequestContext(TestUsers.super);

    projectId = (await TestConfig.queryProject(requestContext, TestConfig.projectName)).wsgId;
    chai.assert.isDefined(projectId);
    iModelId = (await TestConfig.queryIModel(requestContext, projectId)).wsgId;
    chai.assert.isDefined(iModelId);
  });

  // Application Setting with the same name as a User App Setting (make sure they are independently stored.)
  it("should maintain app-specific settings separately from user settings with the same namespace/name (#integration)", async () => {
    const independentAppSetting = { stringValue: "App independence test", numberValue: 82919, arrayValue: [10, 14, 84, 1, 8, 87, 5, 13, 90, 7, 13, 92] };
    const settingName = `AppUser${settingGuids[0]}`;

    let deleteResult: SettingsResult = await settingsClient.deleteSetting(requestContext, "TestSettings", settingName, true);
    chai.assert((SettingsStatus.Success === deleteResult.status) || (SettingsStatus.SettingNotFound === deleteResult.status), "Delete should work or give SettingNotFound");

    // save the new setting (deleted above, so we know it's new)
    const saveResult: SettingsResult = await settingsClient.saveSetting(requestContext, independentAppSetting, "TestSettings", settingName, true);
    chai.assert(SettingsStatus.Success === saveResult.status, "Save should work");

    // read back the result.
    const getResult: SettingsResult = await settingsClient.getSetting(requestContext, "TestSettings", settingName, true);
    chai.assert(SettingsStatus.Success === getResult.status, "Retrieval should work");
    chai.assert(getResult.setting, "Setting should be returned");
    chai.expect(getResult.setting.stringValue).equals(independentAppSetting.stringValue);
    chai.expect(getResult.setting.numberValue).equals(independentAppSetting.numberValue);
    chai.assert(arraysEqual(getResult.setting.arrayValue, independentAppSetting.arrayValue), "retrieved array contents correct");

    deleteResult = await settingsClient.deleteSetting(requestContext, "TestSettings", settingName, true);
    chai.assert((SettingsStatus.Success === deleteResult.status) || (SettingsStatus.SettingNotFound === deleteResult.status), "Delete should work or give SettingNotFound");
  });

  it("should save and retrieve an Application Setting (#integration)", async () => {
    const appSetting = { appString: "application String", appNumber: 112, appArray: [101, 102, 103, 104] };
    const settingName = `AppSetting${settingGuids[0]}`;

    // start by deleting the setting we're going to create.
    const deleteResult: SettingsResult = await settingsClient.deleteSetting(requestContext, "TestSettings", settingName, true);
    chai.assert((SettingsStatus.Success === deleteResult.status) || (SettingsStatus.SettingNotFound === deleteResult.status), "Delete should work or give SettingNotFound");

    // save a new setting (deleted above, so we know it's new)
    const saveResult: SettingsResult = await settingsClient.saveSetting(requestContext, appSetting, "TestSettings", settingName, true);
    chai.assert(SettingsStatus.Success === saveResult.status, "Save should work");

    // read back the result.
    const getResult: SettingsResult = await settingsClient.getSetting(requestContext, "TestSettings", settingName, true);
    chai.assert(SettingsStatus.Success === getResult.status, "Retrieval should work");
    chai.assert(getResult.setting, "Setting should be returned");
    chai.expect(getResult.setting.appString).equals(appSetting.appString);
    chai.expect(getResult.setting.appNumber).equals(appSetting.appNumber);
    chai.assert(arraysEqual(getResult.setting.appArray, appSetting.appArray), "retrieved array contents correct");

    // change the value of an existing setting
    appSetting.appString = "new Application String";
    appSetting.appArray.splice(2, 1);
    const saveResult2: SettingsResult = await settingsClient.saveSetting(requestContext, appSetting, "TestSettings", settingName, true);
    chai.assert(SettingsStatus.Success === saveResult2.status, "Second save should work");
    const getResult2: SettingsResult = await settingsClient.getSetting(requestContext, "TestSettings", settingName, true);
    chai.assert(SettingsStatus.Success === getResult2.status, "Retrieval should work");
    chai.assert(getResult2.setting, "Setting should be returned");
    chai.expect(getResult2.setting.appString).equals(appSetting.appString);
    chai.expect(getResult2.setting.appNumber).equals(appSetting.appNumber);
    chai.assert(arraysEqual(getResult2.setting.appArray, appSetting.appArray), "retrieved array contents correct");

  });

  // Application/Project Setting
  it("should save and retrieve a Project/Application Setting (#integration)", async () => {
    const projectAppSetting = { projAppString: "project Application String", projAppNumber: 592, projAppArray: [2101, 2102, 2103, 2104] };
    const settingName = `AppProjectSetting${settingGuids[0]}`;

    // start by deleting the setting we're going to create.
    let deleteResult: SettingsResult = await settingsClient.deleteSetting(requestContext, "TestSettings", settingName, true, projectId);
    chai.assert((SettingsStatus.Success === deleteResult.status) || (SettingsStatus.SettingNotFound === deleteResult.status), "Delete should work or give SettingNotFound");

    // save a new setting (deleted above, so we know it's new)
    const saveResult: SettingsResult = await settingsClient.saveSetting(requestContext, projectAppSetting, "TestSettings", settingName, true, projectId);
    chai.assert(SettingsStatus.Success === saveResult.status, "Save should work");

    // read back the result.
    const getResult: SettingsResult = await settingsClient.getSetting(requestContext, "TestSettings", settingName, true, projectId);
    chai.assert(SettingsStatus.Success === getResult.status, "Retrieval should work");
    chai.assert(getResult.setting, "Setting should be returned");
    chai.expect(getResult.setting.projAppString).equals(projectAppSetting.projAppString);
    chai.expect(getResult.setting.projAppNumber).equals(projectAppSetting.projAppNumber);
    chai.assert(arraysEqual(getResult.setting.projAppArray, projectAppSetting.projAppArray), "retrieved array contents correct");

    // change the value of an existing setting
    projectAppSetting.projAppString = "new Project Application String";
    projectAppSetting.projAppNumber = 1578;
    projectAppSetting.projAppArray.splice(2, 1);
    const saveResult2: SettingsResult = await settingsClient.saveSetting(requestContext, projectAppSetting, "TestSettings", settingName, true, projectId);
    chai.assert(SettingsStatus.Success === saveResult2.status, "Second save should work");
    const getResult2: SettingsResult = await settingsClient.getSetting(requestContext, "TestSettings", settingName, true, projectId);
    chai.assert(SettingsStatus.Success === getResult2.status, "Retrieval should work");
    chai.assert(getResult2.setting, "Setting should be returned");
    chai.expect(getResult2.setting.projAppString).equals(projectAppSetting.projAppString);
    chai.expect(getResult2.setting.projAppNumber).equals(projectAppSetting.projAppNumber);
    chai.assert(arraysEqual(getResult2.setting.projAppArray, projectAppSetting.projAppArray), "retrieved array contents correct");

    // Clean up
    deleteResult = await settingsClient.deleteSetting(requestContext, "TestSettings", settingName, true, projectId);
    chai.assert((SettingsStatus.Success === deleteResult.status) || (SettingsStatus.SettingNotFound === deleteResult.status), "Delete should work or give SettingNotFound");
  });

  // Application/IModel Setting
  it("should save and retrieve an iModel/Application Setting (#integration)", async () => {
    const iModelAppSetting = { iModelAppString: "iModel Application String", iModelAppNumber: 592, iModelAppArray: [3211, 3212, 3213, 3214, 3215] };
    const settingName = `AppIModelSettings${settingGuids[0]}`;

    // start by deleting the setting we're going to create.
    let deleteResult: SettingsResult = await settingsClient.deleteSetting(requestContext, "TestSettings", settingName, true, projectId, iModelId);
    chai.assert((SettingsStatus.Success === deleteResult.status) || (SettingsStatus.SettingNotFound === deleteResult.status), "Delete should work or give SettingNotFound");

    // save a new setting (deleted above, so we know it's new)
    const saveResult: SettingsResult = await settingsClient.saveSetting(requestContext, iModelAppSetting, "TestSettings", settingName, true, projectId, iModelId);
    chai.assert(SettingsStatus.Success === saveResult.status, "Save should work");

    // read back the result.
    const getResult: SettingsResult = await settingsClient.getSetting(requestContext, "TestSettings", settingName, true, projectId, iModelId);
    chai.assert(SettingsStatus.Success === getResult.status, "Retrieval should work");
    chai.assert(getResult.setting, "Setting should be returned");
    chai.expect(getResult.setting.iModelAppString).equals(iModelAppSetting.iModelAppString);
    chai.expect(getResult.setting.iModelAppNumber).equals(iModelAppSetting.iModelAppNumber);
    chai.assert(arraysEqual(getResult.setting.iModelAppArray, iModelAppSetting.iModelAppArray), "retrieved array contents correct");

    // change the value of an existing setting
    iModelAppSetting.iModelAppString = "new IModel Application String";
    iModelAppSetting.iModelAppNumber = 1578;
    iModelAppSetting.iModelAppArray.splice(2, 1);
    const saveResult2: SettingsResult = await settingsClient.saveSetting(requestContext, iModelAppSetting, "TestSettings", settingName, true, projectId, iModelId);
    chai.assert(SettingsStatus.Success === saveResult2.status, "Second save should work");
    const getResult2: SettingsResult = await settingsClient.getSetting(requestContext, "TestSettings", settingName, true, projectId, iModelId);
    chai.assert(SettingsStatus.Success === getResult2.status, "Retrieval should work");
    chai.assert(getResult2.setting, "Setting should be returned");
    chai.expect(getResult2.setting.iModelAppString).equals(iModelAppSetting.iModelAppString);
    chai.expect(getResult2.setting.iModelAppNumber).equals(iModelAppSetting.iModelAppNumber);
    chai.assert(arraysEqual(getResult2.setting.iModelAppArray, iModelAppSetting.iModelAppArray), "retrieved array contents correct");

    // Clean up
    deleteResult = await settingsClient.deleteSetting(requestContext, "TestSettings", settingName, true, projectId, iModelId);
    chai.assert((SettingsStatus.Success === deleteResult.status) || (SettingsStatus.SettingNotFound === deleteResult.status), "Delete should work or give SettingNotFound");
  });

  // Project Setting (application independent)
  it("should save and retrieve a Project Setting (Application independent) (#integration)", async () => {
    const projectSettingTemplate = { projNumber: 592, projArray: [8765, 4321, 9876, 5432, 1987] };

    const projectSettings: any[] = [];
    for (let iSetting = 0; iSetting < 5; iSetting++) {
      const tmpArray = projectSettingTemplate.projArray.map((value) => value * Math.pow(10, iSetting - 1));
      projectSettings.push({ projString: `Project String ${iSetting}`, projNumber: projectSettingTemplate.projNumber + 2 * iSetting, projArray: tmpArray });
    }

    // start by deleting the settings we're going to create.
    for (let iSetting = 0; iSetting < 5; iSetting++) {
      const deleteResult: SettingsResult = await settingsClient.deleteSetting(requestContext, "TestSettings", `ProjectSettings${settingGuids[iSetting]}`, false, projectId);
      chai.assert((SettingsStatus.Success === deleteResult.status) || (SettingsStatus.SettingNotFound === deleteResult.status), "Delete should work or give SettingNotFound");
    }

    // save new settings (deleted above, so we know they are new)
    for (let iSetting = 0; iSetting < 5; iSetting++) {
      const saveResult: SettingsResult = await settingsClient.saveSetting(requestContext, projectSettings[iSetting], "TestSettings", `ProjectSettings${settingGuids[iSetting]}`, false, projectId);
      chai.assert(SettingsStatus.Success === saveResult.status, "Save should work");
    }

    // read back the result.
    for (let iSetting = 0; iSetting < 5; iSetting++) {
      const getResult: SettingsResult = await settingsClient.getSetting(requestContext, "TestSettings", `ProjectSettings${settingGuids[iSetting]}`, false, projectId);
      chai.assert(SettingsStatus.Success === getResult.status, "Retrieval should work");
      chai.assert(getResult.setting, "Setting should be returned");
      chai.expect(getResult.setting.projString).equals(projectSettings[iSetting].projString);
      chai.expect(getResult.setting.projNumber).equals(projectSettings[iSetting].projNumber);
      chai.assert(arraysEqual(getResult.setting.projArray, projectSettings[iSetting].projArray), "retrieved array contents correct");
    }

    // change the value of an existing setting
    projectSettings[1].projString = "new Project String";
    projectSettings[1].projNumber = 1578;
    projectSettings[1].projArray.splice(2, 1);
    const saveResult2: SettingsResult = await settingsClient.saveSetting(requestContext, projectSettings[1], "TestSettings", `ProjectSettings${settingGuids[1]}`, false, projectId);
    chai.assert(SettingsStatus.Success === saveResult2.status, "Second save should work");
    const getResult2: SettingsResult = await settingsClient.getSetting(requestContext, "TestSettings", `ProjectSettings${settingGuids[1]}`, false, projectId);
    chai.assert(SettingsStatus.Success === getResult2.status, "Retrieval should work");
    chai.assert(getResult2.setting, "Setting should be returned");
    chai.expect(getResult2.setting.projString).equals(projectSettings[1].projString);
    chai.expect(getResult2.setting.projNumber).equals(projectSettings[1].projNumber);
    chai.assert(arraysEqual(getResult2.setting.projArray, projectSettings[1].projArray), "retrieved array contents correct");

    // now try getting all the Project settings by namespace
    const filterResult: SettingsMapResult = await settingsClient.getSettingsByNamespace(requestContext, "TestSettings", false, projectId);
    chai.assert(SettingsStatus.Success === filterResult.status, "Return by namespace should work");
    for (let iSetting: number = 0; iSetting < 5; iSetting++) {
      const settingName = `ProjectSettings${settingGuids[iSetting]}`;
      const setting: any | undefined = filterResult.settingsMap!.get(settingName);
      chai.assert(setting !== undefined, `Setting named '${settingName}' should be found in namespace 'TestSettings'`);
      chai.assert(setting.projNumber === projectSettings[iSetting].projNumber, `Setting named '${settingName}' should have projNumber of ${projectSettings[iSetting].projNumber}`);
      chai.assert(setting.projString === projectSettings[iSetting].projString, `Setting named '${settingName}' should have projString of ${projectSettings[iSetting].projString}`);
      chai.assert(arraysEqual(setting.projArray, projectSettings[iSetting].projArray), `Setting named '${settingName}' should have correct projArray`);
    }

    // Clean up
    for (let iSetting = 0; iSetting < 5; iSetting++) {
      const deleteResult: SettingsResult = await settingsClient.deleteSetting(requestContext, "TestSettings", `ProjectSettings${settingGuids[iSetting]}`, false, projectId);
      chai.assert((SettingsStatus.Success === deleteResult.status) || (SettingsStatus.SettingNotFound === deleteResult.status), "Delete should work or give SettingNotFound");
    }
  });

  // IModel Setting (application independent)
  it("should save and retrieve an iModel Setting (Application independent) (#integration)", async () => {
    const iModelSetting = { iModelString: "iModel String", iModelNumber: 592, iModelArray: [33482, 29385, 99742, 32195, 99475] };
    const settingName = `IModelSettings${settingGuids[0]}`;

    // start by deleting the setting we're going to create.
    let deleteResult: SettingsResult = await settingsClient.deleteSetting(requestContext, "TestSettings", settingName, false, projectId, iModelId);
    chai.assert((SettingsStatus.Success === deleteResult.status) || (SettingsStatus.SettingNotFound === deleteResult.status), "Delete should work or give SettingNotFound");

    // save a new setting (deleted above, so we know it's new)
    const saveResult: SettingsResult = await settingsClient.saveSetting(requestContext, iModelSetting, "TestSettings", settingName, false, projectId, iModelId);
    chai.assert(SettingsStatus.Success === saveResult.status, "Save should work");

    // read back the result.
    const getResult: SettingsResult = await settingsClient.getSetting(requestContext, "TestSettings", settingName, false, projectId, iModelId);
    chai.assert(SettingsStatus.Success === getResult.status, "Retrieval should work");
    chai.assert(getResult.setting, "Setting should be returned");
    chai.expect(getResult.setting.iModelString).equals(iModelSetting.iModelString);
    chai.expect(getResult.setting.iModelNumber).equals(iModelSetting.iModelNumber);
    chai.assert(arraysEqual(getResult.setting.iModelArray, iModelSetting.iModelArray), "retrieved array contents correct");

    // change the value of an existing setting
    iModelSetting.iModelString = "new IModel String";
    iModelSetting.iModelNumber = 1578;
    iModelSetting.iModelArray.splice(3, 1);
    const saveResult2: SettingsResult = await settingsClient.saveSetting(requestContext, iModelSetting, "TestSettings", settingName, false, projectId, iModelId);
    chai.assert(SettingsStatus.Success === saveResult2.status, "Second save should work");
    const getResult2: SettingsResult = await settingsClient.getSetting(requestContext, "TestSettings", settingName, false, projectId, iModelId);
    chai.assert(SettingsStatus.Success === getResult2.status, "Retrieval should work");
    chai.assert(getResult2.setting, "Setting should be returned");
    chai.expect(getResult2.setting.iModelString).equals(iModelSetting.iModelString);
    chai.expect(getResult2.setting.iModelNumber).equals(iModelSetting.iModelNumber);
    chai.assert(arraysEqual(getResult2.setting.iModelArray, iModelSetting.iModelArray), "retrieved array contents correct");

    // Clean up
    deleteResult = await settingsClient.deleteSetting(requestContext, "TestSettings", settingName, false, projectId, iModelId);
    chai.assert((SettingsStatus.Success === deleteResult.status) || (SettingsStatus.SettingNotFound === deleteResult.status), "Delete should work or give SettingNotFound");
  });
});

describe("Reading non-user settings from ordinary user (#integration)", () => {
  let projectId: GuidString;
  let iModelId: GuidString;
  let settingsClient: ConnectSettingsClient;
  let requestContext: AuthorizedClientRequestContext;

  before(async () => {
    settingsClient = new ConnectSettingsClient("1001");
    requestContext = await TestConfig.getAuthorizedClientRequestContext();

    projectId = (await TestConfig.queryProject(requestContext, TestConfig.projectName)).wsgId;
    chai.assert.isDefined(projectId);
    iModelId = (await TestConfig.queryIModel(requestContext, projectId)).wsgId;
    chai.assert.isDefined(iModelId);

    // Setup settings if they do not already exist -- We do not delete these settings since they will be shared by multiple concurrent test runs.
    const adminContext = await TestConfig.getAuthorizedClientRequestContext(TestUsers.super);
    await settingsClient.saveSetting(adminContext, { appString: "new Application String" }, "TestSettings", "AppSetting", true);
    await settingsClient.saveSetting(adminContext, { projAppString: "new Project Application String" }, "TestSettings", "AppProjectSetting", true, projectId);
    await settingsClient.saveSetting(adminContext, { iModelAppString: "new IModel Application String" }, "TestSettings", "AppIModelSettings", true, projectId, iModelId);
    await settingsClient.saveSetting(adminContext, { projString: "new Project String" }, "TestSettings", "ProjectSettings", false, projectId);
    await settingsClient.saveSetting(adminContext, { iModelString: "new IModel String" }, "TestSettings", "IModelSettings", false, projectId, iModelId);
  });

  // Application Setting
  it("should successfully retrieve an Application Setting (#integration)", async () => {
    const getResult: SettingsResult = await settingsClient.getSetting(requestContext, "TestSettings", "AppSetting", true);
    chai.assert(SettingsStatus.Success === getResult.status, "Retrieval should work");
    chai.assert(getResult.setting, "Setting should be returned");
    chai.expect(getResult.setting.appString).equals("new Application String");
  });

  // Application/Project Setting
  it("should successfully retrieve a Project/Application Setting (#integration)", async () => {
    // read back the result.
    const getResult: SettingsResult = await settingsClient.getSetting(requestContext, "TestSettings", "AppProjectSetting", true, projectId);
    chai.assert(SettingsStatus.Success === getResult.status, "Retrieval should work");
    chai.assert(getResult.setting, "Setting should be returned");
    chai.expect(getResult.setting.projAppString).equals("new Project Application String");
  });

  // Application/IModel Setting
  it("should successfully retrieve an iModel/Application Setting (#integration)", async () => {
    // read back the result.
    const getResult: SettingsResult = await settingsClient.getSetting(requestContext, "TestSettings", "AppIModelSettings", true, projectId, iModelId);
    chai.assert(SettingsStatus.Success === getResult.status, "Retrieval should work");
    chai.assert(getResult.setting, "Setting should be returned");
    chai.expect(getResult.setting.iModelAppString).equals("new IModel Application String");
  });

  // Project Setting (application independent)
  it("should successfully retrieve a Project Setting (Application independent)  (#integration)", async () => {
    // read back the result.
    const getResult: SettingsResult = await settingsClient.getSetting(requestContext, "TestSettings", "ProjectSettings1", false, projectId);
    chai.assert(SettingsStatus.Success === getResult.status, "Retrieval should work");
    chai.assert(getResult.setting, "Setting should be returned");
    chai.expect(getResult.setting.projString).equals("new Project String");
  });

  // IModel Setting (application independent)
  it("should successfully retrieve an iModel Setting (Application independent) (#integration)", async () => {
    // read back the result.
    const getResult: SettingsResult = await settingsClient.getSetting(requestContext, "TestSettings", "IModelSettings", false, projectId, iModelId);
    chai.assert(SettingsStatus.Success === getResult.status, "Retrieval should work");
    chai.assert(getResult.setting, "Setting should be returned");
    chai.expect(getResult.setting.iModelString).equals("new IModel String");
  });

});

describe("ConnectSettingsClient-Shared (#integration)", () => {
  let projectId: GuidString;
  let iModelId: GuidString;
  const settingsClient = new ConnectSettingsClient("1001");
  let requestContext: AuthorizedClientRequestContext;

  before(async () => {
    requestContext = await TestConfig.getAuthorizedClientRequestContext();

    projectId = (await TestConfig.queryProject(requestContext, TestConfig.projectName)).wsgId;
    chai.assert.isDefined(projectId);
    iModelId = (await TestConfig.queryIModel(requestContext, projectId)).wsgId;
    chai.assert.isDefined(iModelId);
  });

  // Note: There is no Application Shared Setting, so don't test that.

  // Project/Application/Shared -specific  Setting
  it("should save and retrieve a Project Shared setting for this Application (#integration)", async () => {
    const appProjectSharedSetting = { appString: "application/Project Shared String", appNumber: 213, appArray: [10, 20, 30, 40, 50] };
    const settingName = `AppProjectShared${settingGuids[0]}`;

    // start by deleting the setting we're going to create.
    let deleteResult: SettingsResult = await settingsClient.deleteSharedSetting(requestContext, "TestSettings", settingName, true, projectId);
    chai.assert((SettingsStatus.Success === deleteResult.status) || (SettingsStatus.SettingNotFound === deleteResult.status), "Delete should work or give SettingNotFound");

    // save a new setting (deleted above, so we know it's new)
    const saveResult: SettingsResult = await settingsClient.saveSharedSetting(requestContext, appProjectSharedSetting, "TestSettings", settingName, true, projectId);
    chai.assert(SettingsStatus.Success === saveResult.status, "Save should work");

    // read back the result.
    const getResult: SettingsResult = await settingsClient.getSharedSetting(requestContext, "TestSettings", settingName, true, projectId);
    chai.assert(SettingsStatus.Success === getResult.status, "Retrieval should work");
    chai.assert(getResult.setting, "Setting should be returned");
    chai.expect(getResult.setting.appString).equals(appProjectSharedSetting.appString);
    chai.expect(getResult.setting.appNumber).equals(appProjectSharedSetting.appNumber);
    chai.assert(arraysEqual(getResult.setting.appArray, appProjectSharedSetting.appArray), "retrieved array contents correct");

    // change the value of an existing setting
    appProjectSharedSetting.appString = "new Application Project Shared String";
    appProjectSharedSetting.appNumber = 8;
    appProjectSharedSetting.appArray.splice(2, 1);
    const saveResult2: SettingsResult = await settingsClient.saveSharedSetting(requestContext, appProjectSharedSetting, "TestSettings", settingName, true, projectId);
    chai.assert(SettingsStatus.Success === saveResult2.status, "Second save should work");
    const getResult2: SettingsResult = await settingsClient.getSharedSetting(requestContext, "TestSettings", settingName, true, projectId);
    chai.assert(SettingsStatus.Success === getResult2.status, "Retrieval should work");
    chai.assert(getResult2.setting, "Setting should be returned");
    chai.expect(getResult2.setting.appString).equals(appProjectSharedSetting.appString);
    chai.expect(getResult2.setting.appNumber).equals(appProjectSharedSetting.appNumber);
    chai.assert(arraysEqual(getResult2.setting.appArray, appProjectSharedSetting.appArray), "retrieved array contents correct");

    // Clean up
    deleteResult = await settingsClient.deleteSharedSetting(requestContext, "TestSettings", settingName, true, projectId);
    chai.assert((SettingsStatus.Success === deleteResult.status) || (SettingsStatus.SettingNotFound === deleteResult.status), "Delete should work or give SettingNotFound");
  });

  // iModel/Application/Shared -specific  Setting
  it("should save and retrieve an iModel Shared setting for this Application (#integration)", async () => {
    const appIModelSharedSetting = { appString: "application/iModel Shared String", appNumber: 41556, appArray: [1, 2, 3, 5, 8, 13, 21, 34] };
    const settingName = `AppIModelShared${settingGuids[0]}`;

    // start by deleting the setting we're going to create.
    let deleteResult: SettingsResult = await settingsClient.deleteSharedSetting(requestContext, "TestSettings", settingName, true, projectId, iModelId);
    chai.assert((SettingsStatus.Success === deleteResult.status) || (SettingsStatus.SettingNotFound === deleteResult.status), "Delete should work or give SettingNotFound");

    // save a new setting (deleted above, so we know it's new)
    const saveResult: SettingsResult = await settingsClient.saveSharedSetting(requestContext, appIModelSharedSetting, "TestSettings", settingName, true, projectId, iModelId);
    chai.assert(SettingsStatus.Success === saveResult.status, "Save should work");

    // read back the result.
    const getResult: SettingsResult = await settingsClient.getSharedSetting(requestContext, "TestSettings", settingName, true, projectId, iModelId);
    chai.assert(SettingsStatus.Success === getResult.status, "Retrieval should work");
    chai.assert(getResult.setting, "Setting should be returned");
    chai.expect(getResult.setting.appString).equals(appIModelSharedSetting.appString);
    chai.expect(getResult.setting.appNumber).equals(appIModelSharedSetting.appNumber);
    chai.assert(arraysEqual(getResult.setting.appArray, appIModelSharedSetting.appArray), "retrieved array contents correct");

    // change the value of an existing setting
    appIModelSharedSetting.appString = "new Application Shared iModel String";
    appIModelSharedSetting.appNumber = 32757;
    appIModelSharedSetting.appArray.splice(3, 2);
    const saveResult2: SettingsResult = await settingsClient.saveSharedSetting(requestContext, appIModelSharedSetting, "TestSettings", settingName, true, projectId, iModelId);
    chai.assert(SettingsStatus.Success === saveResult2.status, "Second save should work");
    const getResult2: SettingsResult = await settingsClient.getSharedSetting(requestContext, "TestSettings", settingName, true, projectId, iModelId);
    chai.assert(SettingsStatus.Success === getResult2.status, "Retrieval should work");
    chai.assert(getResult2.setting, "Setting should be returned");
    chai.expect(getResult2.setting.appString).equals(appIModelSharedSetting.appString);
    chai.expect(getResult2.setting.appNumber).equals(appIModelSharedSetting.appNumber);
    chai.assert(arraysEqual(getResult2.setting.appArray, appIModelSharedSetting.appArray), "retrieved array contents correct");

    // start by deleting the setting we're going to create.
    deleteResult = await settingsClient.deleteSharedSetting(requestContext, "TestSettings", settingName, true, projectId, iModelId);
    chai.assert((SettingsStatus.Success === deleteResult.status) || (SettingsStatus.SettingNotFound === deleteResult.status), "Delete should work or give SettingNotFound");
  });

  // Project/Shared -specific  Setting
  it("should save and retrieve a Project Shared setting (Application independent) (#integration)", async () => {
    const projectSharedSetting = { projString: "Project Shared String", projNumber: 213, projArray: [1, 3, 5, 7, 11, 13, 17] };
    const settingName = `ProjectShared${settingGuids[0]}`;

    // start by deleting the setting we're going to create.
    let deleteResult: SettingsResult = await settingsClient.deleteSharedSetting(requestContext, "TestSettings", settingName, false, projectId);
    chai.assert((SettingsStatus.Success === deleteResult.status) || (SettingsStatus.SettingNotFound === deleteResult.status), "Delete should work or give SettingNotFound");

    // save a new setting (deleted above, so we know it's new)
    const saveResult: SettingsResult = await settingsClient.saveSharedSetting(requestContext, projectSharedSetting, "TestSettings", settingName, false, projectId);
    chai.assert(SettingsStatus.Success === saveResult.status, "Save should work");

    // read back the result.
    const getResult: SettingsResult = await settingsClient.getSharedSetting(requestContext, "TestSettings", settingName, false, projectId);
    chai.assert(SettingsStatus.Success === getResult.status, "Retrieval should work");
    chai.assert(getResult.setting, "Setting should be returned");
    chai.expect(getResult.setting.projString).equals(projectSharedSetting.projString);
    chai.expect(getResult.setting.projNumber).equals(projectSharedSetting.projNumber);
    chai.assert(arraysEqual(getResult.setting.projArray, projectSharedSetting.projArray), "retrieved array contents correct");

    // change the value of an existing setting
    projectSharedSetting.projString = "new Project Shared String";
    projectSharedSetting.projNumber = 8;
    projectSharedSetting.projArray.splice(2, 2);
    const saveResult2: SettingsResult = await settingsClient.saveSharedSetting(requestContext, projectSharedSetting, "TestSettings", settingName, false, projectId);
    chai.assert(SettingsStatus.Success === saveResult2.status, "Second save should work");
    const getResult2: SettingsResult = await settingsClient.getSharedSetting(requestContext, "TestSettings", settingName, false, projectId);
    chai.assert(SettingsStatus.Success === getResult2.status, "Retrieval should work");
    chai.assert(getResult2.setting, "Setting should be returned");
    chai.expect(getResult2.setting.projString).equals(projectSharedSetting.projString);
    chai.expect(getResult2.setting.projNumber).equals(projectSharedSetting.projNumber);
    chai.assert(arraysEqual(getResult2.setting.projArray, projectSharedSetting.projArray), "retrieved array contents correct");

    // Clean up
    deleteResult = await settingsClient.deleteSharedSetting(requestContext, "TestSettings", settingName, false, projectId);
    chai.assert((SettingsStatus.Success === deleteResult.status) || (SettingsStatus.SettingNotFound === deleteResult.status), "Delete should work or give SettingNotFound");
  });

  // IModel/Shared -specific  Setting
  it("should save and retrieve an IModel Shared setting (Application independent) (#integration)", async () => {
    const iModelSharedSetting = { iModelString: "iModel Shared String", iModelNumber: 723, iModelArray: [99, 98, 97, 96, 95] };
    const settingName = `IModelShared${settingGuids[0]}`;

    // start by deleting the setting we're going to create.
    let deleteResult: SettingsResult = await settingsClient.deleteSharedSetting(requestContext, "TestSettings", settingName, false, projectId, iModelId);
    chai.assert((SettingsStatus.Success === deleteResult.status) || (SettingsStatus.SettingNotFound === deleteResult.status), "Delete should work or give SettingNotFound");

    // save a new setting (deleted above, so we know it's new)
    const saveResult: SettingsResult = await settingsClient.saveSharedSetting(requestContext, iModelSharedSetting, "TestSettings", settingName, false, projectId, iModelId);
    chai.assert(SettingsStatus.Success === saveResult.status, "Save should work");

    // read back the result.
    const getResult: SettingsResult = await settingsClient.getSharedSetting(requestContext, "TestSettings", settingName, false, projectId, iModelId);
    chai.assert(SettingsStatus.Success === getResult.status, "Retrieval should work");
    chai.assert(getResult.setting, "Setting should be returned");
    chai.expect(getResult.setting.iModelString).equals(iModelSharedSetting.iModelString);
    chai.expect(getResult.setting.iModelNumber).equals(iModelSharedSetting.iModelNumber);
    chai.assert(arraysEqual(getResult.setting.iModelArray, iModelSharedSetting.iModelArray), "retrieved array contents correct");

    // change the value of an existing setting
    iModelSharedSetting.iModelString = "new iModel Shared String";
    iModelSharedSetting.iModelNumber = 327;
    iModelSharedSetting.iModelArray.splice(2, 2);
    const saveResult2: SettingsResult = await settingsClient.saveSharedSetting(requestContext, iModelSharedSetting, "TestSettings", settingName, false, projectId, iModelId);
    chai.assert(SettingsStatus.Success === saveResult2.status, "Second save should work");
    const getResult2: SettingsResult = await settingsClient.getSharedSetting(requestContext, "TestSettings", settingName, false, projectId, iModelId);
    chai.assert(SettingsStatus.Success === getResult2.status, "Retrieval should work");
    chai.assert(getResult2.setting, "Setting should be returned");
    chai.expect(getResult2.setting.iModelString).equals(iModelSharedSetting.iModelString);
    chai.expect(getResult2.setting.iModelNumber).equals(iModelSharedSetting.iModelNumber);
    chai.assert(arraysEqual(getResult2.setting.iModelArray, iModelSharedSetting.iModelArray), "retrieved array contents correct");

    // clean up
    deleteResult = await settingsClient.deleteSharedSetting(requestContext, "TestSettings", settingName, false, projectId, iModelId);
    chai.assert((SettingsStatus.Success === deleteResult.status) || (SettingsStatus.SettingNotFound === deleteResult.status), "Delete should work or give SettingNotFound");
  });

  it("should be able to retrieve more than 20 IModel Shared settings by Namespace (Application independent)", async () => {
    const guids: GuidString[] = new Array<GuidString>();

    // Create a unique set of names for the settings
    for (let iSetting = 0; iSetting < 42; ++iSetting)
      guids.push(Guid.createValue());

    // start by deleting the settings we are going to create.
    for (let iSetting = 0; iSetting < 42; ++iSetting) {
      const deleteResult: SettingsResult = await settingsClient.deleteSharedSetting(requestContext, "NamespaceTest", `ManySettings${iSetting}`, false, projectId, iModelId);
      chai.assert((SettingsStatus.Success === deleteResult.status) || (SettingsStatus.SettingNotFound === deleteResult.status), "Delete should work or give SettingNotFound");
    }

    // now create many settings.
    for (let iSetting = 0; iSetting < 40; ++iSetting) {
      const newSetting: any = { testString: `Setting${iSetting}`, value: iSetting };
      const saveResult: SettingsResult = await settingsClient.saveSharedSetting(requestContext, newSetting, "NamespaceTest", `ManySettings${guids[iSetting]}`, false, projectId, iModelId);
      chai.assert((SettingsStatus.Success === saveResult.status), `Save of ManySettings${iSetting} should work`);
    }

    // now read back the (hopefully 40) settings by namespace and check them.
    let readResult: SettingsMapResult = await settingsClient.getSharedSettingsByNamespace(requestContext, "NamespaceTest", false, projectId, iModelId);
    chai.assert((SettingsStatus.Success === readResult.status), "Reading settings by namespace 'NamespaceTest' should work");
    chai.assert(((undefined !== readResult.settingsMap) && (40 <= readResult.settingsMap.size)), "NamespaceTest should contain at least 40 settings"); // Re-use this namespace for all test runs so there may be more than the 40 we added in this test run
    for (let iSetting = 0; iSetting < 40; iSetting++) {
      const returnedValue: any = readResult.settingsMap.get(`ManySettings${guids[iSetting]}`);
      chai.assert(((undefined !== returnedValue) && (returnedValue.testString === `Setting${iSetting}`) && (returnedValue.value === iSetting)), `Returned Setting ${iSetting} should contain the right values`);
    }

    // add two more and read again.
    for (let iSetting = 40; iSetting < 42; ++iSetting) {
      const newSetting: any = { testString: `Setting${iSetting}`, value: iSetting };
      const saveResult: SettingsResult = await settingsClient.saveSharedSetting(requestContext, newSetting, "NamespaceTest", `ManySettings${guids[iSetting]}`, false, projectId, iModelId);
      chai.assert((SettingsStatus.Success === saveResult.status), `Save of ManySettings${iSetting} should work`);
    }

    // now read back the now (hopefully 42) settings by namespace and check them again/
    readResult = await settingsClient.getSharedSettingsByNamespace(requestContext, "NamespaceTest", false, projectId, iModelId);
    chai.assert((SettingsStatus.Success === readResult.status), "Reading settings by namespace 'NamespaceTest' should work");
    chai.assert(((undefined !== readResult.settingsMap) && (42 <= readResult.settingsMap.size)), "NamespaceTest should contain at least 42 settings"); // Re-use this namespace for all test runs so there may be more than the 40 we added in this test run
    for (let iSetting = 0; iSetting < 42; iSetting++) {
      const returnedValue: any = readResult.settingsMap.get(`ManySettings${guids[iSetting]}`);
      chai.assert(((undefined !== returnedValue) && (returnedValue.testString === `Setting${iSetting}`) && (returnedValue.value === iSetting)), `Returned Setting ${iSetting} should contain the right values`);
    }

    // Clean up
    for (let iSetting = 0; iSetting < 42; ++iSetting) {
      const deleteResult: SettingsResult = await settingsClient.deleteSharedSetting(requestContext, "NamespaceTest", `ManySettings${guids[iSetting]}`, false, projectId, iModelId);
      chai.assert(SettingsStatus.Success === deleteResult.status, "Delete should work or give SettingNotFound");
    }
  });

});

describe("ConnectSettingsClient-User (#integration)", () => {
  let projectId: GuidString;
  let iModelId: GuidString;
  const settingsClient = new ConnectSettingsClient("1001");
  let requestContext: AuthorizedClientRequestContext;

  before(async () => {
    requestContext = await TestConfig.getAuthorizedClientRequestContext();

    projectId = (await TestConfig.queryProject(requestContext, TestConfig.projectName)).wsgId;
    chai.assert.isDefined(projectId);
    iModelId = (await TestConfig.queryIModel(requestContext, projectId)).wsgId;
    chai.assert.isDefined(iModelId);
  });

  // Application User Setting
  it("should still retrieve a user setting after an App setting with the same name is stored. (#integration)", async () => {
    const appUserSettings = { appString: "application User String 1", appNumber: 7, appArray: [20, 30, 40, 50] };

    // read back the AppUser results.
    for (let iSetting: number = 0; iSetting < 6; iSetting++) {
      const getResult: SettingsResult = await settingsClient.getUserSetting(requestContext, "TestSettings", "AppUser1", true);
      chai.assert(SettingsStatus.Success === getResult.status, "Retrieval should work");
      chai.assert(getResult.setting, "Setting should be returned");
      chai.expect(getResult.setting.appString).equals(appUserSettings.appString);
      chai.expect(getResult.setting.appNumber).equals(appUserSettings.appNumber);
      chai.assert(arraysEqual(getResult.setting.appArray, appUserSettings.appArray), "retrieved array contents correct");
    }
  });

});
class TestConnectSettingsClient extends ConnectSettingsClient {
  public constructor() {
    super("1001");
    this.baseUrl = "https://api.bentley.com/test-connect-settings";
  }
}

describe("Getting url from ConnectSettingsClient", () => {
  let client: TestConnectSettingsClient;

  beforeEach(() => {
    client = new TestConnectSettingsClient();
  });

  it("should not apply prefix without config entry", async () => {
    const requestContext = new ClientRequestContext();
    const url = await client.getUrl(requestContext);
    chai.expect(url).to.equal("https://api.bentley.com/test-connect-settings/v1.0");
  });

  it("should apply prefix with config entry", async () => {
    Config.App.set("imjs_url_prefix", "test-"); // eslint-disable-line deprecation/deprecation
    const requestContext = new ClientRequestContext();
    const url = await client.getUrl(requestContext);
    chai.expect(url).to.equal("https://test-api.bentley.com/test-connect-settings/v1.0");
    Config.App.remove("imjs_url_prefix"); // eslint-disable-line deprecation/deprecation
  });

  it("should consider api version exclusion in subsequent calls to getUrl", async () => {
    const requestContext = new ClientRequestContext();
    const urlWithVersion = await client.getUrl(requestContext);
    chai.expect(urlWithVersion).to.equal("https://api.bentley.com/test-connect-settings/v1.0");
    const urlWithoutVersion = await client.getUrl(requestContext, true);
    chai.expect(urlWithoutVersion).to.equal("https://api.bentley.com/test-connect-settings");
  });

  it("should consider api version exclusion in subsequent calls to getUrl (reverse direction)", async () => {
    const requestContext = new ClientRequestContext();
    const urlWithoutVersion = await client.getUrl(requestContext, true);
    chai.expect(urlWithoutVersion).to.equal("https://api.bentley.com/test-connect-settings");
    const urlWithVersion = await client.getUrl(requestContext);
    chai.expect(urlWithVersion).to.equal("https://api.bentley.com/test-connect-settings/v1.0");
    const anotherUrlWithoutVerson = await client.getUrl(requestContext, true);
    chai.expect(anotherUrlWithoutVerson).to.equal("https://api.bentley.com/test-connect-settings");
  });
});
