/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import sinon from "sinon";
import { Frustum, RealityDataProvider, RealityModelDisplaySettings } from "@itwin/core-common";
import { IModelApp } from "../../IModelApp";
import { IModelConnection } from "../../IModelConnection";
import { LogoDecoration } from "../../GoogleMapsDecorator";
import { IconSprites, Sprite } from "../../Sprites";
import { createRealityTileTreeReference, RealityTile, RealityTileTree, TileAdmin } from "../../tile/internal";
import { RealityDataSource } from "../../RealityDataSource";
import { getGooglePhotorealistic3DTilesURL } from "../../RealityDataProviderRegistry";
import { createBlankConnection } from "../createBlankConnection";
import { DisplayStyle3dState } from "../../DisplayStyleState";
import { ScreenViewport } from "../../Viewport";
import { DecorateContext } from "../../ViewContext";
import { Decorations } from "../../render/Decorations";
import { Range3d } from "@itwin/core-geometry";

class FakeRealityTile extends RealityTile {
  constructor(contentId: string, copyright?: string) {
    super(
      {contentId, range:Range3d.createNull(), maximumSize: 256},
      {} as RealityTileTree
    );
    this._copyright = copyright;
  }
}

export const fakeJsonFetch = (sandbox: sinon.SinonSandbox, data: any) => {
  return sandbox.stub(globalThis, "fetch").callsFake(async function (_input: RequestInfo | URL, _init?: RequestInit) {
    return Promise.resolve((({
      json: async () => data,
      ok: true,
      status: 200,
    } as unknown) as Response));
  });
};

const defaultPngSession = {tileWidth: 256, tileHeight: 256, imageFormat: "image/png", expiry: 0, session: "dummySession"};

describe("RealityTileTreeReference", () => {
  const sandbox = sinon.createSandbox();
  let iModel: IModelConnection;

  beforeAll(async () => {
    await IModelApp.startup();
    iModel = createBlankConnection();
  });

  afterAll(async () => {
    await iModel.close();
    await IModelApp.shutdown();
  });

  afterEach(async () => {
    sandbox.restore();
  });

  it("should add attributions for Google Photorealistic 3D Tiles", async () => {
    sandbox.stub(TileAdmin.prototype as any, "getTilesForUser").callsFake(function _(_vp: unknown) {
      const set = {
        selected: new Set<RealityTile>()
      };
      set.selected.add(new FakeRealityTile("testId1", "Bentley Systems, Inc."));
      set.selected.add(new FakeRealityTile("testId2", "Fake copyright"));
      set.selected.add(new FakeRealityTile("testId3", "Bentley Systems, Inc."));
      return set;
    });

    sinon.stub(IModelApp, "publicPath").get(() => "public/");
    const rdSourceKey = RealityDataSource.createKeyFromUrl(getGooglePhotorealistic3DTilesURL(), RealityDataProvider.GP3DT);
    const getDisplaySettings = () => RealityModelDisplaySettings.defaults;
    const props = {
      iModel,
      source: new DisplayStyle3dState({} as any, iModel),
      rdSourceKey,
      getDisplaySettings,
    };
    const treeRef = createRealityTileTreeReference(props);
    expect(treeRef).to.not.be.undefined;

    const table = document.createElement("table");
    await treeRef.addAttributions(table, {} as ScreenViewport);

    expect(table.innerHTML).to.includes(`<img src="public/images/google_on_white_hdpi.png" width="64">`);
    expect(table.innerHTML).to.includes(`Data provided by:<br><ul><li>Bentley Systems, Inc.</li><li>Fake copyright</li></ul>`);
  });

  it("should decorate Google logo for Google Photorealistic 3D Tiles", async () => {
    const rdSourceKey = RealityDataSource.createKeyFromUrl(getGooglePhotorealistic3DTilesURL(), RealityDataProvider.GP3DT);
    const getDisplaySettings = () => RealityModelDisplaySettings.defaults;
    const props = {
      iModel,
      source: new DisplayStyle3dState({} as any, iModel),
      rdSourceKey,
      getDisplaySettings,
    };
    const treeRef = createRealityTileTreeReference(props);
    expect(treeRef).to.not.be.undefined;

    fakeJsonFetch(sandbox, defaultPngSession);
    const getSpriteStub = sandbox.stub(IconSprites, "getSpriteFromUrl").callsFake(function _(_url: string) {
      console.log("getSpriteFromUrl called");
      return { loadPromise: new Promise<HTMLElement>(() => { return new HTMLImageElement; }) } as Sprite;
    });
    const addCanvasDecorationStub = sinon.stub(DecorateContext.prototype, "addCanvasDecoration");
    sinon.stub(LogoDecoration.prototype, "isLoaded").get(() => true);

    const context = DecorateContext.create({ viewport: {getFrustum: () => new Frustum()} as ScreenViewport, output: new Decorations() });
    await treeRef.initializeDecorator();
    treeRef.decorate(context);

    // WIP - not working unless you call initializeDecorator - issue with calling decorator.activate in RealityTileTreeRef
    expect(addCanvasDecorationStub.called).to.be.true;
    expect(getSpriteStub.firstCall.args[0]).to.eq("public/images/google_on_non_white.png");
  });

  it("should add attributions for other types of reality tile trees", async () => {

  });

  it("should not decorate Google logo for other types of reality tile trees", async () => {

  });
});