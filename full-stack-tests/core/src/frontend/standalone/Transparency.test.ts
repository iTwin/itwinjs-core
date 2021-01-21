/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Point3d } from "@bentley/geometry-core";
import {
  ColorDef, FeatureAppearance, GraphicParams, ImageBuffer, ImageBufferFormat, RenderMaterial, RenderMode, RenderTexture, TextureMapping,
} from "@bentley/imodeljs-common";
import {
  DecorateContext, FeatureSymbology, GraphicType, IModelApp, RenderGraphicOwner, SnapshotConnection, Viewport,
} from "@bentley/imodeljs-frontend";
import { testOnScreenViewport, TestViewport } from "../TestViewport";

interface GraphicOptions {
  color: ColorDef;
  /** Z in NPC coords - [0,1] maps to [far,near]. */
  priority?: number;
  pickableId?: string;
  material?: RenderMaterial;
}

class TransparencyDecorator {
  private readonly _graphics: RenderGraphicOwner[] = [];
  public readonly transparencyOverrides = new Map<string, number>();

  public dispose(): void {
    for (const graphic of this._graphics)
      graphic.disposeGraphic();

    this._graphics.length = 0;
    this.transparencyOverrides.clear();
  }

  public reset(): void {
    this.dispose();
  }

  public decorate(context: DecorateContext): void {
    for (const graphic of this._graphics)
      context.addDecoration(GraphicType.Scene, graphic.graphic);
  }

  public addFeatureOverrides(overrides: FeatureSymbology.Overrides): void {
    for (const [id, transp] of this.transparencyOverrides)
      overrides.overrideElement(id, FeatureAppearance.fromTransparency(transp));
  }

  /** Make a rectangle that occupies the entire view. Priority is Z in NPC coords - [0,1] maps to [far, near]. */
  public add(vp: Viewport, opts: GraphicOptions): void {
    const priority = opts.priority ?? 0;
    const pts = [
      new Point3d(0, 0, priority),
      new Point3d(1, 0, priority),
      new Point3d(1, 1, priority),
      new Point3d(0, 1, priority)
    ];

    vp.npcToWorldArray(pts);
    pts.push(pts[0].clone());

    const gfParams = GraphicParams.fromSymbology(opts.color, opts.color, 1);
    gfParams.material = opts.material;

    const builder = vp.target.createGraphicBuilder(GraphicType.Scene, vp, undefined, opts.pickableId);
    builder.activateGraphicParams(gfParams);
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
    decorator.reset();
    await testOnScreenViewport("0x24", imodel, 100, 100, async (viewport) => {
      expect(viewport.viewFlags.renderMode).to.equal(RenderMode.SmoothShade);
      expect(viewport.displayStyle.backgroundColor.equals(ColorDef.black)).to.be.true;

      viewport.changeViewedModels([]);
      viewport.viewFlags.lighting = false;
      viewport.isFadeOutActive = true;

      setup(viewport);
      viewport.viewFlags = viewport.viewFlags.clone();
      viewport.addFeatureOverrideProvider(decorator);

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

  function expectComponent(actual: number, expected: number): void {
    expect(Math.abs(actual - expected)).lessThan(2);
  }

  function expectColor(vp: TestViewport, color: ColorDef): void {
    const colors = vp.readUniqueColors();
    expect(colors.length).to.equal(1);
    const actual = colors.array[0];
    const expected = color.colors;
    expectComponent(actual.r, expected.r);
    expectComponent(actual.g, expected.g);
    expectComponent(actual.b, expected.b);
  }

  function expectTransparency(vp: TestViewport, color: ColorDef): void {
    expectColor(vp, multiplyAlpha(color));
  }

  it("should blend with background color", async () => {
    const color = ColorDef.red.withTransparency(0x7f);
    await test(
      (vp) => decorator.add(vp, { color }),
      (vp) => expectTransparency(vp, color),
    );
  });

  it("should blend with opaque geometry", async () => {
    await test(
      (vp) => {
        decorator.add(vp, { color: ColorDef.red, priority: 0.1 });
        decorator.add(vp, { color: ColorDef.blue.withTransparency(0x7f), priority: 0.9 });
      },
      (vp) => expectColor(vp, ColorDef.from(0x7f, 0, 0x80, 0x7f))
    );
  });

  it("should be obscured by opaque geometry", async () => {
    await test(
      (vp) => {
        decorator.add(vp, { color: ColorDef.red, priority: 0.9 });
        decorator.add(vp, { color: ColorDef.blue.withTransparency(0x7f), priority: 0.1 });
      },
      (vp) => expectColor(vp, ColorDef.red)
    );
  });

  it("should be overridden per-feature", async () => {
    const pickableId = imodel.transientIds.next;
    await test(
      (vp) => {
        decorator.transparencyOverrides.set(pickableId, 0);
        decorator.add(vp, { color: ColorDef.red.withTransparency(0xcf), pickableId });
      },
      (vp) => expectColor(vp, ColorDef.red),
    );

    await test(
      (vp) => {
        decorator.transparencyOverrides.set(pickableId, 0.5);
        decorator.add(vp, { color: ColorDef.red, pickableId });
      },
      (vp) => expectTransparency(vp, ColorDef.red.withTransparency(0x7f))
    );

    await test(
      (vp) => {
        decorator.transparencyOverrides.set(pickableId, 0.5);
        decorator.add(vp, { color: ColorDef.red.withTransparency(0xcf), pickableId });
      },
      (vp) => expectTransparency(vp, ColorDef.red.withTransparency(0x7f))
    );
  });

  // Alpha in [0,255].
  function createBlueTexture(alpha?: number): RenderTexture {
    const fmt = undefined !== alpha ? ImageBufferFormat.Rgba : ImageBufferFormat.Rgb;
    const bytes = [ 0, 0, 255 ];
    if (undefined !== alpha)
      bytes.push(alpha);

    const img = ImageBuffer.create(new Uint8Array(bytes), fmt, 1);
    const texture = IModelApp.renderSystem.createTextureFromImageBuffer(img, imodel, new RenderTexture.Params(imodel.transientIds.next));
    expect(texture).not.to.be.undefined;
    return texture!;
  }

  // Alpha in [0,1].
  function createMaterial(alpha?: number, texture?: RenderTexture, textureWeight?: number, diffuseColor?: ColorDef): RenderMaterial {
    const params = new RenderMaterial.Params();
    params.alpha = alpha;
    params.diffuseColor = diffuseColor;
    if (texture)
      params.textureMapping = new TextureMapping(texture, new TextureMapping.Params({ textureWeight }));

    const material = IModelApp.renderSystem.createMaterial(params, imodel);
    expect(material).not.to.be.undefined;
    return material!;
  }

  it("should multiply material alpha with texture if material overrides alpha", async () => {
    const testCases: Array<[RenderMaterial, number]> = [
      [ createMaterial(1, createBlueTexture(0x7f)), 0x7f ],
      [ createMaterial(0.5, createBlueTexture()), 0x7f ],
      [ createMaterial(0.5, createBlueTexture(0x7f)), 0xbf ],
      [ createMaterial(0, createBlueTexture()), 0xff ],
      [ createMaterial(1, createBlueTexture(0)), 0xff ],
    ];

    for (const testCase of testCases) {
      await test(
        (vp) => decorator.add(vp, { color: ColorDef.red, material: testCase[0] }),
        (vp) => expectTransparency(vp, ColorDef.blue.withTransparency(testCase[1]))
      );
    }
  });

  it("should multiply element alpha with texture if material does not override alpha", () => {
  });
});
