/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { ColorDef } from "@bentley/imodeljs-common";
import {
  IModelApp, Pixel, SnapshotConnection, VaryingType,
} from "@bentley/imodeljs-frontend";
import { Color, TestViewport, testViewports } from "../TestViewport";

describe("Screen-space effects", () => {
  let imodel: SnapshotConnection;
  let disabledEffectName: string | undefined;

  before(async () => {
    await IModelApp.startup();
    registerEffects();
    imodel = await SnapshotConnection.openFile("mirukuru.ibim");
  });

  after(async () => {
    if (imodel)
      await imodel.close();

    await IModelApp.shutdown();
  });

  afterEach(() => {
    disabledEffectName = undefined;
  });

  type EffectName = "RYB" | "BGC" | "Split";

  function registerEffect(name: EffectName, alterColor: string): void {
    const fragment = `
      vec4 effectMain() {
        vec4 color = TEXTURE(u_diffuse, v_texCoord);
        ${alterColor}
        return color;
      }`;

    const builder = IModelApp.renderSystem.createScreenSpaceEffectBuilder({
      name,
      textureCoordFromPosition: true,
      source: {
        vertex: "void effectMain(vec4 pos) { v_texCoord = textureCoordFromPosition(pos); }",
        fragment,
      },
    })!;
    expect(builder).not.to.be.undefined;

    builder.shouldApply = () => disabledEffectName !== name;
    builder.addVarying("v_texCoord", VaryingType.Vec2);

    builder.finish();
  }

  const green = ColorDef.from(0, 0xff, 0);
  const blue = ColorDef.from(0, 0, 0xff);
  const yellow = ColorDef.from(0xff, 0xff, 0);
  const cyan = ColorDef.from(0, 0xff, 0xff);
  const black = ColorDef.black;
  const white = ColorDef.white;

  function registerEffects(): void {
    // If red > 0, yellow; else blue.
    registerEffect("RYB", "color.rgb = color.r > 0.0 ? vec3(1, 1, 0) : vec3(0, 0, 1);");

    // If blue > 0, green; else cyan.
    registerEffect("BGC", "color.rgb = color.b > 0.0 ? vec3(0, 1, 0) : vec3(0, 1, 1);");

    // Shift pixels such that the left-hand side of the viewport is all background pixels and the right-hand side is all element pixels.
    const builder = IModelApp.renderSystem.createScreenSpaceEffectBuilder({
      name: "Split",
      textureCoordFromPosition: true,
      source: {
        vertex: "void effectMain(vec4 pos) { v_texCoord = textureCoordFromPosition(pos); }",
        fragment: `
          vec4 effectMain() {
            return sampleSourcePixel();
          }`,
        sampleSourcePixel: `
          vec2 tc = v_texCoord.x >= 0.5 ? vec2(0.5, 0.5) : vec2(0.0, 0.0);
          return TEXTURE(u_diffuse, tc); `,
      },
    })!;

    builder.addVarying("v_texCoord", VaryingType.Vec2);
    builder.finish();
  }

  async function test(bgColor: ColorDef, func: (vp: TestViewport) => Promise<void>) {
    await testViewports("0x24", imodel, 50, 50, async (vp) => {
      // Turn off lighting so we get pure colors and edges so we get only surfaces.
      const vf = vp.viewFlags.clone();
      vf.lighting = vf.visibleEdges = false;
      vp.viewFlags = vf;

      vp.displayStyle.backgroundColor = bgColor;

      await func(vp);
    });
  }

  function expectColor(vp: TestViewport, x: number, y: number, expected: ColorDef): void {
    const color = vp.readColor(x, y);
    expect(color.equalsColorDef(expected)).to.be.true;
  }

  function expectColors(vp: TestViewport, expected: ColorDef[]): void {
    const actual = vp.readUniqueColors();
    expect(actual.length).to.equal(expected.length);
    for (const color of expected)
      expect(actual.contains(Color.fromColorDef(color))).to.be.true;
  }

  function expectElement(vp: TestViewport, x: number, y: number): void {
    const pixel = vp.readPixel(x, y);
    expect(pixel.feature).not.to.be.undefined;
    expect(pixel.feature!.elementId).to.equal("0x29");
    expect(pixel.feature!.subCategoryId).to.equal("0x18");
    expect(pixel.type).to.equal(Pixel.GeometryType.Surface);
    expect(pixel.planarity).to.equal(Pixel.Planarity.Planar);
  }

  function expectBackground(vp: TestViewport, x: number, y: number): void {
    const pixel = vp.readPixel(x, y);
    expect(pixel.feature).to.be.undefined;
    expect(pixel.type).to.equal(Pixel.GeometryType.None);
    expect(pixel.planarity).to.equal(Pixel.Planarity.None);
  }

  it("apply to Viewport images", async () => {
    await test(ColorDef.black, async (vp) => {
      vp.screenSpaceEffects = ["RYB"];
      await vp.waitForAllTilesToRender();

      // Black background becomes blue. White shape becomes yellow.
      expectColors(vp, [yellow, blue]);
      expectColor(vp, 0, 0, blue);
      expectColor(vp, 25, 25, yellow);
    });
  });

  it("apply in the order specified", async () => {
    await test(ColorDef.black, async (vp) => {
      vp.screenSpaceEffects = ["RYB", "BGC"];
      await vp.waitForAllTilesToRender();

      // Black background becomes blue then green; white shape becomes yellow then cyan.
      expectColors(vp, [cyan, green]);
      expectColor(vp, 0, 0, green);
      expectColor(vp, 25, 25, cyan);

      // Reverse the order. Black background becomes cyan then blue; white shape becomes green then blue.
      vp.screenSpaceEffects = ["BGC", "RYB"];
      await vp.waitForAllTilesToRender();
      expectColors(vp, [blue]);

      // Remove all effects.
      vp.screenSpaceEffects = [];
      await vp.waitForAllTilesToRender();
      expectColors(vp, [black, white]);
      expectColor(vp, 0, 0, black);
      expectColor(vp, 25, 25, white);
    });
  });

  it("conditionally don't apply to Viewport images", async () => {
    disabledEffectName = "RYB";
    await test(ColorDef.black, async (vp) => {
      vp.screenSpaceEffects = ["RYB"];
      await vp.waitForAllTilesToRender();
      expectColors(vp, [white, black]);

      vp.addScreenSpaceEffect("BGC");
      await vp.waitForAllTilesToRender();
      expectColors(vp, [cyan, green]);
    });
  });

  it("can shift pixels", async () => {
    await test(ColorDef.black, async (vp) => {
      vp.screenSpaceEffects = ["Split"];
      await vp.waitForAllTilesToRender();

      // Black background on left half of viewport; white element on right half.
      expectColors(vp, [black, white]);
      expectColor(vp, 0, 10, black);
      expectColor(vp, 20, 40, black);
      expectColor(vp, 30, 10, white);
      expectColor(vp, 40, 40, white);
    });
  });

  it("works with element locate", async () => {
    await test(ColorDef.black, async (vp) => {
      vp.screenSpaceEffects = ["RYB"];
      await vp.waitForAllTilesToRender();

      expectBackground(vp, 0, 0);
      expectElement(vp, 25, 25);
    });
  });

  it("works with element locate after shifting pixels", async () => {
    await test(ColorDef.black, async (vp) => {
      vp.screenSpaceEffects = ["Split"];
      await vp.waitForAllTilesToRender();

      expectBackground(vp, 0, 10);
      expectBackground(vp, 20, 40);
      expectElement(vp, 30, 10);
      expectElement(vp, 40, 40);
    });
  });
});
