/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Id64 } from "@bentley/bentleyjs-core";
import {
  BackgroundMapProps, BackgroundMapSettings, BackgroundMapType, ColorDef, GlobeMode, TerrainHeightOriginMode,
} from "@bentley/imodeljs-common";
import {
  IModelApp, IModelConnection, Pixel, SnapshotConnection,
} from "@bentley/imodeljs-frontend";
import { testOnScreenViewport, TestViewport } from "../TestViewport";

describe("Background map", () => {
  let imodel: IModelConnection;

  before(async () => {
    await IModelApp.startup({
      renderSys: {
        // Test wants to read the color of exactly one pixel, specified in CSS pixels. Ignore device pixel ratio.
        dpiAwareViewports: false,
      },
    });

    imodel = await SnapshotConnection.openFile("mirukuru.ibim");
  });

  after(async () => {
    if (imodel)
      await imodel.close();

    await IModelApp.shutdown();
  });

  it("produces a different tile tree when background map settings change", async () => {
    async function isSameTileTree(vp: TestViewport, props: BackgroundMapProps): Promise<boolean> {
      expect(vp.viewFlags.backgroundMap).to.be.true;
      await vp.waitForAllTilesToRender();
      const prevTree = vp.backgroundMap!.treeOwner.tileTree!;
      expect(prevTree).not.to.be.undefined;

      vp.changeBackgroundMapProps(props);
      await vp.waitForAllTilesToRender();
      const newTree = vp.backgroundMap!.treeOwner.tileTree!;
      expect(newTree).not.to.be.undefined;

      return newTree === prevTree;
    }

    type Test = [ BackgroundMapProps, boolean ]; // true if expect same tile tree after changing background map props
    const tests: Test[] = [
      [ {}, true ],
      [ BackgroundMapSettings.fromJSON().toJSON(), true ],
      [ { useDepthBuffer: true }, false ],
      [ { groundBias: 100 }, false ],
      [ { groundBias: 0 }, false ],
      [ { transparency: 0.5 }, false ],
      [ { providerName: "NotAValidProvider" }, true ],

      // The same tile tree can draw different types of imagery from different providers.
      [ { providerName: "MapBoxProvider" }, true ],
      [ { providerData: { mapType: BackgroundMapType.Street } }, true ],
      [ { globeMode: GlobeMode.Plane }, false ],

      // Terrain-specific settings don't affect tile tree if terrain is disabled.
      [ { terrainSettings: { exaggeration: 42 } }, true ],
      [ { terrainSettings: { heightOrigin: 21 } }, true ],
      [ { terrainSettings: { heightOriginMode: TerrainHeightOriginMode.Ground } }, true ],

      // Terrain enabled.
      /* ###TODO ApproximateTerrainHeights.json supplied by imodeljs-frontend is not found...
      [ { applyTerrain: true }, false ],
      [ { applyTerrain: true, terrainSettings: { exaggeration: 0 } }, false ],
      [ { applyTerrain: true, terrainSettings: { heightOrigin: 0 } }, false ],
      [ { applyTerrain: true, terrainSettings: { heightOriginMode: TerrainHeightOriginMode.Geodetic } }, false ],

      // Settings specific to flat map don't affect tile tree if terrain is enabled.
      [ { applyTerrain: true, groundBias: 42 }, true ],
      [ { applyTerrain: true, useDepthBuffer: false }, true ],
      */
    ];

    await testOnScreenViewport("0x24", imodel, 100, 100, async (vp) => {
      const vf = vp.viewFlags.clone();
      vf.backgroundMap = true;
      vp.viewFlags = vf;

      for (const test of tests) {
        expect(await isSameTileTree(vp, test[0])).to.equal(test[1]);
        expect(await isSameTileTree(vp, test[0])).to.be.true;
      }
    });
  });

  // The view consists of a white rectangle in the center of a top view - smooth-shaded mode. Map initially off. Map is coplanar with top of rectangle.
  it("obscures model based on settings", async () => {
    type PixelType = "model" | "bg" | "map";

    async function expectPixelTypes(vp: TestViewport, mapProps: BackgroundMapProps | undefined, expectedCenterColor: PixelType, expectedCornerColor: PixelType, expectedCenterFeature: PixelType, expectedCornerFeature: PixelType): Promise<void> {
      if (mapProps) {
        if (!vp.viewFlags.backgroundMap) {
          const vf = vp.viewFlags.clone();
          vf.backgroundMap = true;
          vp.viewFlags = vf;
        }

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

    type Test = [ BackgroundMapProps | undefined, PixelType, PixelType, PixelType, PixelType ];
    const tests: Test[] = [
      [ undefined, "model", "bg", "model", "bg" ],

      [ { groundBias: 10, nonLocatable: true }, "model", "map", "model", "bg" ],
      [ { groundBias: -10, nonLocatable: true }, "model", "map", "model", "bg" ],
      [ { useDepthBuffer: true, groundBias: 10, nonLocatable: true }, "map", "map", "model", "bg" ],
      [ { useDepthBuffer: true, groundBias: -10, nonLocatable: true }, "model", "map", "model", "bg" ],

      [ { nonLocatable: true }, "model", "map", "model", "bg" ],
      [ { }, "model", "map", "model", "map" ],

      [ { groundBias: 10 }, "model", "map", "model", "map" ],
      [ { groundBias: -10 }, "model", "map", "model", "map" ],
      [ { useDepthBuffer: true, groundBias: 10 }, "map", "map", "map", "map" ],
      [ { useDepthBuffer: true, groundBias: -10 }, "model", "map", "model", "map" ],

      // ###TODO: Can't test with applyTerrain=true because ApproximateTerrainHeights.json not found...
    ];

    await testOnScreenViewport("0x24", imodel, 100, 100, async (vp) => {
      // Turn off lighting. Map is already off.
      const vf = vp.viewFlags.clone();
      vf.lighting = false;
      vp.viewFlags = vf;

      for (const test of tests)
        await expectPixelTypes(vp, test[0], test[1], test[2], test[3], test[4]);
    });
  });
});
