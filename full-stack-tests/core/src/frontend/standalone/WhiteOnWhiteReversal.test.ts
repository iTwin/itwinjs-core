/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import type { ViewFlags} from "@itwin/core-common";
import { ColorDef, FeatureAppearance, RenderMode, WhiteOnWhiteReversalSettings } from "@itwin/core-common";
import type { DecorateContext, FeatureSymbology, IModelConnection, Viewport } from "@itwin/core-frontend";
import { GraphicType, IModelApp, SnapshotConnection } from "@itwin/core-frontend";
import { Point3d } from "@itwin/core-geometry";
import { TestUtility } from "../TestUtility";
import { Color, testOnScreenViewport } from "../TestViewport";

describe("White-on-white reversal", async () => {
  let imodel: IModelConnection;

  before(async () => {
    await TestUtility.startFrontend();
    imodel = await SnapshotConnection.openFile("mirukuru.ibim");
  });

  after(async () => {
    if (imodel) await imodel.close();
    await TestUtility.shutdownFrontend();
  });

  async function test(expectedColors: Color[], setup: (vp: Viewport, vf: ViewFlags) => ViewFlags | undefined, cleanup?: (vp: Viewport) => void): Promise<void> {
    await testOnScreenViewport("0x24", imodel, 100, 100, async (vp) => {
      const vf = vp.viewFlags.copy({ renderMode: RenderMode.Wireframe, acsTriad: false });
      const newVf = setup(vp, vf);
      vp.viewFlags = newVf ?? vf;

      await vp.waitForAllTilesToRender();
      if (undefined !== cleanup)
        cleanup(vp);

      const colors = vp.readUniqueColors();
      expect(colors.length).to.equal(expectedColors.length);
      for (const color of expectedColors)
        expect(colors.contains(color)).to.be.true;
    });
  }

  const white = Color.fromRgba(255, 255, 255, 255);
  const black = Color.fromRgba(0, 0, 0, 255);
  const red = Color.fromRgba(255, 0, 0, 255);
  const blue = Color.fromRgba(0, 0, 255, 255);

  it("should not apply if background is not white", async () => {
    await test([red, white], (vp, _vf) => {
      vp.displayStyle.backgroundColor = ColorDef.red;
      return undefined;
    });
  });

  function ignoreBackground(vp: Viewport): void {
    vp.displayStyle.settings.whiteOnWhiteReversal = WhiteOnWhiteReversalSettings.fromJSON({ ignoreBackgroundColor: true });
  }

  it("should apply to non-white background if background color is ignored", async () => {
    await test([red, black], (vp) => {
      vp.displayStyle.backgroundColor = ColorDef.red;
      ignoreBackground(vp);
      return undefined;
    });
  });

  it("should apply if background is white and geometry is white", async () => {
    await test([black, white], (vp, _vf) => {
      vp.displayStyle.backgroundColor = ColorDef.white;
      return undefined;
    });
  });

  it("should not apply if explicitly disabled", async () => {
    await test([white], (vp, vf) => {
      vp.displayStyle.backgroundColor = ColorDef.white;
      return vf.with("whiteOnWhiteReversal", false);
    });

    await test([white, red], (vp, vf) => {
      ignoreBackground(vp);
      vp.displayStyle.backgroundColor = ColorDef.red;
      return vf.with("whiteOnWhiteReversal", false);
    });
  });

  it("should not apply if geometry is not white", async () => {
    class ColorOverride {
      public addFeatureOverrides(ovrs: FeatureSymbology.Overrides, _viewport: Viewport): void {
        ovrs.setDefaultOverrides(FeatureAppearance.fromRgb(ColorDef.blue));
      }
    }

    await test([white, blue], (vp, _vf) => {
      vp.displayStyle.backgroundColor = ColorDef.white;
      vp.addFeatureOverrideProvider(new ColorOverride());
      return undefined;
    });

    await test([white, blue], (vp, _vf) => {
      vp.displayStyle.backgroundColor = ColorDef.white;
      vp.addFeatureOverrideProvider(new ColorOverride());
      ignoreBackground(vp);
      return undefined;
    });
  });

  it("should not apply to decorations", async () => {
    class TestDecorator {
      public decorate(context: DecorateContext) {
        const vp = context.viewport;
        const rect = vp.viewRect;

        const viewOverlay = context.createGraphicBuilder(GraphicType.ViewOverlay);
        viewOverlay.setSymbology(ColorDef.white, ColorDef.white, 4);
        viewOverlay.addLineString([
          new Point3d(0, rect.height / 2, 0),
          new Point3d(rect.width / 2, rect.height / 2, 0),
        ]);
        viewOverlay.setSymbology(ColorDef.blue, ColorDef.blue, 4);
        viewOverlay.addLineString([
          new Point3d(rect.width / 2, rect.height / 2, 0),
          new Point3d(rect.width, rect.height / 2, 0),
        ]);
        context.addDecorationFromBuilder(viewOverlay);

        const viewBG = context.createGraphicBuilder(GraphicType.ViewBackground);
        viewBG.setSymbology(ColorDef.white, ColorDef.white, 4);
        viewBG.addLineString([
          new Point3d(rect.width / 2, 0, 0),
          new Point3d(rect.width / 2, rect.height / 2, 0),
        ]);
        viewBG.setSymbology(ColorDef.red, ColorDef.red, 4);
        viewBG.addLineString([
          new Point3d(rect.width / 2, rect.height / 2, 0),
          new Point3d(rect.width / 2, rect.height, 0),
        ]);
        context.addDecorationFromBuilder(viewBG);

        const worldOverlay = context.createGraphicBuilder(GraphicType.WorldOverlay);
        worldOverlay.setSymbology(ColorDef.white, ColorDef.white, 4);
        worldOverlay.addLineString([
          vp.npcToWorld({ x: 0, y: 0, z: 0.5 }),
          vp.npcToWorld({ x: 0.5, y: 0.5, z: 0.5 }),
        ]);

        const greenDef = ColorDef.create(0x00ff00);
        worldOverlay.setSymbology(greenDef, greenDef, 4);
        worldOverlay.addLineString([
          vp.npcToWorld({ x: 0.5, y: 0.5, z: 0.5 }),
          vp.npcToWorld({ x: 1, y: 1, z: 0.5 }),
        ]);
        context.addDecorationFromBuilder(worldOverlay);

        const yellowDef = ColorDef.create(0x00ffff);
        const world = context.createGraphicBuilder(GraphicType.WorldDecoration);
        world.setSymbology(ColorDef.white, ColorDef.white, 4);
        world.addLineString([
          vp.npcToWorld({ x: 0, y: 1, z: 0.5 }),
          vp.npcToWorld({ x: 0.5, y: 0.5, z: 0.5 }),
        ]);
        world.setSymbology(yellowDef, yellowDef, 4);
        world.addLineString([
          vp.npcToWorld({ x: 0.5, y: 0.5, z: 0.5 }),
          vp.npcToWorld({ x: 1, y: 0, z: 0.5 }),
        ]);
        context.addDecorationFromBuilder(world);
      }
    }

    const decorator = new TestDecorator();
    const yellow = Color.fromRgba(255, 255, 0, 255);
    const green = Color.fromRgba(0, 255, 0, 255);

    await test([white, red, blue, green, yellow], (vp, _vf) => {
      IModelApp.viewManager.addDecorator(decorator);
      vp.changeViewedModels([]);
      vp.displayStyle.backgroundColor = ColorDef.white;
      return undefined;
    }, (_vp) => {
      IModelApp.viewManager.dropDecorator(decorator);
    });
  });
});
