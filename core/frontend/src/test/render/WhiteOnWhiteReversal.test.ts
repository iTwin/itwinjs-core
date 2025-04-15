/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { IModelApp } from "../../IModelApp";
import { DecorateContext } from "../../ViewContext";
import { ColorDef, FillFlags, GraphicParams, ImageBuffer, ImageBufferFormat, RenderMaterial, RenderMode, RenderTexture, RgbColor } from "@itwin/core-common";
import { Viewport } from "../../Viewport";
import { Point3d } from "@itwin/core-geometry";
import { readUniqueColors, testBlankViewport } from "../openBlankViewport";
import { ViewRect } from "../../common";
import { RenderSystem } from "../../render/RenderSystem";

describe("White-on-white reversal", () => {
  class TestDecorator {
    private constructor(public readonly decorate: (context: DecorateContext) => void) {
      
    }

    public static register(decorate: (context: DecorateContext) => void): TestDecorator {
      const decorator = new this(decorate);
      IModelApp.viewManager.addDecorator(decorator);
      return decorator;
    }

    public static clearAll(): void {
      const decorators = IModelApp.viewManager.decorators.filter((x) => x instanceof TestDecorator);
      for (const decorator of decorators) {
        IModelApp.viewManager.dropDecorator(decorator);
      }
    }
  }

  beforeAll(async () => {
    await IModelApp.startup();
  });

  afterEach(() => {
    TestDecorator.clearAll();
  });

  afterAll(async () => {
    await IModelApp.shutdown();
  });

  function addSquareDecoration(context: DecorateContext, color: ColorDef, material?: RenderMaterial, fillFlags: FillFlags = FillFlags.None): void {
    const builder = context.createSceneGraphicBuilder();
    const params = new GraphicParams;
    params.lineColor = params.fillColor = color;
    params.material = material;
    params.fillFlags = fillFlags;
    builder.activateGraphicParams(params);

    const pts = [new Point3d(0, 0, 0), new Point3d(10, 0, 0), new Point3d(10, 10, 0), new Point3d(0, 10, 0), new Point3d(0, 0, 0)];
    context.viewport.viewToWorldArray(pts);
    builder.addShape(pts);
    context.addDecorationFromBuilder(builder);
  }

  interface Rgb { r: number, g: number, b: number }
  function sortColors(colors: Rgb[]): Rgb[] {
    return colors.sort((a, b) => a.r - b.r || a.g - b.g || a.b - b.b);
  }

  interface Options {
    rect?: ViewRect;
  }

  function expectColors(vp: Viewport, expected: ColorDef[], bgColor: ColorDef, decorate: (context: DecorateContext) => void, options?: Options): void {
    TestDecorator.register(decorate);
    vp.displayStyle.backgroundColor = bgColor;
    vp.invalidateDecorations();
    vp.renderFrame();

    const actualColors = sortColors(readUniqueColors(vp, options?.rect).array.map((x) => { return { r: x.r, g: x.g, b: x.b } }));
    const expectedColors = sortColors(expected.map((x) => RgbColor.fromColorDef(x)));
    expect(actualColors).to.deep.equal(expectedColors);

    TestDecorator.clearAll();
  }

  it("applies to white scene decorations IFF view background is white", () => {
    testBlankViewport((vp) => {
      vp.viewFlags = vp.viewFlags.copy({ renderMode: RenderMode.SmoothShade, lighting: false });
      expectColors(vp, [ColorDef.red, ColorDef.white], ColorDef.red, (ctx) => addSquareDecoration(ctx, ColorDef.white));
      expectColors(vp, [ColorDef.blue, ColorDef.white], ColorDef.white, (ctx) => addSquareDecoration(ctx, ColorDef.blue));
      expectColors(vp, [ColorDef.red, ColorDef.white], ColorDef.red, (ctx) => addSquareDecoration(ctx, ColorDef.white, undefined, FillFlags.Always));
      expectColors(vp, [ColorDef.blue, ColorDef.white], ColorDef.white, (ctx) => addSquareDecoration(ctx, ColorDef.blue, undefined, FillFlags.Always));

      expectColors(vp, [ColorDef.black, ColorDef.white], ColorDef.white, (ctx) => addSquareDecoration(ctx, ColorDef.white));
      expectColors(vp, [ColorDef.black], ColorDef.white, (ctx) => addSquareDecoration(ctx, ColorDef.white), { rect: new ViewRect(2, 2, 8, 8) });
      expectColors(vp, [ColorDef.black], ColorDef.white, (ctx) => addSquareDecoration(ctx, ColorDef.white, undefined, FillFlags.Always), { rect: new ViewRect(2, 2, 8, 8) });

      expectColors(vp, [ColorDef.black, ColorDef.white], ColorDef.black, (ctx) => addSquareDecoration(ctx, ColorDef.white));
      expectColors(vp, [ColorDef.white], ColorDef.black, (ctx) => addSquareDecoration(ctx, ColorDef.white), { rect: new ViewRect(2, 2, 8, 8) });
      expectColors(vp, [ColorDef.white], ColorDef.black, (ctx) => addSquareDecoration(ctx, ColorDef.white, undefined, FillFlags.Always), { rect: new ViewRect(2, 2, 8, 8) });
    });
  });

  function createTexturedMaterial(color: ColorDef, type?: RenderTexture.Type): RenderMaterial {
    const source = ImageBuffer.create(new Uint8Array(3), ImageBufferFormat.Rgb, 1);
    source.data[0] = color.colors.r;
    source.data[1] = color.colors.g;
    source.data[2] = color.colors.b;
    const texture = IModelApp.renderSystem.createTexture({ image: { source }, ownership: "external", type })!;
    return IModelApp.renderSystem.createRenderMaterial({ textureMapping: { texture } })!;
  }

  it("only applies to textured meshes if textures are disabled", () => {
    testBlankViewport((vp) => {
      vp.viewFlags = vp.viewFlags.copy({ renderMode: RenderMode.SmoothShade, lighting: false, textures: true });
      const blueMaterial = createTexturedMaterial(ColorDef.blue);
      expectColors(vp, [ColorDef.white, ColorDef.blue], ColorDef.white, (ctx) => addSquareDecoration(ctx, ColorDef.white, blueMaterial));
      expectColors(vp, [ColorDef.white, ColorDef.blue], ColorDef.white, (ctx) => addSquareDecoration(ctx, ColorDef.white, blueMaterial, FillFlags.Always));

      const whiteMaterial = createTexturedMaterial(ColorDef.white);
      expectColors(vp, [ColorDef.white], ColorDef.white, (ctx) => addSquareDecoration(ctx, ColorDef.white, whiteMaterial));
      expectColors(vp, [ColorDef.white], ColorDef.white, (ctx) => addSquareDecoration(ctx, ColorDef.white, whiteMaterial, FillFlags.Always));

      vp.viewFlags = vp.viewFlags.with("textures", false);
      expectColors(vp, [ColorDef.white, ColorDef.black], ColorDef.white, (ctx) => addSquareDecoration(ctx, ColorDef.white, blueMaterial));
      expectColors(vp, [ColorDef.white, ColorDef.black], ColorDef.white, (ctx) => addSquareDecoration(ctx, ColorDef.white, whiteMaterial));
      expectColors(vp, [ColorDef.white, ColorDef.black], ColorDef.white, (ctx) => addSquareDecoration(ctx, ColorDef.white, blueMaterial, FillFlags.Always));
      expectColors(vp, [ColorDef.white, ColorDef.black], ColorDef.white, (ctx) => addSquareDecoration(ctx, ColorDef.white, whiteMaterial, FillFlags.Always));
    });
  });

  it("applies to white raster text", () => {
    testBlankViewport((vp) => {
      vp.viewFlags = vp.viewFlags.copy({ renderMode: RenderMode.SmoothShade, lighting: false });
      const blueMaterial = createTexturedMaterial(ColorDef.blue, RenderTexture.Type.Glyph);
      const blue = ColorDef.from(3, 3, 255); // glyphs are anti-aliased, they won't be precisely blue.
      expectColors(vp, [ColorDef.white, blue], ColorDef.white, (ctx) => addSquareDecoration(ctx, ColorDef.blue, blueMaterial));
      expectColors(vp, [ColorDef.white, blue], ColorDef.white, (ctx) => addSquareDecoration(ctx, ColorDef.blue, blueMaterial, FillFlags.Always));

      const whiteMaterial = createTexturedMaterial(ColorDef.white, RenderTexture.Type.Glyph);
      const black = ColorDef.from(3, 3, 3); // glyphs are anti-aliased, they won't be precisely black.
      expectColors(vp, [ColorDef.white, black], ColorDef.white, (ctx) => addSquareDecoration(ctx, ColorDef.white, whiteMaterial));
      expectColors(vp, [ColorDef.white, black], ColorDef.white, (ctx) => addSquareDecoration(ctx, ColorDef.white, whiteMaterial, FillFlags.Always));

      expectColors(vp, [ColorDef.white, ColorDef.red], ColorDef.red, (ctx) => addSquareDecoration(ctx, ColorDef.white, whiteMaterial));
      expectColors(vp, [ColorDef.white, ColorDef.red], ColorDef.red, (ctx) => addSquareDecoration(ctx, ColorDef.white, whiteMaterial, FillFlags.Always));
    });
  });

  describe("ImageGraphics", () => {
    // ImageGraphics have the "always display texture" flag applied in tile generator. There's no concept of ImageGraphic on the front-end (e.g., in GraphicBuilder or DisplayParams).
    // Just set the flag to simulate.
    let originalFunc: typeof RenderSystem.prototype.createMeshGeometry;
    beforeAll(() => {
      originalFunc = IModelApp.renderSystem.createMeshGeometry; // eslint-disable-line @typescript-eslint/unbound-method
      IModelApp.renderSystem.createMeshGeometry = (params, viOrigin) => {
        expect(params.surface.textureMapping).not.to.be.undefined;
        params.surface.textureMapping!.alwaysDisplayed = true;
        return originalFunc.apply(IModelApp.renderSystem, [params, viOrigin]);
      };
    });

    afterAll(() => IModelApp.renderSystem.createMeshGeometry = originalFunc);  
  
    it("are never affected by white-on-white reversal", () => {
      testBlankViewport((vp) => {
        vp.viewFlags = vp.viewFlags.copy({ renderMode: RenderMode.SmoothShade, lighting: false, textures: true });
        const blueMaterial = createTexturedMaterial(ColorDef.blue);
        expectColors(vp, [ColorDef.white, ColorDef.blue], ColorDef.white, (ctx) => addSquareDecoration(ctx, ColorDef.white, blueMaterial));
        expectColors(vp, [ColorDef.white, ColorDef.blue], ColorDef.white, (ctx) => addSquareDecoration(ctx, ColorDef.white, blueMaterial, FillFlags.Always));

        const whiteMaterial = createTexturedMaterial(ColorDef.white);
        expectColors(vp, [ColorDef.white], ColorDef.white, (ctx) => addSquareDecoration(ctx, ColorDef.white, whiteMaterial));
        expectColors(vp, [ColorDef.white], ColorDef.white, (ctx) => addSquareDecoration(ctx, ColorDef.white, whiteMaterial, FillFlags.Always));

        vp.viewFlags = vp.viewFlags.with("textures", false);
        expectColors(vp, [ColorDef.white, ColorDef.blue], ColorDef.white, (ctx) => addSquareDecoration(ctx, ColorDef.white, blueMaterial, FillFlags.Always));
        expectColors(vp, [ColorDef.white], ColorDef.white, (ctx) => addSquareDecoration(ctx, ColorDef.white, whiteMaterial, FillFlags.Always));
      });
    });
  });

  it("applies to edges but not surfaces if edges are displayed", () => {
    testBlankViewport((vp) => {
      vp.viewFlags = vp.viewFlags.copy({ renderMode: RenderMode.SmoothShade, lighting: false, visibleEdges: true });
      expectColors(vp, [ColorDef.white, ColorDef.black], ColorDef.white, (ctx) => addSquareDecoration(ctx, ColorDef.white));
      expectColors(vp, [ColorDef.white], ColorDef.white, (ctx) => addSquareDecoration(ctx, ColorDef.white), { rect: new ViewRect(2, 2, 8, 8) });

      vp.viewFlags = vp.viewFlags.copy({ renderMode: RenderMode.SmoothShade, lighting: false, visibleEdges: false });
      expectColors(vp, [ColorDef.white, ColorDef.black], ColorDef.white, (ctx) => addSquareDecoration(ctx, ColorDef.white));
      expectColors(vp, [ColorDef.black], ColorDef.white, (ctx) => addSquareDecoration(ctx, ColorDef.white), { rect: new ViewRect(2, 2, 8, 8) });
    });
    
  });

  it("doesn't apply to background fill", () => {
    testBlankViewport((vp) => {
      vp.viewFlags = vp.viewFlags.copy({ renderMode: RenderMode.SmoothShade, lighting: false });
      expectColors(vp, [ColorDef.white], ColorDef.white, (ctx) => addSquareDecoration(ctx, ColorDef.white, undefined, FillFlags.Background));
      expectColors(vp, [ColorDef.white], ColorDef.white, (ctx) => addSquareDecoration(ctx, ColorDef.white, undefined, FillFlags.Background | FillFlags.Always));
    })
  });

  it("doesn't apply to lit surfaces", () => {
    testBlankViewport((vp) => {
      vp.viewFlags = vp.viewFlags.copy({ renderMode: RenderMode.SmoothShade, lighting: true });
      const litWhite = ColorDef.from(177, 177, 177);
      expectColors(vp, [ColorDef.white, litWhite], ColorDef.white, (ctx) => addSquareDecoration(ctx, ColorDef.white));
      expectColors(vp, [ColorDef.white, litWhite], ColorDef.white, (ctx) => addSquareDecoration(ctx, ColorDef.white, undefined, FillFlags.Always));
      vp.viewFlags = vp.viewFlags.copy({ renderMode: RenderMode.SmoothShade, lighting: false });
      expectColors(vp, [ColorDef.black, ColorDef.white], ColorDef.white, (ctx) => addSquareDecoration(ctx, ColorDef.white));
      expectColors(vp, [ColorDef.black, ColorDef.white], ColorDef.white, (ctx) => addSquareDecoration(ctx, ColorDef.white, undefined, FillFlags.Always));
    });
  });
});
