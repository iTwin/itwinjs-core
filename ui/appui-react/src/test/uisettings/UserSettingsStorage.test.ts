/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as sinon from "sinon";
import { assert, expect } from "chai";
import type { ITwinIdArg, PreferenceArg, PreferenceKeyArg, TokenArg } from "@itwin/core-frontend";
import { IModelApp, MockRender } from "@itwin/core-frontend";
import { UiStateStorageStatus } from "@itwin/core-react";
import { UserSettingsStorage } from "../../appui-react/uistate/UserSettingsStorage";
import { TestUtils } from "../TestUtils";

/* eslint-disable deprecation/deprecation */

describe("UserSettingsStorage", () => {
  before(async () => {
    await TestUtils.initializeUiFramework();
    await MockRender.App.startup();
  });

  after(async () => {
    await MockRender.App.shutdown();
  });

  beforeEach(() => {
    const storage = new Map<string, any>();
    sinon.stub(IModelApp, "userPreferences").get(() => ({
      get: async (arg: PreferenceKeyArg & ITwinIdArg & TokenArg) => storage.get(arg.key),
      save: async (arg: PreferenceArg & ITwinIdArg & TokenArg) => storage.set(arg.key, arg.content),
      delete: async (arg: PreferenceKeyArg & ITwinIdArg & TokenArg) => storage.delete(arg.key),
    }));
  });

  afterEach(() => {
    sinon.restore();
  });

  it("should save setting", async () => {
    sinon.stub(IModelApp, "authorizationClient").get(() => ({ getAccessToken: async () => { return "TestToken"; } }));
    const sut = new UserSettingsStorage();
    const testValue = "testvalue";
    await sut.saveSetting("TESTNAMESPACE", "TESTNAME", testValue);
    const result = await sut.getSetting("TESTNAMESPACE", "TESTNAME");
    assert.equal(result.status, UiStateStorageStatus.Success);
    assert.isDefined(result.setting);
  });

  it("should delete setting", async () => {
    sinon.stub(IModelApp, "authorizationClient").get(() => ({ getAccessToken: async () => { return "TestToken"; } }));
    const sut = new UserSettingsStorage();
    await sut.deleteSetting("TESTNAMESPACE", "TESTNAME");
    const result = await sut.getSetting("TESTNAMESPACE", "TESTNAME");
    assert.equal(result.status, UiStateStorageStatus.Success);
    assert.isUndefined(result.setting);
  });

  it("should get setting", async () => {
    sinon.stub(IModelApp, "authorizationClient").get(() => ({ getAccessToken: async () => { return "TestToken"; } }));
    const sut = new UserSettingsStorage();
    await sut.saveSetting("TESTNAMESPACE", "TESTNAME", "testvalue");
    const settingResult = await sut.getSetting("TESTNAMESPACE", "TESTNAME");
    settingResult.setting.should.eq("testvalue");
  });

  it("should fail to save setting when invalid token is returned", async () => {
    sinon.stub(IModelApp, "authorizationClient").get(() => ({ getAccessToken: async () => { return undefined; } }));
    const sut = new UserSettingsStorage();
    const result = await sut.saveSetting("TESTNAMESPACE", "TESTNAME", "testvalue");
    expect(result.status).to.eq(UiStateStorageStatus.AuthorizationError);
  });

  it("should fail to delete setting when invalid token is returned", async () => {
    sinon.stub(IModelApp, "authorizationClient").get(() => ({ getAccessToken: async () => { return undefined; } }));
    const sut = new UserSettingsStorage();
    const result = await sut.deleteSetting("TESTNAMESPACE", "TESTNAME");
    expect(result.status).to.eq(UiStateStorageStatus.AuthorizationError);
  });

  it("should fail to get setting when invalid token is returned", async () => {
    sinon.stub(IModelApp, "authorizationClient").get(() => ({ getAccessToken: async () => { return undefined; } }));
    const sut = new UserSettingsStorage();
    const result = await sut.getSetting("TESTNAMESPACE", "TESTNAME");
    expect(result.status).to.eq(UiStateStorageStatus.AuthorizationError);
  });

  it("should fail to save setting when authorization is not defined", async () => {
    const sut = new UserSettingsStorage();
    const result = await sut.saveSetting("TESTNAMESPACE", "TESTNAME", "testvalue");
    expect(result.status).to.eq(UiStateStorageStatus.AuthorizationError);
  });

  it("should fail to delete setting when authorization is not defined", async () => {
    const sut = new UserSettingsStorage();
    const result = await sut.deleteSetting("TESTNAMESPACE", "TESTNAME");
    expect(result.status).to.eq(UiStateStorageStatus.AuthorizationError);
  });

  it("should fail to get setting when authorization is not defined", async () => {
    const sut = new UserSettingsStorage();
    const result = await sut.getSetting("TESTNAMESPACE", "TESTNAME");
    expect(result.status).to.eq(UiStateStorageStatus.AuthorizationError);
  });

});
