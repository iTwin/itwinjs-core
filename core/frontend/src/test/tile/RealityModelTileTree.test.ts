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
import { Sprite } from "../../Sprites";
import { createRealityTileTreeReference } from "../../tile/internal";
import { RealityDataSource } from "../../RealityDataSource";
import { getGooglePhotorealistic3DTilesURL } from "../../RealityDataProviderRegistry";
import { createBlankConnection } from "../createBlankConnection";
import { DisplayStyle3dState } from "../../DisplayStyleState";
import { ScreenViewport } from "../../Viewport";
import { DecorateContext } from "../../ViewContext";
import { Decorations } from "../../render/Decorations";

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

  beforeEach(async () => {
    sandbox.stub(IModelApp, "mapLayerFormatRegistry").callsFake(async function _(_sprite: Sprite) {
      return Promise.resolve(true);
    });
    sandbox.stub(LogoDecoration.prototype, "activate").callsFake(async function _(_sprite: Sprite) {
      return Promise.resolve(true);
    });
  });

  afterEach(async () => {
    sandbox.restore();
  });

  it("should add attributions", async () => {

    // sandbox.stub(GoogleMapsImageryProvider.prototype as any, "getSelectedTiles").callsFake(function _(_vp: unknown) {
    //   const set = new Set<MapTile>();
    //   set.add(new FakeMapTile("17_37981_49592"));
    //   return set;
    // });

    // const getViewportInfoStub = sandbox.stub(GoogleMapsImageryProvider.prototype, "fetchViewportInfo").callsFake(async function _(_rectangle: MapCartoRectangle, _zoomLevel: number) {
    //   return {copyright: "fake copyright", maxZoomRects: []};
    // });

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
    // console.log(treeRef);

    // const table = document.createElement('table');
    // await treeRef.addAttributions(table, {} as ScreenViewport);
    // console.log(table.innerHTML);

    const addCanvasDecorationStub = sinon.stub(DecorateContext.prototype, "addCanvasDecoration");
    sinon.stub(LogoDecoration.prototype, "isLoaded").get(() => true);
    const context =  DecorateContext.create({ viewport: {getFrustum: () => new Frustum()} as ScreenViewport, output: new Decorations() });

    treeRef.decorate(context);

    expect(addCanvasDecorationStub.called).to.be.true;

    // await provider.initialize();
    // const table = document.createElement('table');
    // await provider.addAttributions(table, {} as ScreenViewport);

    // expect(getViewportInfoStub.called).to.be.true;
    // expect(table.innerHTML).to.includes(`<img src="public/images/google_on_white_hdpi.png" width="64">`);
    // expect(table.innerHTML).to.includes(`<p class="logo-cards">fake copyright</p>`);
  });
});