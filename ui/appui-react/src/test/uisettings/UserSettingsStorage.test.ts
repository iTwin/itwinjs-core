/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as sinon from "sinon";
import { expect } from "chai";
import { IModelApp, MockRender } from "@itwin/core-frontend";
import { UiSettingsStatus } from "@itwin/core-react";
import { UserSettingsStorage } from "../../appui-react";
import { TestUtils } from "../TestUtils";

describe("UserSettingsStorage", () => {
  before(async () => {
    await TestUtils.initializeUiFramework();
    await MockRender.App.startup();
  });

  after(async () => {
    await MockRender.App.shutdown();
  });

  it("should save setting", async () => {
    const storage = new Map<string, any>();

    const getStorage = sinon.stub(IModelApp.userPreferences, "get").callsFake(async (arg) => {
      return storage.get(arg.key);
    });
    sinon.stub(IModelApp.userPreferences, "save").callsFake(async (arg) => {
      storage.set(arg.key, arg.content);
    });
    sinon.stub(IModelApp, "authorizationClient").get(() => ({ getAccessToken: async () => { return "TestToken"; } }));
    const sut = new UserSettingsStorage();
    await sut.saveSetting("TESTNAMESPACE", "TESTNAME", "testvalue");

    // getStorage.calledOnceWithExactly({ content: "testvalue", key: "TESTNAMESPACE.TESTNAME" }).should.true;
  });

  it("should delete setting", async () => {
    const deleteStorage = sinon.stub(IModelApp.userPreferences, "delete").callsFake(async (_arg) => { });
    sinon.stub(IModelApp, "authorizationClient").get(() => ({ getAccessToken: async () => { return "TestToken"; } }));
    const sut = new UserSettingsStorage();
    await sut.deleteSetting("TESTNAMESPACE", "TESTNAME");
    deleteStorage.calledOnceWithExactly({ key: "TESTNAMESPACE.TESTNAME" }).should.true;
  });

  it("should get setting", async () => {
    const getStorage = sinon.stub(IModelApp.userPreferences, "get").callsFake(async (_arg) => {
      return "testvalue";
    });
    sinon.stub(IModelApp, "authorizationClient").get(() => ({ getAccessToken: async () => { return "TestToken"; } }));
    const sut = new UserSettingsStorage();
    const settingResult = await sut.getSetting("TESTNAMESPACE", "TESTNAME");
    getStorage.calledOnceWithExactly({ key: "TESTNAMESPACE.TESTNAME" }).should.true;
    settingResult.setting.should.eq("testvalue");
  });

  it("should fail to save setting", async () => {
    sinon.stub(IModelApp, "authorizationClient").get(() => ({ getAccessToken: async () => { return undefined; } }));
    const sut = new UserSettingsStorage();
    const result = await sut.saveSetting("TESTNAMESPACE", "TESTNAME", "testvalue");
    expect(result.status).to.eq(UiSettingsStatus.AuthorizationError);
  });

  it("should fail to delete setting", async () => {
    sinon.stub(IModelApp, "authorizationClient").get(() => ({ getAccessToken: async () => { return undefined; } }));
    const sut = new UserSettingsStorage();
    const result = await sut.deleteSetting("TESTNAMESPACE", "TESTNAME");
    expect(result.status).to.eq(UiSettingsStatus.AuthorizationError);
  });

  it("should fail to get setting", async () => {
    sinon.stub(IModelApp, "authorizationClient").get(() => ({ getAccessToken: async () => { return undefined; } }));
    const sut = new UserSettingsStorage();
    const result = await sut.getSetting("TESTNAMESPACE", "TESTNAME");
    expect(result.status).to.eq(UiSettingsStatus.AuthorizationError);
  });

});
