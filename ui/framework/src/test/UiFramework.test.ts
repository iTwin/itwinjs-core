/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
// cSpell:ignore typemoq, tabid

import { expect } from "chai";
import * as moq from "typemoq";
import * as sinon from "sinon";
import { IModelRpcProps } from "@bentley/imodeljs-common";
import { RpcRequestsHandler } from "@bentley/presentation-common";
import { createRandomSelectionScope } from "@bentley/presentation-common/lib/test/_helpers/random";
import { Id64String, Logger } from "@bentley/bentleyjs-core";
import { IModelApp, IModelConnection, MockRender, SelectionSet, ViewState } from "@bentley/imodeljs-frontend";
import { Presentation, SelectionManager, SelectionScopesManager, SelectionScopesManagerProps } from "@bentley/presentation-frontend";
import { initialize as initializePresentationTesting, terminate as terminatePresentationTesting } from "@bentley/presentation-testing";
import { ColorTheme, CursorMenuData, SettingsModalFrontstage, UiFramework, UserSettingsProvider } from "../ui-framework";
import { DefaultIModelServices } from "../ui-framework/clientservices/DefaultIModelServices";
import { DefaultProjectServices } from "../ui-framework/clientservices/DefaultProjectServices";
import TestUtils, { mockUserInfo, storageMock } from "./TestUtils";
import { LocalSettingsStorage, UiSettingsStorage } from "@bentley/ui-core";
import { OpenSettingsTool } from "../ui-framework/tools/OpenSettingsTool";

describe("UiFramework localStorage Wrapper", () => {

  const localStorageToRestore = Object.getOwnPropertyDescriptor(window, "localStorage")!;
  const localStorageMock = storageMock();

  before(async () => {
    Object.defineProperty(window, "localStorage", {
      get: () => localStorageMock,
    });
  });

  after(() => {
    Object.defineProperty(window, "localStorage", localStorageToRestore);
  });

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
      const handleOpenSetting = (settingsCategory: string) => {
        expect(settingsCategory).to.eql(tabName);
        spy();
      };

      const handleOpenSetting2 = (_settingsCategory: string) => {
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

    class testSettingsProvider implements UserSettingsProvider {
      public readonly providerId = "testSettingsProvider";
      public settingsLoaded = false;
      public async loadUserSettings(storage: UiSettingsStorage) {
        if (storage)
          this.settingsLoaded = true;
      }
    }

    it("SessionState setters/getters", async () => {
      await TestUtils.initializeUiFramework();
      const settingsProvider = new testSettingsProvider();
      UiFramework.registerUserSettingsProvider(settingsProvider);

      const userInfo = mockUserInfo();

      UiFramework.setUserInfo(userInfo);
      expect(UiFramework.getUserInfo()!.id).to.eq(userInfo.id);

      UiFramework.setDefaultIModelViewportControlId("DefaultIModelViewportControlId");
      expect(UiFramework.getDefaultIModelViewportControlId()).to.eq("DefaultIModelViewportControlId");

      const testViewId: Id64String = "0x12345678";
      UiFramework.setDefaultViewId(testViewId);
      expect(UiFramework.getDefaultViewId()).to.eq(testViewId);

      expect(settingsProvider.settingsLoaded).to.be.false;

      const uisettings = new LocalSettingsStorage();
      await UiFramework.setUiSettingsStorage(uisettings);
      expect(UiFramework.getUiSettingsStorage()).to.eq(uisettings);
      expect(settingsProvider.settingsLoaded).to.be.true;
      settingsProvider.settingsLoaded = false;
      // if we try to set storage to same object this should be a noop and the settingsLoaded property should remain false;
      await UiFramework.setUiSettingsStorage(uisettings);
      expect(settingsProvider.settingsLoaded).to.be.false;

      const uiVersion1 = "1";
      UiFramework.setUiVersion(uiVersion1);
      expect(UiFramework.uiVersion).to.eql(uiVersion1);

      const uiVersion = "2";
      UiFramework.setUiVersion(uiVersion);
      expect(UiFramework.uiVersion).to.eql(uiVersion);
      UiFramework.setUiVersion("");
      expect(UiFramework.uiVersion).to.eql(uiVersion);

      const useDragInteraction = true;
      UiFramework.setUseDragInteraction(useDragInteraction);
      expect(UiFramework.useDragInteraction).to.eql(useDragInteraction);

      UiFramework.closeCursorMenu();
      expect(UiFramework.getCursorMenuData()).to.be.undefined;

      const menuData: CursorMenuData = { items: [], position: { x: 100, y: 100 } };
      UiFramework.openCursorMenu(menuData);
      expect(UiFramework.getCursorMenuData()).not.to.be.undefined;

      const viewState = moq.Mock.ofType<ViewState>();
      UiFramework.setDefaultViewState(viewState.object);
      expect(UiFramework.getDefaultViewState()).not.to.be.undefined;

      TestUtils.terminateUiFramework();

      // try again when store is not defined
      expect(UiFramework.useDragInteraction).to.eql(false);
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

  describe("ConnectionEvents", () => {
    const imodelToken: IModelRpcProps = { key: "" };
    const imodelMock = moq.Mock.ofType<IModelConnection>();
    const rpcRequestsHandlerMock = moq.Mock.ofType<RpcRequestsHandler>();
    let manager: SelectionScopesManager | undefined;
    let managerProps: SelectionScopesManagerProps;
    let ss: SelectionSet;

    const getManager = () => {
      if (!manager)
        manager = new SelectionScopesManager(managerProps);
      return manager;
    };

    beforeEach(async () => {
      await TestUtils.initializeUiFramework(false);

      imodelMock.reset();
      imodelMock.setup((x) => x.getRpcProps()).returns(() => imodelToken);

      ss = new SelectionSet(imodelMock.object);
      imodelMock.setup((x) => x.selectionSet).returns(() => ss);

      rpcRequestsHandlerMock.reset();
      manager = undefined;
      managerProps = {
        rpcRequestsHandler: rpcRequestsHandlerMock.object,
      };

      const result = [createRandomSelectionScope()];
      rpcRequestsHandlerMock
        .setup(async (x) => x.getSelectionScopes(moq.It.isObjectWith({ imodel: imodelToken, locale: undefined })))
        .returns(async () => result)
        .verifiable();

      Presentation.setSelectionManager(new SelectionManager({ scopes: getManager() }));
    });

    afterEach(() => {
      TestUtils.terminateUiFramework();
    });

    it("SessionState setIModelConnection", async () => {

      UiFramework.setIModelConnection(imodelMock.object);
      expect(UiFramework.getIModelConnection()).to.eq(imodelMock.object);
    });
  });
});
