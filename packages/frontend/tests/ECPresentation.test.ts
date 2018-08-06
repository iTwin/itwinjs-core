/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import "@helpers/MockFrontendEnvironment";
import { expect, spy } from "chai";
import * as moq from "@helpers/Mocks";
import { initializeRpcInterface } from "@helpers/RpcHelper";
import { I18N } from "@bentley/imodeljs-i18n";
import { IModelApp, NoRenderApp } from "@bentley/imodeljs-frontend";
import { ECPresentationRpcInterface, ECPresentationError } from "@bentley/ecpresentation-common";
import { ECPresentation } from "@src/index";
import { SelectionManager } from "@src/selection";
import ECPresentationManager from "@src/ECPresentationManager";

describe("ECPresentation", () => {

  const shutdownIModelApp = () => {
    if (NoRenderApp.initialized)
      NoRenderApp.shutdown();
  };

  beforeEach(() => {
    shutdownIModelApp();
    NoRenderApp.startup();
    initializeRpcInterface(ECPresentationRpcInterface);
    const interfaceMock = moq.Mock.ofType<ECPresentationRpcInterface>();
    ECPresentationRpcInterface.getClient = () => interfaceMock.object;
    ECPresentation.terminate();
  });

  describe("initialize", () => {

    it("throws when initialized before IModelApp.startup()", () => {
      shutdownIModelApp();
      expect(() => ECPresentation.initialize()).to.throw(ECPresentationError, "IModelApp.startup");
    });

    it("creates manager instances", () => {
      expect(() => ECPresentation.presentation).to.throw();
      expect(() => ECPresentation.selection).to.throw();
      expect(() => ECPresentation.i18n).to.throw();
      ECPresentation.initialize();
      expect(ECPresentation.presentation).to.be.instanceof(ECPresentationManager);
      expect(ECPresentation.selection).to.be.instanceof(SelectionManager);
    });

    it("initializes ECPresentationManager with props", () => {
      const constructorSpy = spy.on(ECPresentationManager, ECPresentationManager.create.name);
      const props = {
        activeLocale: "test-locale",
      };
      ECPresentation.initialize(props);
      expect(constructorSpy).to.be.called.with(props);
    });

    it("initializes ECPresentationManager.i18n with IModelApp.i18", () => {
      const i18nMock = moq.Mock.ofType<I18N>();
      IModelApp.i18n = i18nMock.object;
      ECPresentation.initialize({ activeLocale: "test" });
      expect(ECPresentation.i18n).to.equal(i18nMock.object);
    });

    it("initializes ECPresentationManager with ECPresentation.i18 locale if no props provided", () => {
      const i18nMock = moq.Mock.ofType<I18N>();
      i18nMock.setup((x) => x.languageList()).returns(() => ["test-locale"]).verifiable();
      ECPresentation.i18n = i18nMock.object;
      const constructorSpy = spy.on(ECPresentationManager, ECPresentationManager.create.name);
      ECPresentation.initialize();
      expect(constructorSpy).to.be.called.with({
        activeLocale: "test-locale",
      });
      i18nMock.verifyAll();
    });

    it("initializes ECPresentationManager with i18 locale if no activeLocale set in props", () => {
      const i18nMock = moq.Mock.ofType<I18N>();
      i18nMock.setup((x) => x.languageList()).returns(() => ["test-locale"]).verifiable();
      ECPresentation.i18n = i18nMock.object;
      const constructorSpy = spy.on(ECPresentationManager, ECPresentationManager.create.name);
      ECPresentation.initialize({});
      expect(constructorSpy).to.be.called.with({
        activeLocale: "test-locale",
      });
      i18nMock.verifyAll();
    });

    it("initializes ECPresentationManager with undefined locale if i18n.languageList() returns empty array", () => {
      const i18nMock = moq.Mock.ofType<I18N>();
      i18nMock.setup((x) => x.languageList()).returns(() => []).verifiable();
      ECPresentation.i18n = i18nMock.object;
      const constructorSpy = spy.on(ECPresentationManager, ECPresentationManager.create.name);
      ECPresentation.initialize({});
      expect(constructorSpy).to.be.called.with({
        activeLocale: undefined,
      });
      i18nMock.verifyAll();
    });

  });

  describe("terminate", () => {

    it("resets manager instances", () => {
      ECPresentation.initialize();
      expect(ECPresentation.presentation).to.be.not.null;
      expect(ECPresentation.selection).to.be.not.null;
      expect(ECPresentation.i18n).to.be.not.null;
      ECPresentation.terminate();
      expect(() => ECPresentation.presentation).to.throw;
      expect(() => ECPresentation.selection).to.throw;
      expect(() => ECPresentation.i18n).to.throw;
    });

  });

  describe("[set] presentation", () => {

    it("overwrites presentation manager instance before initialization", () => {
      const manager = ECPresentationManager.create();
      ECPresentation.presentation = manager;
      ECPresentation.initialize();
      expect(ECPresentation.presentation).to.eq(manager);
    });

    it("overwrites presentation manager instance after initialization", () => {
      const otherManager = ECPresentationManager.create();
      ECPresentation.initialize();
      expect(ECPresentation.presentation).to.be.not.null;
      expect(ECPresentation.presentation).to.not.eq(otherManager);
      ECPresentation.presentation = otherManager;
      expect(ECPresentation.presentation).to.eq(otherManager);
    });

  });

  describe("[set] selection", () => {

    it("overwrites selection manager instance before initialization", () => {
      const manager = new SelectionManager();
      ECPresentation.selection = manager;
      ECPresentation.initialize();
      expect(ECPresentation.selection).to.eq(manager);
    });

    it("overwrites selection manager instance after initialization", () => {
      const otherManager = new SelectionManager();
      ECPresentation.initialize();
      expect(ECPresentation.selection).to.be.not.null;
      expect(ECPresentation.selection).to.not.eq(otherManager);
      ECPresentation.selection = otherManager;
      expect(ECPresentation.selection).to.eq(otherManager);
    });

  });

  describe("[set] i18n", () => {

    it("overwrites i18n instance before initialization", () => {
      const i18n = new I18N([], "");
      ECPresentation.i18n = i18n;
      ECPresentation.initialize();
      expect(ECPresentation.i18n).to.eq(i18n);
    });

    it("overwrites i18n instance after initialization", () => {
      const i18n = new I18N([], "");
      ECPresentation.initialize();
      expect(ECPresentation.i18n).to.be.not.null;
      expect(ECPresentation.i18n).to.not.eq(i18n);
      ECPresentation.i18n = i18n;
      expect(ECPresentation.i18n).to.eq(i18n);
    });

  });

});
