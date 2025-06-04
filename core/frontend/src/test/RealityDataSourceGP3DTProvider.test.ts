/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import sinon from "sinon";
import { Frustum, RealityDataProvider, RealityModelDisplaySettings } from "@itwin/core-common";
import { Range3d } from "@itwin/core-geometry";
import { IModelApp } from "../IModelApp";
import { IModelConnection } from "../IModelConnection";
import { LogoDecoration } from "../GoogleMapsDecorator";
import { IconSprites, Sprite } from "../Sprites";
import { createRealityTileTreeReference, RealityModelTileTree, RealityTile, RealityTileTree, TileAdmin } from "../tile/internal";
import { RealityDataSource, RealityDataSourceGP3DTProvider } from "../RealityDataSource";
import { getGooglePhotorealistic3DTilesURL } from "../RealityDataSourceGP3DTImpl";
import { createBlankConnection } from "./createBlankConnection";
import { DisplayStyle3dState } from "../DisplayStyleState";
import { ScreenViewport } from "../Viewport";
import { DecorateContext } from "../ViewContext";
import { Decorations } from "../render/Decorations";

class FakeRealityTile extends RealityTile {
  constructor(contentId: string, copyright?: string) {
    super(
      {contentId, range:Range3d.createNull(), maximumSize: 256},
      {} as RealityTileTree
    );
    this._copyright = copyright;
  }
}

