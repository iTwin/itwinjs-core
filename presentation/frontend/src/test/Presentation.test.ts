/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* tslint:disable:no-direct-imports */

import { expect } from "chai";
import * as sinon from "sinon";
import * as moq from "@bentley/presentation-common/lib/test/_helpers/Mocks";
import "./_helpers/MockFrontendEnvironment";
import { I18N } from "@bentley/imodeljs-i18n";
import { IModelApp, NoRenderApp } from "@bentley/imodeljs-frontend";
import { PresentationError } from "@bentley/presentation-common";
import { Presentation, SelectionManager } from "../presentation-frontend";
import { SelectionScopesManager } from "../presentation-frontend/selection/SelectionScopesManager";
import { PresentationManager } from "../presentation-frontend/PresentationManager";
import { FavoritePropertiesManager } from "../presentation-frontend/favorite-properties/FavoritePropertiesManager";

describe("Presentation", () => {

  const shutdownIModelApp = () => {
    if (IModelApp.initialized)
      IModelApp.shutdown();
  };

  const mockI18N = () => {
    const mock = moq.Mock.ofType<I18N>();
    mock.setup((x) => x.registerNamespace(moq.It.isAny())).returns(() => ({ name: "namespace", readFinished: Promise.resolve() }));
    return mock;
  };

  beforeEach(() => {
    shutdownIModelApp();
    NoRenderApp.startup();
    Presentation.terminate();
  });

  describe("initialize", () => {

    it("throws when initialized before IModelApp.startup()", async () => {
      shutdownIModelApp();
      expect(Presentation.initialize()).to.be.rejectedWith(PresentationError, "IModelApp.startup");
    });

    it("creates manager instances", async () => {
      expect(() => Presentation.presentation).to.throw();
      expect(() => Presentation.selection).to.throw();
      expect(() => Presentation.favoriteProperties).to.throw();
      expect(() => Presentation.i18n).to.throw();
      await Presentation.initialize();
      expect(Presentation.presentation).to.be.instanceof(PresentationManager);
      expect(Presentation.selection).to.be.instanceof(SelectionManager);
      expect(Presentation.favoriteProperties).to.be.instanceof(FavoritePropertiesManager);
    });

    it("initializes PresentationManager with props", async () => {
      const constructorSpy = sinon.spy(PresentationManager, "create");
      const props = {
        activeLocale: "test-locale",
      };
      await Presentation.initialize(props);
      expect(constructorSpy).to.be.calledWith(props);
    });

    it("initializes PresentationManager.i18n with IModelApp.i18", async () => {
      const i18nMock = mockI18N();
      (IModelApp as any)._i18n = i18nMock.object;
      await Presentation.initialize({ activeLocale: "test" });
      expect(Presentation.i18n).to.equal(i18nMock.object);
    });

    it("initializes PresentationManager with Presentation.i18 locale if no props provided", async () => {
      const i18nMock = mockI18N();
      i18nMock.setup((x) => x.languageList()).returns(() => ["test-locale"]).verifiable();
      Presentation.i18n = i18nMock.object;
      const constructorSpy = sinon.spy(PresentationManager, "create");
      await Presentation.initialize();
      expect(constructorSpy).to.be.calledWith({
        activeLocale: "test-locale",
      });
      i18nMock.verifyAll();
    });

    it("initializes PresentationManager with i18 locale if no activeLocale set in props", async () => {
      const i18nMock = mockI18N();
      i18nMock.setup((x) => x.languageList()).returns(() => ["test-locale"]).verifiable();
      Presentation.i18n = i18nMock.object;
      const constructorSpy = sinon.spy(PresentationManager, "create");
      await Presentation.initialize({});
      expect(constructorSpy).to.be.calledWith({
        activeLocale: "test-locale",
      });
      i18nMock.verifyAll();
    });

    it("initializes PresentationManager with undefined locale if i18n.languageList() returns empty array", async () => {
      const i18nMock = mockI18N();
      i18nMock.setup((x) => x.languageList()).returns(() => []).verifiable();
      Presentation.i18n = i18nMock.object;
      const constructorSpy = sinon.spy(PresentationManager, "create");
      await Presentation.initialize({});
      expect(constructorSpy).to.be.calledWith({
        activeLocale: undefined,
      });
      i18nMock.verifyAll();
    });

    it("calls registered initialization handlers", async () => {
      const spy = sinon.spy();
      Presentation.registerInitializationHandler(spy);
      await Presentation.initialize();
      expect(spy).to.be.calledOnce;
    });

    it("initializes SelectionScopesManager's locale callback to return PresentationManager's activeLocale", async () => {
      await Presentation.initialize({ activeLocale: "test" });
      expect(Presentation.presentation.activeLocale).to.eq("test");
      expect(Presentation.selection.scopes.activeLocale).to.eq("test");
      Presentation.presentation.activeLocale = "other";
      expect(Presentation.presentation.activeLocale).to.eq("other");
      expect(Presentation.selection.scopes.activeLocale).to.eq("other");
    });

  });

  describe("terminate", () => {

    it("resets manager instances", async () => {
      await Presentation.initialize();
      expect(Presentation.presentation).to.be.not.null;
      expect(Presentation.selection).to.be.not.null;
      expect(Presentation.favoriteProperties).to.be.not.null;
      expect(Presentation.i18n).to.be.not.null;
      Presentation.terminate();
      expect(() => Presentation.presentation).to.throw;
      expect(() => Presentation.selection).to.throw;
      expect(() => Presentation.favoriteProperties).to.throw;
      expect(() => Presentation.i18n).to.throw;
    });

    it("calls registered initialization handler terminate callback", async () => {
      const spy = sinon.spy();
      Presentation.registerInitializationHandler(async () => spy);
      await Presentation.initialize();
      Presentation.terminate();
      expect(spy).to.be.calledOnce;
    });

  });

  describe("[set] presentation", () => {

    it("overwrites presentation manager instance before initialization", async () => {
      const manager = PresentationManager.create();
      Presentation.presentation = manager;
      await Presentation.initialize();
      expect(Presentation.presentation).to.eq(manager);
    });

    it("overwrites presentation manager instance after initialization", async () => {
      const otherManager = PresentationManager.create();
      await Presentation.initialize();
      expect(Presentation.presentation).to.be.not.null;
      expect(Presentation.presentation).to.not.eq(otherManager);
      Presentation.presentation = otherManager;
      expect(Presentation.presentation).to.eq(otherManager);
    });

  });

  describe("[set] selection", () => {

    it("overwrites selection manager instance before initialization", async () => {
      const manager = new SelectionManager({ scopes: moq.Mock.ofType<SelectionScopesManager>().object });
      Presentation.selection = manager;
      await Presentation.initialize();
      expect(Presentation.selection).to.eq(manager);
    });

    it("overwrites selection manager instance after initialization", async () => {
      const otherManager = new SelectionManager({ scopes: moq.Mock.ofType<SelectionScopesManager>().object });
      await Presentation.initialize();
      expect(Presentation.selection).to.be.not.null;
      expect(Presentation.selection).to.not.eq(otherManager);
      Presentation.selection = otherManager;
      expect(Presentation.selection).to.eq(otherManager);
    });

  });

  describe("[set] favoriteProperties", () => {

    it("overwrites favoriteProperties instance before initialization", async () => {
      const manager = new FavoritePropertiesManager();
      Presentation.favoriteProperties = manager;
      await Presentation.initialize();
      expect(Presentation.favoriteProperties).to.eq(manager);
    });

    it("overwrites favoriteProperties instance after initialization", async () => {
      const otherManager = new FavoritePropertiesManager();
      await Presentation.initialize();
      expect(Presentation.favoriteProperties).to.be.not.null;
      expect(Presentation.favoriteProperties).to.not.eq(otherManager);
      Presentation.favoriteProperties = otherManager;
      expect(Presentation.favoriteProperties).to.eq(otherManager);
    });

  });

  describe("[set] i18n", () => {

    it("overwrites i18n instance before initialization", async () => {
      const i18n = new I18N();
      Presentation.i18n = i18n;
      await Presentation.initialize();
      expect(Presentation.i18n).to.eq(i18n);
    });

    it("overwrites i18n instance after initialization", async () => {
      const i18n = new I18N();
      await Presentation.initialize();
      expect(Presentation.i18n).to.be.not.null;
      expect(Presentation.i18n).to.not.eq(i18n);
      Presentation.i18n = i18n;
      expect(Presentation.i18n).to.eq(i18n);
    });

  });

});
