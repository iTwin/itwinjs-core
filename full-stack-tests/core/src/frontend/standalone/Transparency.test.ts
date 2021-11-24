/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import {
  ColorDef, FeatureAppearance, GraphicParams, ImageBuffer, ImageBufferFormat, RenderMaterial, RenderMode, RenderTexture, TextureMapping,
} from "@itwin/core-common";
import { DecorateContext, FeatureSymbology, GraphicType, IModelApp, RenderGraphicOwner, SnapshotConnection, Viewport } from "@itwin/core-frontend";
import { Point3d } from "@itwin/core-geometry";
import { testOnScreenViewport, TestViewport } from "../TestViewport";
import { TestUtility } from "../TestUtility";

interface GraphicOptions {
  color: ColorDef;
  /** Z in NPC coords - [0,1] maps to [far,near]. */
  priority?: number;
  pickableId?: string;
  material?: RenderMaterial;
  generateEdges?: boolean;
}

class TransparencyDecorator {
  private readonly _graphics: RenderGraphicOwner[] = [];
  private readonly _symbologyOverrides = new Map<string, FeatureAppearance>();

  public dispose(): void {
    for (const graphic of this._graphics)
      graphic.disposeGraphic();

    this._graphics.length = 0;
    this._symbologyOverrides.clear();
  }

  public reset(): void {
    this.dispose();
  }

  public decorate(context: DecorateContext): void {
    for (const graphic of this._graphics)
      context.addDecoration(GraphicType.Scene, graphic.graphic);
  }

  public addFeatureOverrides(overrides: FeatureSymbology.Overrides): void {
    for (const [elementId, appearance] of this._symbologyOverrides)
      overrides.override({ elementId, appearance });
  }

  public overrideTransparency(id: string, transparency: number, viewDependent?: boolean): void {
    this._symbologyOverrides.set(id, FeatureAppearance.fromTransparency(transparency, viewDependent));
  }

  public ignoreMaterial(id: string): void {
    this._symbologyOverrides.set(id, FeatureAppearance.fromJSON({ ignoresMaterial: true }));
  }

  /** Make a rectangle that occupies the entire view. Priority is Z in NPC coords - [0,1] maps to [far, near]. */
  public add(vp: Viewport, opts: GraphicOptions): void {
    const priority = opts.priority ?? 0;
    const pts = [
      new Point3d(0, 0, priority),
      new Point3d(1, 0, priority),
      new Point3d(1, 1, priority),
      new Point3d(0, 1, priority),
    ];

    vp.npcToWorldArray(pts);
    pts.push(pts[0].clone());

    const gfParams = GraphicParams.fromSymbology(opts.color, opts.color, 1);
    gfParams.material = opts.material;

    const builder = vp.target.renderSystem.createGraphic({
      type: GraphicType.Scene,
      viewport: vp,
      pickable: opts.pickableId ? { id: opts.pickableId } : undefined,
      wantNormals: false,
      generateEdges: true === opts.generateEdges,
    });

    builder.activateGraphicParams(gfParams);
    builder.addShape(pts);

    this._graphics.push(vp.target.renderSystem.createGraphicOwner(builder.finish()));
  }
}

