/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as moq from "typemoq";
import { Presentation } from "@bentley/presentation-frontend";
import { IModelApp, IModelConnection, ViewState } from "@bentley/imodeljs-frontend";
import { Id64String } from "@bentley/bentleyjs-core";
import { initialize as initializePresentationTesting, terminate as terminatePresentationTesting } from "@bentley/presentation-testing";
import TestUtils, { MockAccessToken } from "./TestUtils";
import { UiFramework, ColorTheme, CursorMenuData } from "../ui-framework";
import { DefaultIModelServices } from "../ui-framework/clientservices/DefaultIModelServices";
import { DefaultProjectServices } from "../ui-framework/clientservices/DefaultProjectServices";

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

  it("loggerCategory should correctly handle null or undefined object", () => {
    expect(UiFramework.loggerCategory(null)).to.eq(UiFramework.packageName);
    expect(UiFramework.loggerCategory(undefined)).to.eq(UiFramework.packageName);
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

    const mockToken = new MockAccessToken();

    UiFramework.setAccessToken(mockToken);    // tslint:disable-line: deprecation
    expect(UiFramework.getAccessToken()!.getUserInfo()!.id).to.eq(mockToken.getUserInfo()!.id); // tslint:disable-line: deprecation

    UiFramework.setDefaultRulesetId("TestRuleSet");
    expect(UiFramework.getDefaultRulesetId()).to.eq("TestRuleSet");

    UiFramework.setDefaultIModelViewportControlId("DefaultIModelViewportControlId");
    expect(UiFramework.getDefaultIModelViewportControlId()).to.eq("DefaultIModelViewportControlId");

    const testViewId: Id64String = "0x12345678";
    UiFramework.setDefaultViewId(testViewId);
    expect(UiFramework.getDefaultViewId()).to.eq(testViewId);

    const imodelMock = moq.Mock.ofType<IModelConnection>();
    UiFramework.setIModelConnection(imodelMock.object);
    expect(UiFramework.getIModelConnection()).to.eq(imodelMock.object);

    UiFramework.closeCursorMenu();
    expect(UiFramework.getCursorMenuData()).to.be.undefined;

    const menuData: CursorMenuData = { items: [], position: { x: 100, y: 100 } };
    UiFramework.openCursorMenu(menuData);
    expect(UiFramework.getCursorMenuData()).not.to.be.undefined;

    const viewState = moq.Mock.ofType<ViewState>();
    UiFramework.setDefaultViewState(viewState.object);
    expect(UiFramework.getDefaultViewState()).not.to.be.undefined;

    UiFramework.oidcClient = undefined;
    expect(UiFramework.oidcClient).to.be.undefined;
  });

});

// before we can test setting scope to a valid scope id we must make sure Presentation Manager is initialized.
describe("Requires Presentation", () => {
  const shutdownIModelApp = () => {
    if (IModelApp.initialized)
      IModelApp.shutdown();
  };

  beforeEach(async () => {
    shutdownIModelApp();
    Presentation.terminate();
    await initializePresentationTesting();
  });

  afterEach(() => {
    terminatePresentationTesting();
  });

  describe("initialize and setActiveSelectionScope", () => {

    it("creates manager instances", async () => {
      await TestUtils.initializeUiFramework();
      UiFramework.setActiveSelectionScope("element");
      TestUtils.terminateUiFramework();

      Presentation.terminate();
      shutdownIModelApp();
    });
  });
});
