/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import { Id64 } from "@itwin/core-bentley";
import type { BackgroundMapProps} from "@itwin/core-common";
import { BackgroundMapSettings, ColorDef } from "@itwin/core-common";
import type { IModelConnection} from "@itwin/core-frontend";
import { Pixel, SnapshotConnection } from "@itwin/core-frontend";
import { TestUtility } from "../TestUtility";
import type { TestViewport } from "../TestViewport";
import { testOnScreenViewport } from "../TestViewport";

// Set of tests require a BingMap key to be defined
describe("Background map (#integration)", () => {
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

  // The view consists of a white rectangle in the center of a top view - smooth-shaded mode. Map initially off. Map is coplanar with top of rectangle.
  it("obscures model based on settings", async () => {
    type PixelType = "model" | "bg" | "map";

    async function expectPixelTypes(vp: TestViewport, mapProps: BackgroundMapProps | undefined, expectedCenterColor: PixelType, expectedCornerColor: PixelType, expectedCenterFeature: PixelType, expectedCornerFeature: PixelType): Promise<void> {
      if (mapProps) {
        vp.viewFlags = vp.viewFlags.with("backgroundMap", true);
        vp.backgroundMapSettings = BackgroundMapSettings.fromJSON(mapProps);
      }

      await vp.waitForAllTilesToRender();
      vp.invalidateRenderPlan();
      await vp.waitForAllTilesToRender();

      const cx = Math.floor(vp.viewRect.width / 2);
      const cy = Math.floor(vp.viewRect.height / 2);

      // Test what's rendered to the screen.
      const expectColor = (x: number, y: number, expectedColor: PixelType) => {
        const actualColor = vp.readColor(x, y);
        expect(actualColor.equalsColorDef(ColorDef.white)).to.equal("model" === expectedColor);
        expect(actualColor.equalsColorDef(vp.view.backgroundColor)).to.equal("bg" === expectedColor);
      };

      expectColor(cx, cy, expectedCenterColor);
      expectColor(1, 1, expectedCornerColor);

      // Test what's rendered for readPixels().
      const expectPixel = (x: number, y: number, expectedPixel: PixelType) => {
        const actualPixel = vp.readPixel(x, y, true);
        if ("bg" === expectedPixel) {
          expect(actualPixel.type).to.equal(Pixel.GeometryType.None);
          return;
        }

        expect(actualPixel.type).to.equal(Pixel.GeometryType.Surface);
        expect(actualPixel.featureTable).not.to.be.undefined;
        expect(Id64.isTransient(actualPixel.featureTable!.modelId)).to.equal("map" === expectedPixel);
      };

      expectPixel(cx, cy, expectedCenterFeature);
      expectPixel(1, 1, expectedCornerFeature);
    }

    type Test = [BackgroundMapProps | undefined, PixelType, PixelType, PixelType, PixelType];
    const tests: Test[] = [
      [undefined, "model", "bg", "model", "bg"],

      [{ groundBias: 10, nonLocatable: true }, "model", "map", "model", "bg"],
      [{ groundBias: -10, nonLocatable: true }, "model", "map", "model", "bg"],
      [{ useDepthBuffer: true, groundBias: 10, nonLocatable: true }, "map", "map", "model", "bg"],
      [{ useDepthBuffer: true, groundBias: -10, nonLocatable: true }, "model", "map", "model", "bg"],

      [{ nonLocatable: true }, "model", "map", "model", "bg"],
      [{}, "model", "map", "model", "map"],

      [{ groundBias: 10 }, "model", "map", "model", "map"],
      [{ groundBias: -10 }, "model", "map", "model", "map"],
      [{ useDepthBuffer: true, groundBias: 10 }, "map", "map", "map", "map"],
      [{ useDepthBuffer: true, groundBias: -10 }, "model", "map", "model", "map"],

      // ###TODO: Can't test with applyTerrain=true because ApproximateTerrainHeights.json not found...
    ];

    await testOnScreenViewport("0x24", imodel, 100, 100, async (vp) => {
      // Turn off lighting. Map is already off.
      vp.viewFlags = vp.viewFlags.with("lighting", false);

      for (const test of tests)
        await expectPixelTypes(vp, test[0], test[1], test[2], test[3], test[4]);
    });
  });
});
