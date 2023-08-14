/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import {
  EmptyLocalization,
  Gradient, ImageSource, ImageSourceFormat, RenderTexture, RgbColorProps, TextureMapping, TextureTransparency,
} from "@itwin/core-common";
import { Capabilities } from "@itwin/webgl-compatibility";
import { IModelApp } from "../../../IModelApp";
import { CreateRenderMaterialArgs } from "../../../render/CreateRenderMaterialArgs";
import { IModelConnection } from "../../../IModelConnection";
import { MockRender } from "../../../render/MockRender";
import { Material } from "../../../render/webgl/Material";
import { RenderSystem } from "../../../render/RenderSystem";
import { TileAdmin } from "../../../tile/internal";
import { System } from "../../../render/webgl/System";
import { createBlankConnection } from "../../createBlankConnection";
import { unpackAndNormalizeMaterialParam } from "./Material.test";

function _createCanvas(): HTMLCanvasElement | undefined {
  const canvas = document.createElement("canvas");
  if (null === canvas)
    return undefined;
  return canvas;
}

describe("Render Compatibility", () => {
  it("requires WebGL 2", () => {
    const canvas = _createCanvas();
    expect(canvas).to.not.be.undefined;
    // force canvas to fail context creation if webgl2 is requested
    const originalMethod = canvas!.getContext.bind(canvas);
    (canvas as any).getContext = (contextId: any, args?: any) => {
      if (contextId === "webgl2")
        return null;

      return originalMethod(contextId, args);
    };

    const context = System.createContext(canvas!, false);
    expect(context).to.be.undefined;
  });
});

describe("Instancing", () => {
  class TestApp extends MockRender.App {
    public static async test(enableInstancing: boolean, expectEnabled: boolean): Promise<void> {
      const tileAdminProps: TileAdmin.Props = { enableInstancing };

      await IModelApp.startup({
        tileAdmin: tileAdminProps,
        localization: new EmptyLocalization(),
      });

      expect(IModelApp.tileAdmin.enableInstancing).to.equal(expectEnabled);
      await IModelApp.shutdown();
    }
  }

  after(async () => {
    // make sure app shut down if exception occurs during test
    if (IModelApp.initialized)
      await TestApp.shutdown();
  });

  it("should enable instancing if supported and requested", async () => {
    await TestApp.test(true, true);
  });

  it("should not enable instancing if supported but not requested", async () => {
    await TestApp.test(false, false);
  });
});

describe("ExternalTextures", () => {
  class TestApp extends MockRender.App {
    public static async test(enableExternalTextures: boolean, expectEnabled: boolean): Promise<void> {
      const tileAdminProps: TileAdmin.Props = { enableExternalTextures };

      await IModelApp.startup({
        tileAdmin: tileAdminProps,
        localization: new EmptyLocalization(),
      });

      expect(IModelApp.tileAdmin.enableExternalTextures).to.equal(expectEnabled);
      await IModelApp.shutdown();
    }
  }

  after(async () => {
    // make sure app shut down if exception occurs during test
    if (IModelApp.initialized)
      await TestApp.shutdown();
  });

  it("should enable external textures if requested", async () => {
    await TestApp.test(true, true);
  });

  it("should not enable external textures if not requested", async () => {
    await TestApp.test(false, false);
  });
});

