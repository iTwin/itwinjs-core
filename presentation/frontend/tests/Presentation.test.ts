/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import "@helpers/MockFrontendEnvironment";
import { expect, spy } from "chai";
import * as moq from "@helpers/Mocks";
// import { initializeRpcInterface } from "@helpers/RpcHelper";
import { I18N } from "@bentley/imodeljs-i18n";
import { IModelApp, NoRenderApp } from "@bentley/imodeljs-frontend";
import { /*PresentationRpcInterface,*/ PresentationError } from "@common/index";
import { Presentation } from "@src/index";
import { SelectionManager } from "@src/selection";
import PresentationManager from "@src/PresentationManager";

describe("Presentation", () => {

  const shutdownIModelApp = () => {
    if (NoRenderApp.initialized)
      NoRenderApp.shutdown();
  };

  beforeEach(() => {
    shutdownIModelApp();
    NoRenderApp.startup();
    // initializeRpcInterface(PresentationRpcInterface);
    // const interfaceMock = moq.Mock.ofType<PresentationRpcInterface>();
    // PresentationRpcInterface.getClient = () => interfaceMock.object;
    Presentation.terminate();
  });

  describe("initialize", () => {

    it("throws when initialized before IModelApp.startup()", () => {
      shutdownIModelApp();
      expect(() => Presentation.initialize()).to.throw(PresentationError, "IModelApp.startup");
    });

    it("creates manager instances", () => {
      expect(() => Presentation.presentation).to.throw();
      expect(() => Presentation.selection).to.throw();
      expect(() => Presentation.i18n).to.throw();
      Presentation.initialize();
      expect(Presentation.presentation).to.be.instanceof(PresentationManager);
      expect(Presentation.selection).to.be.instanceof(SelectionManager);
    });

    it("initializes PresentationManager with props", () => {
      const constructorSpy = spy.on(PresentationManager, PresentationManager.create.name);
      const props = {
        activeLocale: "test-locale",
      };
      Presentation.initialize(props);
      expect(constructorSpy).to.be.called.with(props);
    });

    it("initializes PresentationManager.i18n with IModelApp.i18", () => {
      const i18nMock = moq.Mock.ofType<I18N>();
      IModelApp.i18n = i18nMock.object;
      Presentation.initialize({ activeLocale: "test" });
      expect(Presentation.i18n).to.equal(i18nMock.object);
    });

    it("initializes PresentationManager with Presentation.i18 locale if no props provided", () => {
      const i18nMock = moq.Mock.ofType<I18N>();
      i18nMock.setup((x) => x.languageList()).returns(() => ["test-locale"]).verifiable();
      Presentation.i18n = i18nMock.object;
      const constructorSpy = spy.on(PresentationManager, PresentationManager.create.name);
      Presentation.initialize();
      expect(constructorSpy).to.be.called.with({
        activeLocale: "test-locale",
      });
      i18nMock.verifyAll();
    });

    it("initializes PresentationManager with i18 locale if no activeLocale set in props", () => {
      const i18nMock = moq.Mock.ofType<I18N>();
      i18nMock.setup((x) => x.languageList()).returns(() => ["test-locale"]).verifiable();
      Presentation.i18n = i18nMock.object;
      const constructorSpy = spy.on(PresentationManager, PresentationManager.create.name);
      Presentation.initialize({});
      expect(constructorSpy).to.be.called.with({
        activeLocale: "test-locale",
      });
      i18nMock.verifyAll();
    });

    it("initializes PresentationManager with undefined locale if i18n.languageList() returns empty array", () => {
      const i18nMock = moq.Mock.ofType<I18N>();
      i18nMock.setup((x) => x.languageList()).returns(() => []).verifiable();
      Presentation.i18n = i18nMock.object;
      const constructorSpy = spy.on(PresentationManager, PresentationManager.create.name);
      Presentation.initialize({});
      expect(constructorSpy).to.be.called.with({
        activeLocale: undefined,
      });
      i18nMock.verifyAll();
    });

  });

  describe("terminate", () => {

    it("resets manager instances", () => {
      Presentation.initialize();
      expect(Presentation.presentation).to.be.not.null;
      expect(Presentation.selection).to.be.not.null;
      expect(Presentation.i18n).to.be.not.null;
      Presentation.terminate();
      expect(() => Presentation.presentation).to.throw;
      expect(() => Presentation.selection).to.throw;
      expect(() => Presentation.i18n).to.throw;
    });

  });

  describe("[set] presentation", () => {

    it("overwrites presentation manager instance before initialization", () => {
      const manager = PresentationManager.create();
      Presentation.presentation = manager;
      Presentation.initialize();
      expect(Presentation.presentation).to.eq(manager);
    });

    it("overwrites presentation manager instance after initialization", () => {
      const otherManager = PresentationManager.create();
      Presentation.initialize();
      expect(Presentation.presentation).to.be.not.null;
      expect(Presentation.presentation).to.not.eq(otherManager);
      Presentation.presentation = otherManager;
      expect(Presentation.presentation).to.eq(otherManager);
    });

  });

  describe("[set] selection", () => {

    it("overwrites selection manager instance before initialization", () => {
      const manager = new SelectionManager();
      Presentation.selection = manager;
      Presentation.initialize();
      expect(Presentation.selection).to.eq(manager);
    });

    it("overwrites selection manager instance after initialization", () => {
      const otherManager = new SelectionManager();
      Presentation.initialize();
      expect(Presentation.selection).to.be.not.null;
      expect(Presentation.selection).to.not.eq(otherManager);
      Presentation.selection = otherManager;
      expect(Presentation.selection).to.eq(otherManager);
    });

  });

  describe("[set] i18n", () => {

    it("overwrites i18n instance before initialization", () => {
      const i18n = new I18N([], "");
      Presentation.i18n = i18n;
      Presentation.initialize();
      expect(Presentation.i18n).to.eq(i18n);
    });

    it("overwrites i18n instance after initialization", () => {
      const i18n = new I18N([], "");
      Presentation.initialize();
      expect(Presentation.i18n).to.be.not.null;
      expect(Presentation.i18n).to.not.eq(i18n);
      Presentation.i18n = i18n;
      expect(Presentation.i18n).to.eq(i18n);
    });

  });

});
