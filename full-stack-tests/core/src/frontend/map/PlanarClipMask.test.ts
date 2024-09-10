/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import { CompressedId64Set, Id64 } from "@itwin/core-bentley";
import { BackgroundMapSettings, ColorDef, PlanarClipMaskMode, PlanarClipMaskPriority, PlanarClipMaskProps } from "@itwin/core-common";
import { IModelConnection, Pixel, SnapshotConnection, Viewport } from "@itwin/core-frontend";
import { TestUtility } from "../TestUtility";
import { testOnScreenViewport } from "../TestViewport";

// The view used by these tests consists of a white rectangle in the center of a top view - smooth-shaded mode.
// Map initially off. Map is coplanar with top of rectangle.
describe.only("Planar clip mask (#integration)", () => {
  let imodel: IModelConnection;

  before(async () => {
    assert.isDefined(process.env.TEST_BING_MAPS_KEY, "The test requires that a Bing Maps key is configured.");
    assert.isDefined(process.env.TEST_MAPBOX_KEY, "The test requires that a MapBox key is configured.");

    await TestUtility.startFrontend({
      ...TestUtility.iModelAppOptions,
      renderSys: {
        // Test wants to read the color of exactly one pixel, specified in CSS pixels. Ignore device pixel ratio.
        dpiAwareViewports: false,
      },
      mapLayerOptions: {
        BingMaps: { // eslint-disable-line
          key: "key",
          value: process.env.TEST_BING_MAPS_KEY!, // will be caught in the assert above if undefined.
        },
        MapBoxImagery: { // eslint-disable-line
          key: "access_token",
          value: process.env.TEST_MAPBOX_KEY!, // will be caught in the assert above if undefined.
        },
      },
    });

    imodel = await SnapshotConnection.openFile("mirukuru.ibim");
  });

  after(async () => {
    if (imodel)
      await imodel.close();

    await TestUtility.shutdownFrontend();
  });

  // map and dynamic have transient Ids. model has Id 0x1c. background has invalid Id.
  // dynamic is blue. model is white. background is black. map is multi-colored.
  type PixelType = "map" | "model" | "bg" | "dynamic";

  async function expectPixels(planarClipMask: PlanarClipMaskProps | undefined, expectedCenter: PixelType, setup?: (vp: Viewport) => void): Promise<void> {
    return testOnScreenViewport("0x24", imodel, 100, 100, async (vp) => {
      vp.viewFlags = vp.viewFlags.copy({ backgroundMap: true, lighting: false });
      vp.backgroundMapSettings = BackgroundMapSettings.fromJSON({
        planarClipMask,
        // Put the model under the map with depth enabled so that it is obscured by the map when not masked.
        useDepthBuffer: true,
        groundBias: 10,
      });

      if (setup) {
        setup(vp);
      }

      await vp.waitForAllTilesToRender();
      vp.invalidateRenderPlan();
      await vp.waitForAllTilesToRender();

      const cx = Math.floor(vp.viewRect.width / 2);
      const cy = Math.floor(vp.viewRect.height / 2);

      // Test what's rendered to the screen.
      const expectColor = (x: number, y: number, expectedColor: PixelType) => {
        const color = vp.readColor(x, y);
        const pixel: PixelType = color.equalsColorDef(ColorDef.white) ? "model" :
          color.equalsColorDef(ColorDef.blue) ? "dynamic" :
            color.equalsColorDef(ColorDef.black) ? "bg" : "map";
        expect(pixel).to.equal(expectedColor);
      };

      expectColor(cx, cy, expectedCenter);
      expectColor(1, 1, "map");

      // Test what's rendered to the pick buffers.
      const expectFeature = (x: number, y: number, expectedFeature: PixelType) => {
        const px = vp.readPixel(x, y, true);
        if ("bg" === expectedFeature) {
          expect(px.type).to.equal(Pixel.GeometryType.None);
          expect(px.modelId).to.be.undefined;
          return;
        }

        expect(px.type).to.equal(Pixel.GeometryType.Surface);
        expect(px.modelId).not.to.be.undefined;
        expect(Id64.isValidId64(px.modelId!)).to.be.true;
        expect(!Id64.isTransient(px.modelId!)).to.equal(expectedFeature === "model");
      };

      expectFeature(cx, cy, expectedCenter);
      expectFeature(1, 1, "map");
    });
  }

  it("is not masked by default", async () => {
    await expectPixels(undefined, "map");
  });

  it("is masked by specific model", async () => {
    const mask: PlanarClipMaskProps = { mode: PlanarClipMaskMode.Models, modelIds: CompressedId64Set.compressArray(["0x1c"]) };

    // If the model is visible, it fills the masked region of the mask.
    await expectPixels(mask, "model");

    // If the model is not visible, it makes a hole in the map revealing the background color.
    await expectPixels(mask, "bg", (vp) => vp.changeViewedModels([]));
  });

  it("is masked by DesignModel priority", async () => {
    const mask: PlanarClipMaskProps = { mode: PlanarClipMaskMode.Priority, priority: PlanarClipMaskPriority.BackgroundMap };
    
    // Models only contribute to the mask in priority mode if they are visible.
    await expectPixels(mask, "model");
    await expectPixels(mask, "map", (vp) => vp.changeViewedModels([]));
  });

  it("is not masked if priority threshold > DesignModel", async () => {
    await expectPixels({ mode: PlanarClipMaskMode.Priority, priority: PlanarClipMaskPriority.DesignModel }, "map");
  });

  it("is masked by priority by dynamic geometry", async () => {
    
  });
  
  it("is masked by design model", async () => {
    await testOnScreenViewport("0x24", imodel, 100, 100, async (vp) => {
      vp.viewFlags = vp.viewFlags.with("lighting", false).with("backgroundMap", true);
      vp.backgroundMapSettings = BackgroundMapSettings.fromJSON({
        planarClipMask: {
          mode: PlanarClipMaskMode.Priority,
          priority: PlanarClipMaskPriority.BackgroundMap,
        },
      });

      await vp.waitForAllTilesToRender();
      vp.invalidateRenderPlan();
      await vp.waitForAllTilesToRender();

      const cx = Math.floor(vp.viewRect.width / 2);
      const cy = Math.floor(vp.viewRect.height / 2);

      // Test what's rendered to the screen.
      const expectColor = (x: number, y: number, expectedColor: "bg" | "map") => {
        const actualColor = vp.readColor(x, y);
        console.log(JSON.stringify(actualColor));
        expect(actualColor.equalsColorDef(vp.view.backgroundColor)).to.equal("bg" === expectedColor);
      };
      
      expectColor(1, 1, "map");
      expectColor(cx, cy, "bg");
    });
  });
});