describe("Transparency", async () => {
  let imodel: SnapshotConnection;
  let decorator: TransparencyDecorator;

  before(async () => {
    await TestUtility.startFrontend();
    imodel = await SnapshotConnection.openFile("mirukuru.ibim");
  });

  after(async () => {
    if (imodel)
      await imodel.close();

    await TestUtility.shutdownFrontend();
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
      viewport.viewFlags = viewport.viewFlags.with("lighting", false);
      viewport.isFadeOutActive = true;

      setup(viewport);
      viewport.addFeatureOverrideProvider(decorator);

      viewport.renderFrame();
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
    expectColors(vp, [color]);
  }

  function expectColors(vp: TestViewport, expectedColors: ColorDef[]): void {
    const actualColors = vp.readUniqueColors();
    expect(actualColors.length).to.equal(expectedColors.length);
    for (let i = 0; i < actualColors.length; i++) {
      const actual = actualColors.array[i];
      const expected = expectedColors[i].colors;

      expectComponent(actual.r, expected.r);
      expectComponent(actual.g, expected.g);
      expectComponent(actual.b, expected.b);
    }
  }

  function expectTransparency(vp: TestViewport, color: ColorDef): void {
    expectTransparencies(vp, [color]);
  }

  function expectTransparencies(vp: TestViewport, colors: ColorDef[]): void {
    expectColors(vp, colors.map((x) => multiplyAlpha(x)));
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
        decorator.overrideTransparency(pickableId, 0);
        decorator.add(vp, { color: ColorDef.red.withTransparency(0xcf), pickableId });
      },
      (vp) => expectColor(vp, ColorDef.red),
    );

    await test(
      (vp) => {
        decorator.overrideTransparency(pickableId, 0.5);
        decorator.add(vp, { color: ColorDef.red, pickableId });
      },
      (vp) => expectTransparency(vp, ColorDef.red.withTransparency(0x7f))
    );

    await test(
      (vp) => {
        decorator.overrideTransparency(pickableId, 0.5);
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
    // eslint-disable-next-line deprecation/deprecation
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

  it("should apply texture weight to material color but not alpha", async () => {
    const testCases: Array<[RenderMaterial, ColorDef]> = [
      // Opaque
      [ createMaterial(1, createBlueTexture(), 0.5, ColorDef.red), ColorDef.from(0x80, 0, 0x80) ],
      [ createMaterial(1, createBlueTexture(), 0.25, ColorDef.red), ColorDef.from(0xc0, 0, 0x40) ],
      [ createMaterial(1, createBlueTexture(), 0, ColorDef.red), ColorDef.from(0xff, 0, 0) ],

      // Translucent
      [ createMaterial(0.5, createBlueTexture(), 0.5, ColorDef.red), ColorDef.from(0x40, 0, 0x40) ],
      [ createMaterial(1, createBlueTexture(0x80), 0.5, ColorDef.red), ColorDef.from(0x40, 0, 0x40) ],
      [ createMaterial(1, createBlueTexture(0x80), 0.75, ColorDef.red), ColorDef.from(0x20, 0, 0x60) ],
      [ createMaterial(0.5, createBlueTexture(0x80), 0.5, ColorDef.red), ColorDef.from(0x20, 0, 0x20) ],
      [ createMaterial(0.5, createBlueTexture(0x80), 0.25, ColorDef.red), ColorDef.from(0x30, 0, 0x10) ],
    ];

    for (const testCase of testCases) {
      await test(
        (vp) => decorator.add(vp, { color: ColorDef.green, material: testCase[0] }),
        (vp) => expectColor(vp, testCase[1])
      );
    }
  });

  it("should apply texture weight to element color but not alpha if material does not override color", async () => {
    const testCases: Array<[RenderMaterial, ColorDef]> = [
      // Opaque
      [ createMaterial(1, createBlueTexture(), 0.5), ColorDef.from(0x80, 0, 0x80) ],
      [ createMaterial(1, createBlueTexture(), 0.25), ColorDef.from(0xc0, 0, 0x40) ],
      [ createMaterial(1, createBlueTexture(), 0), ColorDef.from(0xff, 0, 0) ],

      // Translucent
      [ createMaterial(0.5, createBlueTexture(), 0.5), ColorDef.from(0x40, 0, 0x40) ],
      [ createMaterial(1, createBlueTexture(0x80), 0.5), ColorDef.from(0x40, 0, 0x40) ],
      [ createMaterial(1, createBlueTexture(0x80), 0.75), ColorDef.from(0x20, 0, 0x60) ],
      [ createMaterial(0.5, createBlueTexture(0x80), 0.5), ColorDef.from(0x20, 0, 0x20) ],
      [ createMaterial(0.5, createBlueTexture(0x80), 0.25), ColorDef.from(0x30, 0, 0x10) ],
    ];

    for (const testCase of testCases) {
      await test(
        (vp) => decorator.add(vp, { color: ColorDef.red, material: testCase[0] }),
        (vp) => expectColor(vp, testCase[1])
      );
    }
  });

  it("should multiply element alpha with texture if material does not override alpha", async () => {
    // [Element transparency, material, expected transparency]
    const testCases: Array<[number, RenderMaterial, number]> = [
      [ 0, createMaterial(undefined, createBlueTexture(0x7f)), 0x7f ],
      [ 0x7f, createMaterial(undefined, createBlueTexture()), 0x7f ],
      [ 0x7f, createMaterial(undefined, createBlueTexture(0x7f)), 0xbf ],
      [ 0xff, createMaterial(undefined, createBlueTexture()), 0xff ],
      [ 0, createMaterial(undefined, createBlueTexture(0)), 0xff ],
    ];

    for (const testCase of testCases) {
      await test(
        (vp) => decorator.add(vp, { color: ColorDef.red.withTransparency(testCase[0]), material: testCase[1] }),
        (vp) => expectTransparency(vp, ColorDef.blue.withTransparency(testCase[2]))
      );
    }
  });

  it("should use element alpha and ignore texture if symbology overrides ignore material", async () => {
    const pickableId = imodel.transientIds.next;
    await test(
      (vp) => {
        decorator.ignoreMaterial(pickableId);
        const material = createMaterial(0.5, createBlueTexture(0x7f), undefined, ColorDef.green);
        decorator.add(vp, { color: ColorDef.red, material, pickableId });
      },
      (vp) => expectColor(vp, ColorDef.red)
    );

    await test(
      (vp) => {
        decorator.ignoreMaterial(pickableId);
        const color = ColorDef.red.withTransparency(0xaf);
        const material = createMaterial(0.5, createBlueTexture(0x7f), undefined, ColorDef.green);
        decorator.add(vp, { color, material, pickableId });
      },
      (vp) => expectTransparency(vp, ColorDef.red.withTransparency(0xaf))
    );
  });

  it("should replace material alpha with symbology override", async () => {
    const pickableId = imodel.transientIds.next;

    await test(
      (vp) => {
        decorator.add(vp, { color: ColorDef.green, pickableId, material: createMaterial(1, undefined, undefined, ColorDef.red) });
        decorator.overrideTransparency(pickableId, 0.5);
      },
      (vp) => expectTransparency(vp, ColorDef.red.withTransparency(0x7f))
    );

    await test(
      (vp) => {
        decorator.add(vp, { color: ColorDef.green, pickableId, material: createMaterial(0.5, undefined, undefined, ColorDef.red) });
        decorator.overrideTransparency(pickableId, 0);
      },
      (vp) => expectColor(vp, ColorDef.red)
    );

    await test(
      (vp) => {
        decorator.add(vp, { color: ColorDef.green, pickableId, material: createMaterial(0.5, undefined, undefined, ColorDef.red) });
        decorator.overrideTransparency(pickableId, 1);
      },
      (vp) => expectColor(vp, ColorDef.black)
    );

    await test(
      (vp) => {
        decorator.add(vp, { color: ColorDef.green, pickableId, material: createMaterial(1) });
        decorator.overrideTransparency(pickableId, 0.5);
      },
      (vp) => expectTransparency(vp, ColorDef.green.withTransparency(0x7f))
    );

    await test(
      (vp) => {
        decorator.add(vp, { color: ColorDef.green, pickableId, material: createMaterial(0.5) });
        decorator.overrideTransparency(pickableId, 0);
      },
      (vp) => expectColor(vp, ColorDef.green)
    );

    await test(
      (vp) => {
        decorator.add(vp, { color: ColorDef.green, pickableId, material: createMaterial(undefined, undefined, undefined, ColorDef.red) });
        decorator.overrideTransparency(pickableId, 0.5);
      },
      (vp) => expectTransparency(vp, ColorDef.red.withTransparency(0x7f))
    );

    await test(
      (vp) => {
        decorator.add(vp, { color: ColorDef.green.withTransparency(0x7f), pickableId, material: createMaterial(undefined, undefined, undefined, ColorDef.red) });
        decorator.overrideTransparency(pickableId, 0);
      },
      (vp) => expectColor(vp, ColorDef.red)
    );
  });

  // NB: Overriding transparency to ZERO causes the texture to draw fully-opaque except where it is fully-transparent.
  // Unclear if this is what we want. Without it, there's no way to make a very-transparent textured surface more visible via symbology overrides -
  // but any value other than zero will multiply, making transparent textures always more transparent, never less.
  it("should multiply texture alpha with symbology override", async () => {
    const pickableId = imodel.transientIds.next;
    async function testCase(color: ColorDef, transparencyOverride: number, material: RenderMaterial, expectedColor: ColorDef): Promise<void> {
      await test(
        (vp) => {
          decorator.overrideTransparency(pickableId, transparencyOverride);
          decorator.add(vp, { color, pickableId, material });
        },
        (vp) => expectTransparency(vp, expectedColor)
      );
    }

    await testCase(ColorDef.red, 0.5, createMaterial(undefined, createBlueTexture()), ColorDef.blue.withTransparency(0x7f));
    await testCase(ColorDef.red, 0.5, createMaterial(undefined, createBlueTexture(0x7f)), ColorDef.blue.withTransparency(0xbf));
    await testCase(ColorDef.red, 0, createMaterial(undefined, createBlueTexture(0x7f)), ColorDef.blue);
    await testCase(ColorDef.red, 1, createMaterial(undefined, createBlueTexture()), ColorDef.black);

    await testCase(ColorDef.green, 0.5, createMaterial(1, createBlueTexture()), ColorDef.blue.withTransparency(0x7f));
    await testCase(ColorDef.green, 0.5, createMaterial(1, createBlueTexture(0x7f)), ColorDef.blue.withTransparency(0xbf));
    await testCase(ColorDef.green, 0, createMaterial(1, createBlueTexture(0x7f)), ColorDef.blue);
    await testCase(ColorDef.green, 1, createMaterial(1, createBlueTexture()), ColorDef.black);

    await testCase(ColorDef.green, 0.75, createMaterial(0.9, createBlueTexture(0x7f)), ColorDef.blue.withTransparency(0xdf));
  });

  it("symbology override applies regardless of render mode and view flags unless explicitly specified", async () => {
    const pickableId = imodel.transientIds.next;
    for (let iTransp = 0; iTransp < 2; iTransp++) {
      for (let iViewDep = 0; iViewDep < 2; iViewDep++) {
        const viewDep = iViewDep > 0;
        const transp = iTransp > 0;
        for (const renderMode of [RenderMode.SmoothShade, RenderMode.SolidFill, RenderMode.HiddenLine]) {
          await test(
            (vp) => {
              vp.viewFlags = vp.viewFlags.with("transparency", transp).withRenderMode(renderMode);
              if (vp.displayStyle.settings.is3d())
                vp.displayStyle.settings.hiddenLineSettings = vp.displayStyle.settings.hiddenLineSettings.override({ transThreshold: 1});

              decorator.add(vp, { color: ColorDef.green, pickableId, generateEdges: true });
              decorator.overrideTransparency(pickableId, 0.5, viewDep);
            },
            (vp) => {
              // NB: the edges are drawing outside the viewport, so we're only testing surface color+transparency.
              const expectTransparent = !viewDep || (transp && RenderMode.HiddenLine !== renderMode && RenderMode.SolidFill !== renderMode);
              let color = RenderMode.HiddenLine === renderMode ? ColorDef.black : ColorDef.green;
              if (expectTransparent)
                color = color.withTransparency(0x7f);

              expectTransparency(vp, color);
            }
          );
        }
      }
    }
  });
});
