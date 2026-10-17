/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "vitest";
import { Id64, ProcessDetector } from "@itwin/core-bentley";
import { BackgroundMapSettings, ColorByName, ColorDef, GlobeMode, PlanProjectionSettings, PlanProjectionSettingsProps } from "@itwin/core-common";
import { DisplayStyle3dState, GeometricModel3dState, IModelConnection, Pixel } from "@itwin/core-frontend";
import { TestUtility } from "../TestUtility";
import { testOnScreenViewport } from "../TestViewport";
import { TestSnapshotConnection } from "../TestSnapshotConnection";

const describeChrome = ProcessDetector.isElectronAppFrontend ? describe.skip : describe;
describeChrome("Plan projections (#integration)", () => {
  let mirukuru: IModelConnection;

  beforeAll(async () => {
    await TestUtility.shutdownFrontend();
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

    mirukuru = await TestSnapshotConnection.openFile("planprojection.bim");
  });

  afterAll(async () => {
    await mirukuru.close();
    await TestUtility.shutdownFrontend();
  });

  it("is obscured by background map based on settings", async () => {
    // Force our model to be a plan projection
    const modelId = "0x17";
    await mirukuru.models.load(modelId);
    const model = mirukuru.models.getLoaded(modelId) as GeometricModel3dState;
    expect(model).not.toBeUndefined();
    expect(model.isPlanProjection).toBe(true);

    interface Test extends PlanProjectionSettingsProps {
      expectMap: boolean;
      mapDepth: boolean;
    }

    const tests: Test[] = [
      { enforceDisplayPriority: true, mapDepth: false, expectMap: false },
      { elevation: -10, mapDepth: false, expectMap: false },
      { elevation: 10, mapDepth: false, expectMap: false },
      { elevation: -10, mapDepth: true, expectMap: true },
      { elevation: 10, mapDepth: true, expectMap: false },
      { elevation: -10, overlay: true, mapDepth: false, expectMap: false },
      { elevation: 10, overlay: true, mapDepth: false, expectMap: false },
      { elevation: -10, overlay: true, mapDepth: true, expectMap: false },
      { elevation: 10, overlay: true, mapDepth: true, expectMap: false },
    ];

    await testOnScreenViewport("0x29", mirukuru, 100, 100, async (vp) => {
      for (const test of tests) {
        // Top view; rectangle is coincident with background map.
        vp.viewFlags = vp.viewFlags.copy({ backgroundMap: true, lighting: false });
        vp.displayStyle.backgroundColor = ColorDef.fromJSON(ColorByName.magenta);
        vp.backgroundMapSettings = BackgroundMapSettings.fromJSON({
          useDepthBuffer: test.mapDepth,
          globeMode: GlobeMode.Plane,
          nonLocatable: false,
        });

        // Set up plan projection settings.
        const style = vp.displayStyle as DisplayStyle3dState;
        style.settings.setPlanProjectionSettings(modelId, PlanProjectionSettings.fromJSON(test));
        vp.invalidateScene();

        // Render the scene.
        await vp.waitForAllTilesToRender();
        vp.invalidateRenderPlan();
        await vp.waitForAllTilesToRender();

        // Test that the screen and readPixels() always draw the map outside of the rectangle, and the map only obscures
        // the rectangle if the test expects it to based on the plan projection and map settings.
        const expectPixel = (x: number, y: number, expectMap: boolean) => {
          const color = vp.readColor(x, y);
          expect(color.equalsColorDef(vp.displayStyle.backgroundColor)).toBe(false);
          expect(color.equalsColorDef(ColorDef.white)).not.toBe(expectMap);

          const pixel = vp.readPixel(x, y, true);
          expect(pixel.type).toBe(Pixel.GeometryType.Surface);
          expect(pixel.modelId).not.toBeUndefined();
          expect(Id64.isTransient(pixel.modelId!)).toBe(expectMap);
        };

        expectPixel(50, 50, test.expectMap);
      }
    });
  });
});
