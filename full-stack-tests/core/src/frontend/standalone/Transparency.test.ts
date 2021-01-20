/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Point3d } from "@bentley/geometry-core";
import { ColorDef, RenderMode } from "@bentley/imodeljs-common";
import {
  DecorateContext, GraphicType, IModelApp, RenderGraphicOwner, SnapshotConnection, Viewport,
} from "@bentley/imodeljs-frontend";
import { testOnScreenViewport, TestViewport } from "../TestViewport";

class TransparencyDecorator {
  private readonly _graphics: RenderGraphicOwner[] = [];

  public dispose(): void {
    for (const graphic of this._graphics)
      graphic.disposeGraphic();

    this._graphics.length = 0;
  }

  public decorate(context: DecorateContext): void {
    for (const graphic of this._graphics)
      context.addDecoration(GraphicType.Scene, graphic.graphic);
  }

  /** Make a rectangle that occupies the entire view. Priority is Z in NPC coords - [0,1] maps to [far, near]. */
  public add(vp: Viewport, color: ColorDef, priority = 0): void {
    const pts = [
      new Point3d(0, 0, priority),
      new Point3d(1, 0, priority),
      new Point3d(1, 1, priority),
      new Point3d(0, 1, priority)
    ];

    vp.npcToWorldArray(pts);
    pts.push(pts[0].clone());

    const builder = vp.target.createGraphicBuilder(GraphicType.Scene, vp);
    builder.setSymbology(color, color, 1);
    builder.addShape(pts);

    this._graphics.push(vp.target.renderSystem.createGraphicOwner(builder.finish()));
  }
}

describe("Transparency", async () => {
  let imodel: SnapshotConnection;
  let decorator: TransparencyDecorator;

  before(async () => {
    await IModelApp.startup();
    imodel = await SnapshotConnection.openFile("mirukuru.ibim");
  });

  after(async () => {
    if (imodel)
      await imodel.close();

    await IModelApp.shutdown();
  });

  beforeEach(() => {
    IModelApp.viewManager.addDecorator(decorator = new TransparencyDecorator());
  });

  afterEach(() => {
    decorator.dispose();
    IModelApp.viewManager.dropDecorator(decorator);
  });

  async function test(setup: (vp: TestViewport) => void, verify: (vp: TestViewport) => void): Promise<void> {
    await testOnScreenViewport("0x24", imodel, 100, 100, async (viewport) => {
      const vf = viewport.viewFlags.clone();
      expect(vf.renderMode).to.equal(RenderMode.SmoothShade);
      expect(viewport.displayStyle.backgroundColor.equals(ColorDef.black)).to.be.true;

      viewport.changeViewedModels([]);
      vf.lighting = false;
      viewport.viewFlags = vf;
      viewport.isFadeOutActive = true;

      setup(viewport);
      await viewport.renderFrame();
      verify(viewport);
    });
  }

  function multiplyAlpha(color: ColorDef): ColorDef {
    const colors = color.colors;
    const a = (0xff - colors.t) / 0xff;
    colors.r = colors.r * a;
    colors.g = colors.g * a;
    colors.b = colors.b * a;
    return ColorDef.from(colors.r, colors.g, colors.b, colors.t);
  }

  function expectColor(vp: TestViewport, color: ColorDef): void {
    const colors = vp.readUniqueColors();
    expect(colors.length).to.equal(1);
    const actual = colors.array[0];
    const expected = color.colors;
    expect(actual.r).to.equal(expected.r);
    expect(actual.g).to.equal(expected.g);
    expect(actual.b).to.equal(expected.b);
  }

  function expectTransparency(vp: TestViewport, color: ColorDef): void {
    expectColor(vp, multiplyAlpha(color));
  }

  it("should blend with background color", async () => {
    await test(
      (vp) => decorator.add(vp, ColorDef.red.withTransparency(0x7f)),
      (vp) => expectTransparency(vp, ColorDef.red.withTransparency(0x7f)),
    );
  });

  it("should blend with opaque geometry", async () => {
    await test(
      (vp) => {
        decorator.add(vp, ColorDef.red, 0.1);
        decorator.add(vp, ColorDef.blue.withTransparency(0x7f), 0.9);
      },
      (vp) => expectColor(vp, ColorDef.from(0x7f, 0, 0x80, 0x7f))
    );
  });

  it("should blend with transparent geometry", async () => {
  });

  it("should be obscured by opaque geometry", async () => {
    await test(
      (vp) => {
        decorator.add(vp, ColorDef.red, 0.9);
        decorator.add(vp, ColorDef.blue.withTransparency(0x7f));
      },
      (vp) => expectColor(vp, ColorDef.red)
    );
  });
});
