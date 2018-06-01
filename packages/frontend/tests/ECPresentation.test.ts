/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import "@helpers/MockFrontendEnvironment";
import { expect } from "chai";
import * as moq from "@helpers/Mocks";
import { spy } from "@helpers/Spies";
import { I18N } from "@bentley/imodeljs-i18n";
import { IModelApp } from "@bentley/imodeljs-frontend";
import { ECPresentationRpcInterface, ECPresentationError } from "@common/index";
import { ECPresentation, ECPresentationManager } from "@src/index";
import { SelectionManager } from "@src/selection";
import { initializeRpcInterface } from "@helpers/RpcHelper";

describe("ECPresentation", () => {

  beforeEach(() => {
    IModelApp.shutdown();
    IModelApp.startup();
    initializeRpcInterface(ECPresentationRpcInterface);
    const interfaceMock = moq.Mock.ofType<ECPresentationRpcInterface>();
    ECPresentationRpcInterface.getClient = () => interfaceMock.object;
  });

  describe("initialize", () => {

    it("throws when initialized before IModelApp.startup()", () => {
      IModelApp.shutdown();
      expect(() => ECPresentation.initialize()).to.throw(ECPresentationError, "IModelApp.startup");
    });

    it("creates manager instances", () => {
      expect(() => ECPresentation.presentation).to.throw();
      expect(() => ECPresentation.selection).to.throw();
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

    it("initializes ECPresentationManager with i18 locale if no props provided", () => {
      const i18nMock = moq.Mock.ofType<I18N>();
      i18nMock.setup((x) => x.languageList()).returns(() => ["test-locale"]).verifiable();
      IModelApp.i18n = i18nMock.object;
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
      IModelApp.i18n = i18nMock.object;
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
      IModelApp.i18n = i18nMock.object;
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
      ECPresentation.terminate();
      expect(() => ECPresentation.presentation).to.throw;
      expect(() => ECPresentation.selection).to.throw;
    });

  });

  describe("[set] presentation", () => {

    it("overwrites presentation manager instance", () => {
      const otherManager = ECPresentationManager.create();
      ECPresentation.initialize();
      expect(ECPresentation.presentation).to.be.not.null;
      expect(ECPresentation.presentation).to.not.eq(otherManager);
      ECPresentation.presentation = otherManager;
      expect(ECPresentation.presentation).to.eq(otherManager);
    });

  });

  describe("[set] selection", () => {

    it("overwrites selection manager instance", () => {
      const otherManager = new SelectionManager();
      ECPresentation.initialize();
      expect(ECPresentation.selection).to.be.not.null;
      expect(ECPresentation.selection).to.not.eq(otherManager);
      ECPresentation.selection = otherManager;
      expect(ECPresentation.selection).to.eq(otherManager);
    });

  });

});
