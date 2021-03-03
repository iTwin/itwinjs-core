/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as moq from "typemoq";
import * as sinon from "sinon";
import { Id64String, Logger } from "@bentley/bentleyjs-core";
import { IModelApp, IModelConnection, MockRender, ViewState } from "@bentley/imodeljs-frontend";
import { Presentation } from "@bentley/presentation-frontend";
import { initialize as initializePresentationTesting, terminate as terminatePresentationTesting } from "@bentley/presentation-testing";
import { ColorTheme, CursorMenuData, SettingsModalFrontstage, UiFramework } from "../ui-framework";
import { DefaultIModelServices } from "../ui-framework/clientservices/DefaultIModelServices";
import { DefaultProjectServices } from "../ui-framework/clientservices/DefaultProjectServices";
import TestUtils, { mockUserInfo } from "./TestUtils";
import { UiSettings } from "@bentley/ui-core";
import { OpenSettingsTool } from "../ui-framework/tools/OpenSettingsTool";

describe("UiFramework", () => {

  beforeEach(() => {
    TestUtils.terminateUiFramework();
  });

  afterEach(() => {
    TestUtils.terminateUiFramework();
  });

  it("store should throw Error without initialize", () => {
    expect(() => UiFramework.store).to.throw(Error);
  });

  it("i18n should throw Error without initialize", () => {
    expect(() => UiFramework.i18n).to.throw(Error);
  });

  it("i18nNamespace should return UiFramework", () => {
    expect(UiFramework.i18nNamespace).to.eq("UiFramework");
  });

  it("packageName should return ui-framework", () => {
    expect(UiFramework.packageName).to.eq("ui-framework");
  });

  it("translate should return the key (in test environment)", async () => {
    await TestUtils.initializeUiFramework(true);
    expect(UiFramework.translate("test1.test2")).to.eq("test1.test2");
  });

  it("test OpenSettingsTool", async () => {
    await TestUtils.initializeUiFramework(true);

    const spy = sinon.spy();
    const tabName = "page1";
    const handleOpenSetting = (settingsCategory: string)=> {
      expect (settingsCategory).to.eql(tabName);
      spy();
    };

    const handleOpenSetting2 = (_settingsCategory: string)=> {
      spy();
    };

    const showSettingsStageToRestore = Object.getOwnPropertyDescriptor(SettingsModalFrontstage, "showSettingsStage")!;
    Object.defineProperty(SettingsModalFrontstage, "showSettingsStage", {
      get: () => handleOpenSetting,
    });
    const tool = new OpenSettingsTool();
    // tabid arg
    tool.parseAndRun(tabName);
    spy.calledOnce.should.true;
    spy.resetHistory();

    // No tabid arg
    Object.defineProperty(SettingsModalFrontstage, "showSettingsStage", {
      get: () => handleOpenSetting2,
    });
    tool.parseAndRun();
    spy.calledOnce.should.true;
    spy.resetHistory();

    Object.defineProperty(SettingsModalFrontstage, "showSettingsStage", showSettingsStageToRestore);
  });

  it("loggerCategory should correctly handle null or undefined object", () => {
    expect(UiFramework.loggerCategory(null)).to.eq(UiFramework.packageName);
    expect(UiFramework.loggerCategory(undefined)).to.eq(UiFramework.packageName);
  });

  it("calling initialize twice should log", async () => {
    const spyLogger = sinon.spy(Logger, "logInfo");
    expect(UiFramework.initialized).to.be.false;
    await UiFramework.initialize(TestUtils.store, TestUtils.i18n);
    expect(UiFramework.initialized).to.be.true;
    await UiFramework.initialize(TestUtils.store, TestUtils.i18n);
    spyLogger.calledOnce.should.true;
  });

  it("calling initialize without I18N will use IModelApp.i18n", async () => {
    await MockRender.App.startup();

    await UiFramework.initialize(TestUtils.store);
    expect(UiFramework.i18n).to.eq(IModelApp.i18n);

    await MockRender.App.shutdown();
  });

  it("projectServices should throw Error without initialize", () => {
    expect(() => UiFramework.projectServices).to.throw(Error);
  });

  it("iModelServices should throw Error without initialize", () => {
    expect(() => UiFramework.iModelServices).to.throw(Error);
  });

  it("projectServices & iModelServices should return defaults", async () => {
    await TestUtils.initializeUiFramework(true);
    expect(UiFramework.projectServices).to.be.instanceOf(DefaultProjectServices);
    expect(UiFramework.iModelServices).to.be.instanceOf(DefaultIModelServices);
    expect(UiFramework.frameworkStateKey).to.equal("testDifferentFrameworkKey");
  });

  it("test default frameworkState key", async () => {
    await TestUtils.initializeUiFramework();
    expect(UiFramework.projectServices).to.be.instanceOf(DefaultProjectServices);
    expect(UiFramework.iModelServices).to.be.instanceOf(DefaultIModelServices);
    expect(UiFramework.frameworkStateKey).to.equal("frameworkState");
    TestUtils.terminateUiFramework();
  });

  it("IsUiVisible", async () => {
    await TestUtils.initializeUiFramework();
    UiFramework.setIsUiVisible(false);
    expect(UiFramework.getIsUiVisible()).to.be.false;
    TestUtils.terminateUiFramework();
  });

  it("ColorTheme", async () => {
    await TestUtils.initializeUiFramework();
    UiFramework.setColorTheme(ColorTheme.Dark);
    expect(UiFramework.getColorTheme()).to.eq(ColorTheme.Dark);
    TestUtils.terminateUiFramework();
  });

  it("test selection scope state data", async () => {
    await TestUtils.initializeUiFramework();
    expect(UiFramework.getActiveSelectionScope()).to.equal("element");
    const scopes = UiFramework.getAvailableSelectionScopes();
    expect(scopes.length).to.be.greaterThan(0);

    // since "file" is not a valid scope the active scope should still be element
    UiFramework.setActiveSelectionScope("file");
    expect(UiFramework.getActiveSelectionScope()).to.equal("element");
    TestUtils.terminateUiFramework();
  });

  it("WidgetOpacity", async () => {
    await TestUtils.initializeUiFramework();
    const testValue = 0.50;
    UiFramework.setWidgetOpacity(testValue);
    expect(UiFramework.getWidgetOpacity()).to.eq(testValue);
    TestUtils.terminateUiFramework();
  });

  it("ActiveIModelId", async () => {
    await TestUtils.initializeUiFramework();
    const testValue = "Test";
    UiFramework.setActiveIModelId(testValue);
    expect(UiFramework.getActiveIModelId()).to.eq(testValue);
    TestUtils.terminateUiFramework();
  });

  it("SessionState setters/getters", async () => {
    await TestUtils.initializeUiFramework();

    const userInfo = mockUserInfo();

    UiFramework.setUserInfo(userInfo);
    expect(UiFramework.getUserInfo()!.id).to.eq(userInfo.id);

    UiFramework.setDefaultIModelViewportControlId("DefaultIModelViewportControlId");
    expect(UiFramework.getDefaultIModelViewportControlId()).to.eq("DefaultIModelViewportControlId");

    const testViewId: Id64String = "0x12345678";
    UiFramework.setDefaultViewId(testViewId);
    expect(UiFramework.getDefaultViewId()).to.eq(testViewId);

    const imodelMock = moq.Mock.ofType<IModelConnection>();
    UiFramework.setIModelConnection(imodelMock.object);
    expect(UiFramework.getIModelConnection()).to.eq(imodelMock.object);

    const uisettingsMock = moq.Mock.ofType<UiSettings>();
    UiFramework.setUiSettings(uisettingsMock.object);
    expect(UiFramework.getUiSettings()).to.eq(uisettingsMock.object);

    UiFramework.closeCursorMenu();
    expect(UiFramework.getCursorMenuData()).to.be.undefined;

    const menuData: CursorMenuData = { items: [], position: { x: 100, y: 100 } };
    UiFramework.openCursorMenu(menuData);
    expect(UiFramework.getCursorMenuData()).not.to.be.undefined;

    const viewState = moq.Mock.ofType<ViewState>();
    UiFramework.setDefaultViewState(viewState.object);
    expect(UiFramework.getDefaultViewState()).not.to.be.undefined;
  });

});

// before we can test setting scope to a valid scope id we must make sure Presentation Manager is initialized.
describe("Requires Presentation", () => {
  const shutdownIModelApp = async () => {
    if (IModelApp.initialized)
      await IModelApp.shutdown();
  };

  beforeEach(async () => {
    await shutdownIModelApp();
    Presentation.terminate();
    await initializePresentationTesting();
  });

  afterEach(async () => {
    await terminatePresentationTesting();
  });

  describe("initialize and setActiveSelectionScope", () => {

    it("creates manager instances", async () => {
      await TestUtils.initializeUiFramework();
      UiFramework.setActiveSelectionScope("element");
      TestUtils.terminateUiFramework();

      Presentation.terminate();
      await shutdownIModelApp();
    });
  });

});
