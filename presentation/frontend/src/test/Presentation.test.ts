/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as sinon from "sinon";
import * as moq from "typemoq";
import { IModelApp, NoRenderApp } from "@itwin/core-frontend";
import { PresentationError } from "@itwin/presentation-common";
import { Presentation } from "../presentation-frontend.js";
import * as favorites from "../presentation-frontend/favorite-properties/FavoritePropertiesManager.js";
import { NoopFavoritePropertiesStorage } from "../presentation-frontend/favorite-properties/FavoritePropertiesStorage.js";
import { PresentationManager } from "../presentation-frontend/PresentationManager.js";
import * as selection from "../presentation-frontend/selection/SelectionManager.js";
import { SelectionScopesManager } from "../presentation-frontend/selection/SelectionScopesManager.js";
import { createStorage } from "@itwin/unified-selection";

describe("Presentation", () => {
  const shutdownIModelApp = async () => {
    await IModelApp.shutdown();
  };

  const mockI18N = (languages: string[] = ["en"]) => {
    const mock = moq.Mock.ofInstance(IModelApp.localization);
    mock.setup((x) => x.getLanguageList()).returns(() => languages);
    return mock;
  };

  beforeEach(async () => {
    await shutdownIModelApp();
    await NoRenderApp.startup();
    Presentation.terminate();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("initialize", () => {
    it("throws when initialized before IModelApp.startup()", async () => {
      await shutdownIModelApp();
      await expect(Presentation.initialize()).to.eventually.be.rejectedWith(PresentationError, "IModelApp.startup");
    });

    it("creates manager instances", async () => {
      expect(() => Presentation.presentation).to.throw();
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      expect(() => Presentation.selection).to.throw();
      expect(() => Presentation.favoriteProperties).to.throw();
      expect(() => Presentation.localization).to.throw();
      await Presentation.initialize();
      expect(Presentation.presentation).to.be.instanceof(PresentationManager);
      // eslint-disable-next-line @typescript-eslint/no-deprecated
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

    it("initializes PresentationManager with Presentation.i18 locale if no props provided", async () => {
      const i18nMock = mockI18N(["test-locale"]);
      sinon.replaceGetter(Presentation, "localization", () => i18nMock.object);
      const constructorSpy = sinon.spy(PresentationManager, "create");
      await Presentation.initialize();
      expect(constructorSpy).to.be.calledWith({
        activeLocale: "test-locale",
      });
    });

    it("initializes PresentationManager with i18 locale if no activeLocale set in props", async () => {
      const i18nMock = mockI18N(["test-locale"]);
      sinon.replaceGetter(Presentation, "localization", () => i18nMock.object);
      const constructorSpy = sinon.spy(PresentationManager, "create");
      await Presentation.initialize({});
      expect(constructorSpy).to.be.calledWith({
        activeLocale: "test-locale",
      });
    });

    it("initializes PresentationManager with undefined locale if i18n.getLanguageList() returns empty array", async () => {
      const i18nMock = mockI18N([]);
      sinon.replaceGetter(Presentation, "localization", () => i18nMock.object);
      const constructorSpy = sinon.spy(PresentationManager, "create");
      await Presentation.initialize({});
      expect(constructorSpy).to.be.calledWith({
        activeLocale: undefined,
      });
    });

    it("initializes FavoritePropertiesManager with given props", async () => {
      const storage = new NoopFavoritePropertiesStorage();
      await Presentation.initialize({ favorites: { storage } });
      expect(Presentation.favoriteProperties.storage).to.eq(storage);
    });

    it("calls registered initialization handlers", async () => {
      const spy = sinon.spy();
      Presentation.registerInitializationHandler(spy);
      await Presentation.initialize();
      expect(spy).to.be.calledOnce;
    });

    /* eslint-disable @typescript-eslint/no-deprecated */
    it("initializes SelectionManager with given props", async () => {
      const scopes = moq.Mock.ofType<SelectionScopesManager>().object;
      const selectionStorage = createStorage();
      await Presentation.initialize({ selection: { scopes, selectionStorage } });
      expect(Presentation.selection.scopes).to.eq(scopes);
      expect(Presentation.selection.selectionStorage).to.eq(selectionStorage);
    });

    it("initializes SelectionScopesManager's locale callback to return PresentationManager's activeLocale", async () => {
      await Presentation.initialize({ presentation: { activeLocale: "test" } });
      expect(Presentation.presentation.activeLocale).to.eq("test");
      expect(Presentation.selection.scopes.activeLocale).to.eq("test");
      Presentation.presentation.activeLocale = "other";
      expect(Presentation.presentation.activeLocale).to.eq("other");
      expect(Presentation.selection.scopes.activeLocale).to.eq("other");
    });
    /* eslint-enable @typescript-eslint/no-deprecated */
  });

  describe("terminate", () => {
    it("resets manager instances", async () => {
      await Presentation.initialize();
      expect(Presentation.presentation).to.be.not.null;
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      expect(Presentation.selection).to.be.not.null;
      expect(Presentation.favoriteProperties).to.be.not.null;
      expect(Presentation.localization).to.be.not.null;
      Presentation.terminate();
      expect(() => Presentation.presentation).to.throw;
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      expect(() => Presentation.selection).to.throw;
      expect(() => Presentation.favoriteProperties).to.throw;
      expect(() => Presentation.localization).to.throw;
    });

    it("calls registered initialization handler terminate callback", async () => {
      const spy = sinon.spy();
      Presentation.registerInitializationHandler(async () => spy);
      await Presentation.initialize();
      Presentation.terminate();
      expect(spy).to.be.calledOnce;
    });
  });
});