describe("System", () => {
  it("should override webgl context attributes", () => {
    const expectAttributes = (system: System, expected: WebGLContextAttributes) => {
      const attrs = system.context.getContextAttributes()!;
      expect(attrs).not.to.be.null;
      expect(attrs.premultipliedAlpha).to.equal(expected.premultipliedAlpha);
      expect(attrs.preserveDrawingBuffer).to.equal(expected.preserveDrawingBuffer);
      expect(attrs.antialias).to.equal(expected.antialias);
      expect(attrs.powerPreference).to.equal(expected.powerPreference);
    };

    const defaultSys = System.create();
    expectAttributes(defaultSys, { antialias: true, premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: "high-performance" });

    const sys1Attrs: WebGLContextAttributes = { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: true, powerPreference: "low-power" };
    const sys1 = System.create({ contextAttributes: sys1Attrs });
    expectAttributes(sys1, sys1Attrs);

    // Override only some attributes; use defaults for others.
    const sys2Attrs: WebGLContextAttributes = { antialias: false, preserveDrawingBuffer: true };
    const sys2 = System.create({ contextAttributes: sys2Attrs });
    expectAttributes(sys2, { ...sys2Attrs, powerPreference: "high-performance", premultipliedAlpha: true });
  });

  describe("createTextureFromImageSource", () => {
    const imodel = {} as unknown as IModelConnection;

    class TestSystem extends System {
      public static readonly requestedIds = new Array<string | undefined>();

      public static reset(): void {
        this.requestedIds.length = 0;
      }

      public constructor(canvas: HTMLCanvasElement, context: WebGL2RenderingContext, capabilities: Capabilities, options: RenderSystem.Options) {
        super(canvas, context, capabilities, options);

        const map = this.getIdMap(imodel);
        const createTextureFromImageSource = map.createTextureFromImageSource.bind(map);

        // eslint-disable-next-line @typescript-eslint/unbound-method
        map.createTextureFromImageSource = async (args) => {
          expect(typeof args.ownership).to.equal("object");
          const key = (args.ownership as any).key;
          TestSystem.requestedIds.push(key);
          return createTextureFromImageSource(args, key);
        };
      }
    }

    // This is an encoded png containing a 3x3 square with white in top left pixel, blue in middle pixel, and green in
    // bottom right pixel.  The rest of the square is red.
    const imageSource = new ImageSource(new Uint8Array([
      137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 3, 0, 0, 0, 3, 8, 2, 0, 0, 0, 217, 74, 34,
      232, 0, 0, 0, 1, 115, 82, 71, 66, 0, 174, 206, 28, 233, 0, 0, 0, 4, 103, 65, 77, 65, 0, 0, 177, 143, 11, 252, 97, 5, 0, 0,
      0, 9, 112, 72, 89, 115, 0, 0, 14, 195, 0, 0, 14, 195, 1, 199, 111, 168, 100, 0, 0, 0, 24, 73, 68, 65, 84, 24, 87, 99, 248, 15,
      4, 12, 12, 64, 4, 198, 64, 46, 132, 5, 162, 254, 51, 0, 0, 195, 90, 10, 246, 127, 175, 154, 145, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
    ]), ImageSourceFormat.Png);

    before(async () => {
      await IModelApp.startup({
        renderSys: TestSystem.create(),
        localization: new EmptyLocalization(),
      });
    });

    afterEach(() => {
      TestSystem.reset();
    });

    after(async () => {
      await IModelApp.shutdown();
    });

    function requestThematicGradient(stepCount: number) {
      const symb = Gradient.Symb.fromJSON({
        mode: Gradient.Mode.Thematic,
        thematicSettings: {stepCount},
        keys: [{ value: 0.6804815398789292, color: 610 }, { value: 0.731472008309797, color: 229 }],
      });
      return IModelApp.renderSystem.getGradientTexture(symb, imodel);
    }

    it("should properly request a thematic gradient texture", async () => {
      const g1 = requestThematicGradient(5);
      expect(g1).to.not.be.undefined;
      g1!.dispose();
    });

    it("should properly cache and reuse thematic gradient textures", async () => {
      const g1 = requestThematicGradient(5);
      expect(g1).to.not.be.undefined;
      const g2 = requestThematicGradient(5);
      expect(g2).to.not.be.undefined;
      expect(g2 === g1).to.be.true;
      g1!.dispose();
      g2!.dispose();
    });

    it("should properly create separate thematic gradient textures if thematic settings differ", async () => {
      const g1 = requestThematicGradient(5);
      expect(g1).to.not.be.undefined;
      const g2 = requestThematicGradient(6);
      expect(g2).to.not.be.undefined;
      expect(g2 === g1).to.be.false;
      g1!.dispose();
      g2!.dispose();
    });

    async function requestTexture(key: string | undefined, source?: ImageSource): Promise<RenderTexture | undefined> {
      return IModelApp.renderSystem.createTextureFromSource({
        source: source ?? imageSource,
        transparency: TextureTransparency.Translucent,
        ownership: key ? { iModel: imodel, key } : undefined,
      });
    }

    function expectPendingRequests(expectedCount: number): void {
      const map = System.instance.getIdMap(imodel);
      expect(map.texturesFromImageSources.size).to.equal(expectedCount);
    }

    function expectRequestedIds(expected: Array<string | undefined>): void {
      expect(TestSystem.requestedIds).to.deep.equal(expected);
    }

    it("should decode image only once for multiple requests for same texture", async () => {
      const p1 = requestTexture("a");
      expectPendingRequests(1);
      expectRequestedIds(["a"]);
      const p2 = requestTexture("a");
      expectPendingRequests(1);
      expectRequestedIds(["a"]);

      const t1 = await p1;
      expectPendingRequests(0);
      const t2 = await p2;
      expect(t1).to.equal(t2);
      expect(t1).not.to.be.undefined;

      t1!.dispose();
    });

    it("should decode each different image once", async () => {
      const p1 = requestTexture("b");
      expectPendingRequests(1);
      expectRequestedIds(["b"]);
      const p2 = requestTexture("c");
      expectPendingRequests(2);
      expectRequestedIds(["b", "c"]);

      const t1 = await p1;
      const t2 = await p2;
      expectPendingRequests(0);
      expect(t1).not.to.equal(t2);

      expect(t1).not.to.be.undefined;
      expect(t2).not.to.be.undefined;

      t1!.dispose();
      t2!.dispose();
    });

    it("should not record pending requests for unnamed textures", async () => {
      const p1 = requestTexture(undefined);
      const p2 = requestTexture(undefined);
      expectPendingRequests(0);
      expectRequestedIds([]);

      const t1 = await p1;
      const t2 = await p2;
      expect(t1).not.to.equal(t2);

      t1!.dispose();
      t2!.dispose();
    });

    it("should not record requests for previously-created textures", async () => {
      const p1 = requestTexture("d");
      expectPendingRequests(1);
      const t1 = await p1;
      expectPendingRequests(0);
      expectRequestedIds(["d"]);

      const p2 = requestTexture("d");
      expectPendingRequests(0);
      expectRequestedIds(["d"]);

      const p3 = requestTexture("d");
      expectPendingRequests(0);
      expectRequestedIds(["d"]);

      const t2 = await p2;
      expect(t2).to.equal(t1);

      const t3 = await p3;
      expect(t3).to.equal(t1);

      t1!.dispose();
    });

    it("should return undefined and delete pending request on error", async () => {
      const source = new ImageSource(new Uint8Array([0, 1, 2, 3, 4]), ImageSourceFormat.Png);
      const p1 = requestTexture("e", source);
      expectPendingRequests(1);
      expectRequestedIds(["e"]);

      const t1 = await p1;
      expect(t1).to.be.undefined;
      expectPendingRequests(0);

      const p2 = requestTexture("e");
      expectPendingRequests(1);
      expectRequestedIds(["e", "e"]);

      const t2 = await p2;
      expect(t2).not.to.be.undefined;
      expectPendingRequests(0);

      t2!.dispose();
    });

    it("should return undefined after render system is disposed", async () => {
      const idmap = System.instance.getIdMap(imodel);
      const promise = requestTexture("f");
      expect(idmap.texturesFromImageSources.size).to.equal(1);

      await IModelApp.shutdown();
      const texture = await promise;
      expect(texture).to.be.undefined;
      expect(idmap.texturesFromImageSources.size).to.equal(0);
    });
  });

  describe("createRenderMaterial", () => {
    let iModel: IModelConnection;
    beforeEach(async () => {
      await IModelApp.startup({ localization: new EmptyLocalization() });
      iModel = createBlankConnection();
    });

    afterEach(async () => {
      await iModel.close();
      await IModelApp.shutdown();
    });

    it("caches materials by Id", () => {
      const sys = IModelApp.renderSystem;
      expect(sys.findMaterial("0x1", iModel)).to.be.undefined;
      const mat1 = sys.createRenderMaterial({ source: { id: "0x1", iModel } });
      expect(sys.createRenderMaterial({ source: { id: "0x1", iModel } })).to.equal(mat1);

      const mat2 = sys.createRenderMaterial({ source: { id: "0x2", iModel } });
      expect(mat2).not.to.be.undefined;
      expect(mat2).not.to.equal(mat1);

      const mat0 = sys.createRenderMaterial({});
      expect(mat0).not.to.be.undefined;
      expect(mat0).not.to.equal(mat1);
      expect(mat0).not.to.equal(mat2);

      expect(sys.createRenderMaterial({})).not.to.equal(mat0);
    });

    it("requires valid Id64String for cache", () => {
      const sys = IModelApp.renderSystem;
      const mat1 = sys.createRenderMaterial({ source: { id: "not an id", iModel } });
      expect(mat1).not.to.be.undefined;

      const mat2 = sys.createRenderMaterial({ source: { id: "not an id", iModel } });
      expect(mat2).not.to.be.undefined;
      expect(mat2).not.to.equal(mat1);
    });

    it("produces expected materials from input", () => {
      function unpackMaterial(mat: Material): CreateRenderMaterialArgs {
        const unpackColor = (r: number, g: number, b: number): RgbColorProps => {
          const unpack = (x: number) => Math.floor(x * 255 + 0.5);
          return { r: unpack(r), g: unpack(g), b: unpack(b) };
        };

        const weights = unpackAndNormalizeMaterialParam(mat.fragUniforms[0]);
        const texWeightAndSpecR = unpackAndNormalizeMaterialParam(mat.fragUniforms[1]);
        const specGB = unpackAndNormalizeMaterialParam(mat.fragUniforms[2]);
        const specExp = mat.fragUniforms[3];

        const args: CreateRenderMaterialArgs = {
          diffuse: { weight: Number.parseFloat(weights.x.toPrecision(1)) },
          specular: {
            color: unpackColor(texWeightAndSpecR.y, specGB.x, specGB.y),
            weight: Number.parseFloat(weights.y.toPrecision(1)),
            exponent: specExp,
          },
        };

        if (-1 !== mat.rgba[0])
          args.diffuse!.color = unpackColor(mat.rgba[0], mat.rgba[1], mat.rgba[2]);

        if (-1 !== mat.rgba[3])
          args.alpha = mat.rgba[3];

        if (mat.textureMapping) {
          args.textureMapping = {
            texture: mat.textureMapping.texture,
            mode: mat.textureMapping.params.mode,
            weight: Number.parseFloat(texWeightAndSpecR.x.toPrecision(1)),
            worldMapping: mat.textureMapping.params.worldMapping,
            transform: mat.textureMapping.params.textureMatrix,
          };
        }

        return args;
      }

      const defaults: CreateRenderMaterialArgs = {
        diffuse: { weight: 0.6 },
        specular: { weight: 0.4, exponent: 13.5, color: { r: 255, g: 255, b: 255 } },
      };

      const test = (args: CreateRenderMaterialArgs, expected?: CreateRenderMaterialArgs) => {
        const mat = IModelApp.renderSystem.createRenderMaterial(args) as Material;
        expect(mat).not.to.be.undefined;

        const actual = unpackMaterial(mat);

        // shallow spread operator is annoying...
        expected = expected ?? args;
        expected = {
          ...defaults,
          ...expected,
          diffuse: expected.diffuse ? { ...defaults.diffuse, ...expected.diffuse } : defaults.diffuse,
          specular: expected.specular ? { ...defaults.specular, ...expected.specular } : defaults.specular,
        };

        if (expected.textureMapping) {
          expected.textureMapping = {
            weight: 1,
            mode: TextureMapping.Mode.Parametric,
            worldMapping: false,
            transform: TextureMapping.Trans2x3.identity,
            ...expected.textureMapping,
          };
        }

        expect(actual).to.deep.equal(expected);
      };

      test({ }, defaults);
      test(defaults);

      const color = { r: 1, g: 127, b: 255 };
      test({ alpha: 1 });
      test({ alpha: 0 });
      test({ alpha: 0.5 });
      test({ alpha: -1 }, { alpha: 0 });
      test({ alpha: 2 }, { alpha: 1 });

      test({ diffuse: { color } });
      test({ diffuse: { color, weight: 0 } });
      test({ diffuse: { color, weight: 1 } });
      test({ diffuse: { color, weight: 0.5 } });
      test({ diffuse: { color, weight: -1 } }, { diffuse: { color, weight: 0 } });
      test({ diffuse: { color, weight: 2 } }, { diffuse: { color, weight: 1 } });

      test({ specular: { weight: 0 } });
      test({ specular: { weight: 1 } });
      test({ specular: { weight: 0.5 } });
      test({ specular: { weight: -1 } }, { specular: { weight: 0 } });
      test({ specular: { weight: 2 } }, { specular: { weight: 1 } });
      test({ specular: { exponent: 0 } });
      test({ specular: { exponent: -12.5 } });
      test({ specular: { exponent: 54321 } });
      test({ specular: { color } });

      const texture = { dummy: "my texture" } as unknown as RenderTexture;
      test({ textureMapping: { texture } });
      test({ textureMapping: { texture, weight: 0 } });
      test({ textureMapping: { texture, weight: 1 } });
      test({ textureMapping: { texture, weight: -1 } }, { textureMapping: { texture, weight: 0 } });
      test({ textureMapping: { texture, weight: 2 } }, { textureMapping: { texture, weight: 1 } });
      test({ textureMapping: { texture, weight: 0.5 } });
    });
  });

  describe("context loss", () => {
    const contextLossHandler = async () => RenderSystem.contextLossHandler();

    beforeEach(async () => {
      await IModelApp.startup({ localization: new EmptyLocalization() });
    });

    afterEach(async () => {
      RenderSystem.contextLossHandler = async () => contextLossHandler;
      await IModelApp.shutdown();
    });

    it("invokes handler", async () => {
      let contextLost = false;
      RenderSystem.contextLossHandler = async () => {
        contextLost = true;
        return Promise.resolve();
      };

      async function waitForContextLoss(): Promise<void> {
        if (contextLost)
          return Promise.resolve();

        await new Promise<void>((resolve: any) => setTimeout(resolve, 10));
        return waitForContextLoss();
      }

      const debugControl = IModelApp.renderSystem.debugControl!;
      expect(debugControl).not.to.be.undefined;

      expect(debugControl.loseContext()).to.be.true;
      await waitForContextLoss();
    });
  });
});
