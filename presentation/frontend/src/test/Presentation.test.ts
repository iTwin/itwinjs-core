/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelApp, NoRenderApp } from "@bentley/imodeljs-frontend";
import { I18N } from "@bentley/imodeljs-i18n";
import { PresentationError } from "@bentley/presentation-common";
import { expect } from "chai";
import * as sinon from "sinon";
import * as moq from "typemoq";
import { Presentation, SelectionManager } from "../presentation-frontend";
import * as favorites from "../presentation-frontend/favorite-properties/FavoritePropertiesManager";
import { IFavoritePropertiesStorage, NoopFavoritePropertiesStorage } from "../presentation-frontend/favorite-properties/FavoritePropertiesStorage";
import { PresentationManager } from "../presentation-frontend/PresentationManager";
import * as selection from "../presentation-frontend/selection/SelectionManager";
import { SelectionScopesManager } from "../presentation-frontend/selection/SelectionScopesManager";
import "./_helpers/MockFrontendEnvironment";

describe("Presentation", () => {

  const shutdownIModelApp = async () => {
    if (IModelApp.initialized)
      await IModelApp.shutdown();
  };

  const mockI18N = () => {
    const mock = moq.Mock.ofType<I18N>();
    mock.setup((x) => x.registerNamespace(moq.It.isAny())).returns(() => ({ name: "namespace", readFinished: Promise.resolve() }));
    return mock;
  };

  beforeEach(async () => {
    await shutdownIModelApp();
    await NoRenderApp.startup();
    Presentation.terminate();
  });

  describe("initialize", () => {

    it("throws when initialized before IModelApp.startup()", async () => {
      await shutdownIModelApp();
      expect(Presentation.initialize()).to.be.rejectedWith(PresentationError, "IModelApp.startup"); // eslint-disable-line @typescript-eslint/no-floating-promises
    });

    it("creates manager instances", async () => {
      expect(() => Presentation.presentation).to.throw();
      expect(() => Presentation.selection).to.throw();
      expect(() => Presentation.favoriteProperties).to.throw();
      expect(() => Presentation.i18n).to.throw();
      await Presentation.initialize();
      expect(Presentation.presentation).to.be.instanceof(PresentationManager);
      expect(Presentation.selection).to.be.instanceof(selection.SelectionManager);
      expect(Presentation.favoriteProperties).to.be.instanceof(favorites.FavoritePropertiesManager);
    });

    it("initializes PresentationManager with given props", async () => {
      const constructorSpy = sinon.spy(PresentationManager, "create");
      const props = {
        activeLocale: "test-locale",
      };
      await Presentation.initialize({ presentation: props });
      expect(constructorSpy).to.be.calledWith(props);
    });

    it("initializes PresentationManager.i18n with IModelApp.i18", async () => {
      const i18nMock = mockI18N();
      (IModelApp as any)._i18n = i18nMock.object;
      await Presentation.initialize({ presentation: { activeLocale: "test" } });
      expect(Presentation.i18n).to.equal(i18nMock.object);
    });

    it("initializes PresentationManager with Presentation.i18 locale if no props provided", async () => {
      const i18nMock = mockI18N();
      i18nMock.setup((x) => x.languageList()).returns(() => ["test-locale"]).verifiable();
      Presentation.setI18nManager(i18nMock.object);
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
      Presentation.setI18nManager(i18nMock.object);
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
      Presentation.setI18nManager(i18nMock.object);
      const constructorSpy = sinon.spy(PresentationManager, "create");
      await Presentation.initialize({});
      expect(constructorSpy).to.be.calledWith({
        activeLocale: undefined,
      });
      i18nMock.verifyAll();
    });

    it("initializes FavoritePropertiesManager with given props", async () => {
      const constructorSpy = sinon.spy(favorites, "FavoritePropertiesManager");
      const props: favorites.FavoritePropertiesManagerProps = {
        storage: new NoopFavoritePropertiesStorage(),
      };
      await Presentation.initialize({ favorites: props });
      expect(constructorSpy).to.be.calledOnceWithExactly(props);
    });

    it("calls registered initialization handlers", async () => {
      const spy = sinon.spy();
      Presentation.registerInitializationHandler(spy);
      await Presentation.initialize();
      expect(spy).to.be.calledOnce;
    });

    it("initializes SelectionManager with given props", async () => {
      const constructorSpy = sinon.spy(selection, "SelectionManager");
      const props: selection.SelectionManagerProps = {
        scopes: moq.Mock.ofType<SelectionScopesManager>().object,
      };
      await Presentation.initialize({ selection: props });
      expect(constructorSpy).to.be.calledOnceWithExactly(props);
    });

    it("initializes SelectionScopesManager's locale callback to return PresentationManager's activeLocale", async () => {
      await Presentation.initialize({ presentation: { activeLocale: "test" } });
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

  describe("setPresentationManager", () => {

    it("overwrites presentation manager instance before initialization", async () => {
      const manager = PresentationManager.create();
      Presentation.setPresentationManager(manager);
      await Presentation.initialize();
      expect(Presentation.presentation).to.eq(manager);
    });

    it("overwrites presentation manager instance after initialization", async () => {
      const otherManager = PresentationManager.create();
      await Presentation.initialize();
      expect(Presentation.presentation).to.be.not.null;
      expect(Presentation.presentation).to.not.eq(otherManager);
      Presentation.setPresentationManager(otherManager);
      expect(Presentation.presentation).to.eq(otherManager);
    });

  });

  describe("setSelectionManager", () => {

    it("overwrites selection manager instance before initialization", async () => {
      const manager = new SelectionManager({ scopes: moq.Mock.ofType<SelectionScopesManager>().object });
      Presentation.setSelectionManager(manager);
      await Presentation.initialize();
      expect(Presentation.selection).to.eq(manager);
    });

    it("overwrites selection manager instance after initialization", async () => {
      const otherManager = new SelectionManager({ scopes: moq.Mock.ofType<SelectionScopesManager>().object });
      await Presentation.initialize();
      expect(Presentation.selection).to.be.not.null;
      expect(Presentation.selection).to.not.eq(otherManager);
      Presentation.setSelectionManager(otherManager);
      expect(Presentation.selection).to.eq(otherManager);
    });

  });

  describe("setFavoritePropertiesManager", () => {

    it("overwrites favoriteProperties instance before initialization", async () => {
      const manager = new favorites.FavoritePropertiesManager({ storage: moq.Mock.ofType<IFavoritePropertiesStorage>().object });
      Presentation.setFavoritePropertiesManager(manager);
      await Presentation.initialize();
      expect(Presentation.favoriteProperties).to.eq(manager);
    });

    it("overwrites favoriteProperties instance after initialization", async () => {
      const otherManager = new favorites.FavoritePropertiesManager({ storage: moq.Mock.ofType<IFavoritePropertiesStorage>().object });
      await Presentation.initialize();
      expect(Presentation.favoriteProperties).to.be.not.null;
      expect(Presentation.favoriteProperties).to.not.eq(otherManager);
      Presentation.setFavoritePropertiesManager(otherManager);
      expect(Presentation.favoriteProperties).to.eq(otherManager);
    });

  });

  describe("setI18nManager", () => {

    it("overwrites i18n instance before initialization", async () => {
      const i18n = new I18N();
      Presentation.setI18nManager(i18n);
      await Presentation.initialize();
      expect(Presentation.i18n).to.eq(i18n);
    });

    it("overwrites i18n instance after initialization", async () => {
      const i18n = new I18N();
      await Presentation.initialize();
      expect(Presentation.i18n).to.be.not.null;
      expect(Presentation.i18n).to.not.eq(i18n);
      Presentation.setI18nManager(i18n);
      expect(Presentation.i18n).to.eq(i18n);
    });

  });

});
