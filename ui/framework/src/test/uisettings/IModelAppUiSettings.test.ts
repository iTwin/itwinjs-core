/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as sinon from "sinon";
import { IModelApp, AuthorizedFrontendRequestContext } from "@bentley/imodeljs-frontend";
import { IModelAppUiSettings, settingsStatusToUiSettingsStatus } from "../../ui-framework";
import { SettingsResult, SettingsStatus, SettingsAdmin } from "@bentley/imodeljs-clients";
import { UiSettingsStatus } from "@bentley/ui-core";

describe("IModelAppUiSettings", () => {
  const sandbox = sinon.createSandbox();

  beforeEach(() => {
    sandbox.stub(AuthorizedFrontendRequestContext, "create").resolves({} as AuthorizedFrontendRequestContext);
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("should save setting", async () => {
    const saveUserSetting = sandbox.stub<SettingsAdmin["saveUserSetting"]>().resolves(new SettingsResult(SettingsStatus.Success));
    sandbox.stub(IModelApp, "settings").get(() => ({
      saveUserSetting,
    }));
    const sut = new IModelAppUiSettings();
    await sut.saveSetting("TESTNAMESPACE", "TESTNAME", "testvalue");
    saveUserSetting.calledOnceWithExactly(sinon.match.any, "testvalue", "TESTNAMESPACE", "TESTNAME", true).should.true;
  });

  it("should delete setting", async () => {
    const deleteUserSetting = sandbox.stub<SettingsAdmin["deleteUserSetting"]>().resolves(new SettingsResult(SettingsStatus.Success));
    sandbox.stub(IModelApp, "settings").get(() => ({
      deleteUserSetting,
    }));
    const sut = new IModelAppUiSettings();
    await sut.deleteSetting("TESTNAMESPACE", "TESTNAME");
    deleteUserSetting.calledOnceWithExactly(sinon.match.any, "TESTNAMESPACE", "TESTNAME", true).should.true;
  });

  it("should get setting", async () => {
    const getUserSetting = sandbox.stub<SettingsAdmin["getUserSetting"]>().resolves(new SettingsResult(SettingsStatus.Success, undefined, "testvalue"));
    sandbox.stub(IModelApp, "settings").get(() => ({
      getUserSetting,
    }));
    const sut = new IModelAppUiSettings();
    const settingResult = await sut.getSetting("TESTNAMESPACE", "TESTNAME");
    getUserSetting.calledOnceWithExactly(sinon.match.any, "TESTNAMESPACE", "TESTNAME", true).should.true;
    settingResult.setting.should.eq("testvalue");
  });
});

describe("settingsStatusToUiSettingsStatus", () => {
  it("should return Success", () => {
    settingsStatusToUiSettingsStatus(SettingsStatus.Success).should.eq(UiSettingsStatus.Success);
  });

  it("should return NotFound", () => {
    settingsStatusToUiSettingsStatus(SettingsStatus.SettingNotFound).should.eq(UiSettingsStatus.NotFound);
  });

  it("should return UnknownError", () => {
    settingsStatusToUiSettingsStatus(SettingsStatus.AuthorizationError).should.eq(UiSettingsStatus.UnknownError);
  });
});
