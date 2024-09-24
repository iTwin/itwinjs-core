/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BeDuration } from "@itwin/core-bentley";
import { ColorDef, EmptyLocalization, Environment, EnvironmentProps, Gradient, ImageSource, ImageSourceFormat, RenderTexture, SkyBox, SkyBoxImageType } from "@itwin/core-common";
import { EnvironmentDecorations } from "../../EnvironmentDecorations";
import { imageElementFromImageSource } from "../../common/ImageUtil";
import { SpatialViewState } from "../../SpatialViewState";
import { IModelConnection } from "../../IModelConnection";
import { IModelApp } from "../../IModelApp";
import { createBlankConnection } from "../createBlankConnection";

describe("EnvironmentDecorations", () => {
  let iModel: IModelConnection;

  function createView(env?: EnvironmentProps): SpatialViewState {
    const view = SpatialViewState.createBlank(iModel, { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });
    if (env)
      view.displayStyle.environment = Environment.fromJSON(env);

    return view;
  }

  class Decorations extends EnvironmentDecorations {
    public get sky() {
      return this._sky;
    }
    public get ground() {
      return this._ground;
    }
    public get environment() {
      return this._environment;
    }

    public constructor(view?: SpatialViewState, onLoad?: () => void, onDispose?: () => void) {
      super(view ?? createView(), onLoad ?? (() => undefined), onDispose ?? (() => undefined));
    }

    public static async create(view?: SpatialViewState, onLoad?: () => void, onDispose?: () => void): Promise<Decorations> {
      const dec = new Decorations(view, onLoad, onDispose);
      await dec.load();
      return dec;
    }

    public async load(): Promise<void> {
      if (!this.sky.promise)
        return;

      await this.sky.promise;
      return BeDuration.wait(1).then(() => {
        expect(this.sky.promise).toBeUndefined();
        expect(this.sky.params).toBeDefined();
      });
    }
  }

  beforeAll(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });

    const pngData = new Uint8Array([
      137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 3, 0, 0, 0, 3, 8, 2, 0, 0, 0, 217, 74, 34, 232, 0, 0, 0, 1, 115, 82, 71, 66, 0, 174, 206, 28, 233, 0, 0, 0, 4, 103, 65, 77, 65, 0, 0, 177, 143, 11, 252, 97, 5, 0, 0,
      0, 9, 112, 72, 89, 115, 0, 0, 14, 195, 0, 0, 14, 195, 1, 199, 111, 168, 100, 0, 0, 0, 24, 73, 68, 65, 84, 24, 87, 99, 248, 15, 4, 12, 12, 64, 4, 198, 64, 46, 132, 5, 162, 254, 51, 0, 0, 195, 90, 10, 246, 127, 175, 154, 145, 0, 0, 0, 0,
      73, 69, 78, 68, 174, 66, 96, 130,
    ]);

    const textureImage = {
      image: await imageElementFromImageSource(new ImageSource(pngData, ImageSourceFormat.Png)),
      format: ImageSourceFormat.Png,
    };

    const createdTexturesById = new Map<string | Gradient.Symb, RenderTexture>();
    const createTexture = (id?: string | Gradient.Symb) => {
      const texture = {} as unknown as RenderTexture;
      if (undefined !== id)
        createdTexturesById.set(id, texture);

      return texture;
    };

    IModelApp.renderSystem.findTexture = (key?: string | Gradient.Symb) => (undefined !== key ? createdTexturesById.get(key) : undefined);
    IModelApp.renderSystem.createTextureFromCubeImages = (_a, _b, _c, _d, _e, _f, _g, params) => createTexture(params.key);
    IModelApp.renderSystem.createTexture = (args) => createTexture(args.ownership && "external" !== args.ownership ? args.ownership.key : undefined);
    IModelApp.renderSystem.loadTextureImage = async () => Promise.resolve(textureImage);

    iModel = createBlankConnection();
  });

  afterAll(async () => {
    await iModel.close();
    await IModelApp.shutdown();
  });

  it("initializes from environment", async () => {
    const dec = await Decorations.create(
      createView({
        ground: {
          display: true,
          elevation: 20,
          aboveColor: ColorDef.blue.toJSON(),
          belowColor: ColorDef.red.toJSON(),
        },
        sky: {
          display: true,
          nadirColor: ColorDef.blue.toJSON(),
          zenithColor: ColorDef.red.toJSON(),
          skyColor: ColorDef.white.toJSON(),
          groundColor: ColorDef.black.toJSON(),
          skyExponent: 42,
          groundExponent: 24,
        },
      }),
    );

    expect(dec.ground).toBeDefined();
    expect(dec.ground!.aboveParams.lineColor.equals(ColorDef.blue.withTransparency(0xff))).toBe(true);
    expect(dec.ground!.belowParams.lineColor.equals(ColorDef.red.withTransparency(0xff))).toBe(true);

    let params = dec.sky.params!;
    expect(params).toBeDefined();
    expect(params.type).toEqual("gradient");
    if ("gradient" === params.type) {
      const sky = params.gradient;
      expect(sky).toBeDefined();
      expect(sky.twoColor).toBe(false);
      expect(sky.nadirColor.equals(ColorDef.blue)).toBe(true);
      expect(sky.zenithColor.equals(ColorDef.red)).toBe(true);
      expect(sky.skyColor.equals(ColorDef.white)).toBe(true);
      expect(sky.groundColor.equals(ColorDef.black)).toBe(true);
      expect(sky.skyExponent).toEqual(42);
      expect(sky.groundExponent).toEqual(24);
    }

    dec.setEnvironment(
      Environment.fromJSON({
        ground: {
          display: true,
          aboveColor: ColorDef.white.toJSON(),
          belowColor: ColorDef.black.toJSON(),
        },
        sky: {
          display: false,
          nadirColor: ColorDef.white.toJSON(),
          zenithColor: ColorDef.black.toJSON(),
          skyColor: ColorDef.red.toJSON(),
          groundColor: ColorDef.green.toJSON(),
          skyExponent: 123,
          groundExponent: 456,
        },
      }),
    );

    await dec.load();
    expect(dec.ground!.aboveParams.lineColor.equals(ColorDef.white.withTransparency(0xff))).toBe(true);
    expect(dec.ground!.belowParams.lineColor.equals(ColorDef.black.withTransparency(0xff))).toBe(true);

    params = dec.sky.params!;
    expect(params).toBeDefined();
    expect(params.type).toEqual("gradient");
    if ("gradient" === params.type) {
      const sky = params.gradient;
      expect(sky.nadirColor.equals(ColorDef.white)).toBe(true);
      expect(sky.zenithColor.equals(ColorDef.black)).toBe(true);
      expect(sky.skyColor.equals(ColorDef.red)).toBe(true);
      expect(sky.groundColor.equals(ColorDef.green)).toBe(true);
      expect(sky.skyExponent).toEqual(123);
      expect(sky.groundExponent).toEqual(456);
    }
  });

  it("disposes", async () => {
    let disposed = false;
    const dec = new Decorations(createView({ ground: { display: true } }), undefined, () => (disposed = true));
    expect(disposed).toBe(false);
    expect(dec.ground).toBeDefined();
    expect(dec.sky.params).toBeDefined();

    await dec.load();
    expect(disposed).toBe(false);
    expect(dec.ground).toBeDefined();
    expect(dec.sky.promise).toBeUndefined();
    expect(dec.sky.params).toBeDefined();

    dec.dispose();
    expect(disposed).toBe(true);
    expect(dec.ground).toBeUndefined();
    expect(dec.sky.promise).toBeUndefined();
    expect(dec.sky.params).toBeUndefined();
  });

  it("only allocates ground while displayed", async () => {
    const dec = await Decorations.create();
    expect(dec.ground).toBeUndefined();

    dec.setEnvironment(Environment.fromJSON({ ground: { display: true } }));
    expect(dec.ground).toBeDefined();

    dec.setEnvironment(Environment.fromJSON());
    expect(dec.ground).toBeUndefined();
  });

  it("only recreates ground if settings change", async () => {
    const dec = new Decorations(createView({ ground: { display: true } }));
    const prevGround = dec.ground;
    expect(prevGround).toBeDefined();

    dec.setEnvironment(dec.environment.clone({ displaySky: true }));
    expect(dec.ground).toEqual(prevGround);

    dec.setEnvironment(dec.environment.clone({ ground: dec.environment.ground.clone({ elevation: 100 }) }));
    expect(dec.ground).not.toEqual(prevGround);
    expect(dec.ground).toBeDefined();

    await dec.load();
  });

  it("always loads sky", async () => {
    const dec = new Decorations(createView({ sky: { display: false } }));
    expect(dec.sky.params).toBeDefined();
    expect(dec.sky.promise).toBeUndefined();

    await dec.load();
    expect(dec.sky.params).toBeDefined();
    expect(dec.sky.promise).toBeUndefined();
  });

  it("notifies when loading completes", async () => {
    let loaded = false;

    // default gradient sky loads immediately.
    const dec = new Decorations(undefined, () => (loaded = true));
    expect(loaded).toBe(true);
    expect(loaded).toBe(true);

    loaded = false;

    // textured sky sphere loads asynchronously the first time (must query texture image from backend)
    dec.setEnvironment(
      dec.environment.clone({
        sky: SkyBox.fromJSON({
          image: {
            type: SkyBoxImageType.Spherical,
            texture: "0x987",
          },
        }),
      }),
    );

    expect(loaded).toBe(false);
    await dec.load();
    expect(loaded).toBe(true);
  });

  it("preserves previous skybox until new skybox loads", async () => {
    const dec = await Decorations.create();
    const params = dec.sky.params;
    expect(params).toBeDefined();

    dec.setEnvironment(
      dec.environment.clone({
        sky: SkyBox.fromJSON({
          image: {
            type: SkyBoxImageType.Spherical,
            texture: "0xabc",
          },
        }),
      }),
    );

    expect(dec.sky.params).toEqual(params);
    expect(dec.sky.promise).toBeDefined();

    await dec.load();
    expect(dec.sky.params).not.toEqual(params);
    expect(dec.sky.promise).toBeUndefined();
  });

  it("produces sky sphere", async () => {
    const dec = await Decorations.create(
      createView({
        sky: {
          image: {
            type: SkyBoxImageType.Spherical,
            texture: "0x123",
          },
        },
      }),
    );

    expect(dec.sky.params!.type).toEqual("sphere");
  });

  it("produces sky cube", async () => {
    const dec = await Decorations.create(
      createView({
        sky: {
          image: {
            type: SkyBoxImageType.Cube,
            textures: {
              front: "0x1",
              back: "0x2",
              left: "0x3",
              right: "0x4",
              top: "0x5",
              bottom: "0x6",
            },
          },
        },
      }),
    );

    expect(dec.sky.params!.type).toEqual("cube");
  });

  it("loads synchronously if texture(s) were previously cached by RenderSystem", async () => {
    // Asynchronously load sphere image
    const dec = new Decorations(
      createView({
        sky: {
          image: {
            type: SkyBoxImageType.Spherical,
            texture: "0xdef",
          },
        },
      }),
    );

    expect(dec.sky.promise).toBeDefined();
    await dec.load();
    expect(dec.sky.promise).toBeUndefined();
    expect(dec.sky.params!.type).toEqual("sphere");

    const firstSphere = dec.sky.params;

    // Change to gradient (synchronous)
    dec.setEnvironment(dec.environment.clone({ sky: SkyBox.fromJSON(undefined) }));
    expect(dec.sky.params!.type).toEqual("gradient");

    // Change back to same sphere image - synchronous this time.
    dec.setEnvironment(
      dec.environment.clone({
        sky: SkyBox.fromJSON({
          image: {
            type: SkyBoxImageType.Spherical,
            texture: "0xdef",
          },
        }),
      }),
    );

    expect(dec.sky.promise).toBeUndefined();
    expect(dec.sky.params!.type).toEqual("sphere");
    expect(dec.sky.params).not.toBe(firstSphere);
  });

  it("falls back to sky gradient on error", async () => {
    let dec = await Decorations.create(
      createView({
        sky: {
          display: true,
          image: {
            type: SkyBoxImageType.Spherical,
            texture: "NotATexture",
          },
        },
      }),
    );

    expect(dec.sky.params).toBeDefined();
    expect(dec.sky.params!.type).toEqual("gradient");

    dec = await Decorations.create(
      createView({
        sky: {
          display: true,
          image: {
            type: SkyBoxImageType.Cube,
            textures: {
              front: "front",
              back: "back",
              top: "top",
              bottom: "bottom",
              left: "left",
              right: "right",
            },
          },
        },
      }),
    );

    expect(dec.sky.params).toBeDefined();
    expect(dec.sky.params!.type).toEqual("gradient");
  });
});