describe("RealityDataSourceGP3DTProvider", () => {
  const sandbox = sinon.createSandbox();
  let iModel: IModelConnection;
  const getDisplaySettings = () => RealityModelDisplaySettings.defaults;

  beforeAll(async () => {
    await IModelApp.startup();
    iModel = createBlankConnection();
  });

  beforeEach(() => {
    sinon.stub(IModelApp, "publicPath").get(() => "public/");
    sandbox.stub(LogoDecoration.prototype, "activate").callsFake(async function _(_sprite: Sprite) {
      return Promise.resolve(true);
    });
    sinon.stub(LogoDecoration.prototype, "isLoaded").get(() => true);
  });

  afterAll(async () => {
    await iModel.close();
    await IModelApp.shutdown();
  });

  afterEach(async () => {
    sandbox.restore();
    sinon.restore();
  });

  describe("Google Photorealistic 3D Tiles RealityTileTreeReference", () => {
    let getSpriteStub: sinon.SinonStub;
    let addCanvasDecorationStub: sinon.SinonStub;
    let addHTMLDecorationStub: sinon.SinonStub;
    let context: DecorateContext;

    beforeEach(() => {
      sandbox.stub(TileAdmin.prototype as any, "getTilesForUser").callsFake(function _(_vp: unknown) {
        const set = {
          selected: new Set<RealityTile>()
        };
        set.selected.add(new FakeRealityTile("testId1", "Bentley Systems, Inc."));
        set.selected.add(new FakeRealityTile("testId2", "Google"));
        set.selected.add(new FakeRealityTile("testId3", "Google"));
        return set;
      });

      getSpriteStub = sandbox.stub(IconSprites, "getSpriteFromUrl").callsFake(function _(_url: string) {
        return {} as Sprite;
      });
      addCanvasDecorationStub = sinon.stub(DecorateContext.prototype, "addCanvasDecoration");
      addHTMLDecorationStub = sinon.stub(DecorateContext.prototype, "addHtmlDecoration");
      context = DecorateContext.create({
        viewport: { getFrustum: () => new Frustum(), decorationDiv: document.createElement("div") } as ScreenViewport,
        output: new Decorations()
      });
    });

    afterEach(async () => {
      sandbox.restore();
      sinon.restore();
      getSpriteStub.restore();
      addCanvasDecorationStub.restore();
      addHTMLDecorationStub.restore();
    });

    it("should add attributions to dialog box", async () => {
      const provider = new RealityDataSourceGP3DTProvider({ apiKey: "testApiKey" });
      expect(await provider.initialize()).to.be.true;

      IModelApp.realityDataSourceProviders.register("GP3DT", provider);
      const rdSourceKey = {
        provider: "GP3DT",
        format: "ThreeDTile",
        id: getGooglePhotorealistic3DTilesURL()
      }

      const props = {
        iModel,
        source: new DisplayStyle3dState({} as any, iModel),
        rdSourceKey,
        getDisplaySettings,
      };
      const treeRef = createRealityTileTreeReference(props);

      const table = document.createElement("table");
      await treeRef.addAttributions(table, {} as ScreenViewport);

      expect(table.innerHTML).to.includes(`<img src="public/images/google_on_white_hdpi.png" width="64">`);
      expect(table.innerHTML).to.includes(`<h2 class="logo-card-header">Google Photorealistic 3D Tiles</h2>`);
      expect(table.innerHTML).to.includes(`Data provided by:<br><ul><li>Google</li><li>Bentley Systems, Inc.</li></ul>`);
    });

    it("should decorate Google logo and attributions on screen", async () => {
      const provider = new RealityDataSourceGP3DTProvider({ apiKey: "testApiKey" });
      expect(await provider.initialize()).to.be.true;

      IModelApp.realityDataSourceProviders.register("GP3DT", provider);
      const rdSourceKey = {
        provider: "GP3DT",
        format: "ThreeDTile",
        id: getGooglePhotorealistic3DTilesURL()
      }

      const props = {
        iModel,
        source: new DisplayStyle3dState({} as any, iModel),
        rdSourceKey,
        getDisplaySettings,
      };
      const treeRef = createRealityTileTreeReference(props);
      treeRef.decorate(context);

      expect(addCanvasDecorationStub.called).to.be.true;
      expect(addHTMLDecorationStub.called).to.be.true;
      const htmlDecorationStr = `<div style="color: white; font-size: 10px; text-wrap: wrap; position: absolute; bottom: 10px; left: 107px;"> • Google • Bentley Systems, Inc.</div>`;
      expect(addHTMLDecorationStub.firstCall.args[0].outerHTML).to.eq(htmlDecorationStr);
      expect(getSpriteStub.firstCall.args[0]).to.eq("public/images/google_on_non_white.png");
    });

    it("should not decorate attributions on screen when showCreditsOnscreen is false", async () => {
      const provider = new RealityDataSourceGP3DTProvider({ apiKey: "testApiKey", showCreditsOnScreen: false });
      expect(await provider.initialize()).to.be.true;

      IModelApp.realityDataSourceProviders.register("GP3DT", provider);
      const rdSourceKey = {
        provider: "GP3DT",
        format: "ThreeDTile",
        id: getGooglePhotorealistic3DTilesURL()
      }

      const props = {
        iModel,
        source: new DisplayStyle3dState({} as any, iModel),
        rdSourceKey,
        getDisplaySettings,
      };
      const treeRef = createRealityTileTreeReference(props);
      treeRef.decorate(context);

      expect(addHTMLDecorationStub.called).to.be.false;
    });
  });

  describe("Non-GP3DT RealityTileTreeReference", () => {
    let treeRef: RealityModelTileTree.Reference;

    beforeEach(() => {
      const rdSourceKey = RealityDataSource.createKeyFromUrl("test.com/tileset.json", RealityDataProvider.TilesetUrl);
      const props = {
        iModel,
        source: new DisplayStyle3dState({} as any, iModel),
        rdSourceKey,
        getDisplaySettings,
      };
      treeRef = createRealityTileTreeReference(props);
    });

    afterEach(async () => {
      sandbox.restore();
      sinon.restore();
    });

    it("should add attributions to dialog box", async () => {
      sandbox.stub(TileAdmin.prototype as any, "getTilesForUser").callsFake(function _(_vp: unknown) {
        const set = {
          selected: new Set<RealityTile>()
        };
        set.selected.add(new FakeRealityTile("testId1", "Bentley Systems, Inc."));
        set.selected.add(new FakeRealityTile("testId2", "Fake copyright"));
        set.selected.add(new FakeRealityTile("testId3", "Bentley Systems, Inc."));
        return set;
      });

      const table = document.createElement("table");
      await treeRef.addAttributions(table, {} as ScreenViewport);

      expect(table.innerHTML).to.not.includes(`<img src="public/images/google_on_white_hdpi.png" width="64">`);
      expect(table.innerHTML).to.not.includes(`<h2 class="logo-card-header">Google Photorealistic 3D Tiles</h2>`);
      expect(table.innerHTML).to.includes(`Data provided by:<br><ul><li>Bentley Systems, Inc.</li><li>Fake copyright</li></ul>`);
    });

    it("should not add attributions to dialog box if none exist", async () => {
      sandbox.restore();
      sandbox.stub(TileAdmin.prototype as any, "getTilesForUser").callsFake(function _(_vp: unknown) {
        const set = {
          selected: new Set<RealityTile>()
        };
        set.selected.add(new FakeRealityTile("testId1"));
        return set;
      });

      const table = document.createElement("table");
      await treeRef.addAttributions(table, {} as ScreenViewport);

      expect(table.innerHTML).to.eq("");
    });

    it("should not decorate Google logo", async () => {
      const getSpriteStub = sandbox.stub(IconSprites, "getSpriteFromUrl").callsFake(function _(_url: string) {
        return {} as Sprite;
      });
      const addCanvasDecorationStub = sinon.stub(DecorateContext.prototype, "addCanvasDecoration");
      const context = DecorateContext.create({
        viewport: { getFrustum: () => new Frustum(), decorationDiv: document.createElement("div") } as ScreenViewport,
        output: new Decorations()
      });
      treeRef.decorate(context);

      expect(addCanvasDecorationStub.called).to.not.be.true;
      expect(getSpriteStub.called).to.not.be.true;
    });
  });
});