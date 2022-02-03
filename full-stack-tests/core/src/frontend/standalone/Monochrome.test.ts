/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { ColorDef, FeatureAppearance, MonochromeMode, RenderMode } from "@itwin/core-common";
import type { FeatureSymbology, IModelConnection, Viewport } from "@itwin/core-frontend";
import { SnapshotConnection } from "@itwin/core-frontend";
import { TestUtility } from "../TestUtility";
import { Color, testOnScreenViewport } from "../TestViewport";

describe("Monochrome", async () => {
  let imodel: IModelConnection;

  before(async () => {
    await TestUtility.startFrontend();
    imodel = await SnapshotConnection.openFile("mirukuru.ibim");
  });

  after(async () => {
    if (imodel) await imodel.close();
    await TestUtility.shutdownFrontend();
  });

  it("should always apply to surfaces and to edges only in wireframe", async () => {
    await testOnScreenViewport("0x24", imodel, 100, 100, async (vp) => {
      let vf = vp.viewFlags.copy({
        acsTriad: false,
        visibleEdges: true,
        hiddenEdges: false,
        lighting: false,
        monochrome: true,
      });

      vp.displayStyle.settings.monochromeColor = ColorDef.red;
      vp.displayStyle.settings.monochromeMode = MonochromeMode.Flat;
      vp.displayStyle.backgroundColor = ColorDef.blue;

      const edgeColor = Color.fromColorDef(ColorDef.black); // the view's display style overrides edge color.
      const monoColor = Color.fromColorDef(ColorDef.red);
      const bgColor = Color.fromColorDef(ColorDef.blue);

      for (const renderMode of [RenderMode.Wireframe, RenderMode.HiddenLine, RenderMode.SolidFill, RenderMode.SmoothShade]) {
        vf = vf.withRenderMode(renderMode);
        vp.viewFlags = vf;

        await vp.waitForAllTilesToRender();

        const isWireframe = RenderMode.Wireframe === renderMode;
        const colors = vp.readUniqueColors();
        expect(colors.length).to.equal(isWireframe ? 2 : 3);
        expect(colors.contains(bgColor)).to.be.true;
        expect(colors.contains(monoColor)).to.be.true;
        expect(colors.contains(edgeColor)).to.equal(!isWireframe);
      }
    });
  });

  it("should scale with surface color in scaled mode", async () => {
    await testOnScreenViewport("0x24", imodel, 100, 100, async (vp) => {
      const vf = vp.viewFlags.copy({
        renderMode: RenderMode.SmoothShade,
        acsTriad: false,
        visibleEdges: false,
        lighting: false,
        monochrome: true,
      });
      vp.displayStyle.settings.monochromeColor = ColorDef.red;
      vp.displayStyle.settings.backgroundColor = ColorDef.blue;

      vp.viewFlags = vf;

      // Draw white surface on blue background. 100% intensity = 100% monochrome color.
      await vp.waitForAllTilesToRender();
      let colors = vp.readUniqueColors();
      expect(colors.length).to.equal(2);
      expect(colors.contains(Color.fromColorDef(ColorDef.red))).to.be.true;
      expect(colors.contains(Color.fromColorDef(ColorDef.blue))).to.be.true;

      class ColorOverride {
        constructor(public color: ColorDef) { }
        public addFeatureOverrides(ovrs: FeatureSymbology.Overrides, _vp: Viewport): void {
          ovrs.setDefaultOverrides(FeatureAppearance.fromRgb(this.color));
        }
      }

      // Draw surface as black. 0% intensity = 0% monochrome color.
      const provider = new ColorOverride(ColorDef.black);
      vp.addFeatureOverrideProvider(provider);
      await vp.waitForAllTilesToRender();
      colors = vp.readUniqueColors();
      expect(colors.length).to.equal(2);
      expect(colors.contains(Color.fromColorDef(ColorDef.blue))).to.be.true;
      expect(colors.contains(Color.fromColorDef(ColorDef.black))).to.be.true;

      // Draw surface as grey. 50% intensity = 50% monochrome color.
      provider.color = ColorDef.from(0x7f, 0x7f, 0x7f);
      vp.setFeatureOverrideProviderChanged();
      await vp.waitForAllTilesToRender();
      colors = vp.readUniqueColors();
      expect(colors.length).to.equal(2);
      for (const color of colors) {
        if (!color.equalsColorDef(ColorDef.blue)) {
          expect(color.r).least(0x79);
          expect(color.r).most(0x85);
          expect(color.g).to.equal(0);
          expect(color.b).to.equal(0);
        }
      }
    });
  });
});
