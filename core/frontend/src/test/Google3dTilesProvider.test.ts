/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import sinon from "sinon";
import { Frustum } from "@itwin/core-common";
import { Range3d } from "@itwin/core-geometry";
import { IModelApp } from "../IModelApp";
import { IModelConnection } from "../IModelConnection";
import { LogoDecoration } from "../internal/GoogleMapsDecorator";
import { IconSprites, Sprite } from "../Sprites";
import { RealityTile, RealityTileTree, TileAdmin } from "../tile/internal";
import { Google3dTilesProvider } from "../RealityDataSource";
import { createBlankConnection } from "./createBlankConnection";
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

describe("Google3dTilesProvider", () => {
  const sandbox = sinon.createSandbox();
  let iModel: IModelConnection;
  let getSpriteStub: sinon.SinonStub;
  let addCanvasDecorationStub: sinon.SinonStub;
  let addHTMLDecorationStub: sinon.SinonStub;
  let context: DecorateContext;

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

  afterAll(async () => {
    await iModel.close();
    await IModelApp.shutdown();
  });

  afterEach(async () => {
    sandbox.restore();
    sinon.restore();
    getSpriteStub.restore();
    addCanvasDecorationStub.restore();
    addHTMLDecorationStub.restore();
  });

  it("should add attributions", async () => {
    const provider = new Google3dTilesProvider({ apiKey: "testApiKey" });
    expect(await provider.initialize()).to.be.true;

    const table = document.createElement("table");
    await provider.addAttributions(table, {} as ScreenViewport);

    expect(table.innerHTML).to.includes(`<img src="public/images/GoogleMaps_Logo_Gray.svg" style="padding: 10px 10px 5px;">`);
    expect(table.innerHTML).to.includes(`<h2 class="logo-card-header">Google Photorealistic 3D Tiles</h2>`);
    expect(table.innerHTML).to.includes(`Data provided by:<br><ul><li>Google</li><li>Bentley Systems, Inc.</li></ul>`);
  });

  it("should decorate Google logo and attributions on screen", async () => {
    const provider = new Google3dTilesProvider({ apiKey: "testApiKey" });
    expect(await provider.initialize()).to.be.true;
    provider.decorate(context);

    expect(addCanvasDecorationStub.called).to.be.true;
    expect(addHTMLDecorationStub.called).to.be.true;
    const htmlDecorationStr = `<div style="color: white; font-size: 11px; text-wrap: wrap; position: absolute; bottom: 14px; left: 155px;"> • Google • Bentley Systems, Inc.</div>`;
    expect(addHTMLDecorationStub.firstCall.args[0].outerHTML).to.eq(htmlDecorationStr);
    expect(getSpriteStub.firstCall.args[0]).to.eq("public/images/GoogleMaps_Logo_WithDarkOutline.svg");
  });

  it("should not decorate attributions on screen when showCreditsOnscreen is false", async () => {
    const provider = new Google3dTilesProvider({ apiKey: "testApiKey", showCreditsOnScreen: false });
    expect(await provider.initialize()).to.be.true;
    provider.decorate(context);

    expect(addHTMLDecorationStub.called).to.be.false;
  });
});