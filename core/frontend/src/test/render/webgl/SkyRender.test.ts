/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ColorDef, Environment, EnvironmentProps, ImageSource, ImageSourceFormat, RenderTexture, SkyBoxImageType } from "@itwin/core-common";
import { IModelConnection } from "../../../IModelConnection";
import { ScreenViewport } from "../../../Viewport";
import { IModelApp } from "../../../IModelApp";
import { SpatialViewState } from "../../../SpatialViewState";
import { createBlankConnection } from "../../createBlankConnection";
import { expectColors, expectNotTheseColors } from "../../ExpectColors";
import { BeDuration } from "@itwin/core-bentley";
import { EnvironmentDecorations } from "../../../EnvironmentDecorations";
import { imageElementFromImageSource } from "../../../ImageUtil";
import { expect } from "chai";
import { Texture2DHandle, TextureCubeHandle } from "../../../webgl";

describe("Sky rendering", () => {
  let iModel: IModelConnection;
  let viewport: ScreenViewport;

  const div = document.createElement("div");
  div.style.width = div.style.height = "20px";
  document.body.appendChild(div);

  function createView(env?: EnvironmentProps): SpatialViewState {
    const view = SpatialViewState.createBlank(iModel, {x: 0, y: 0, z: 0}, {x: 1, y: 1, z: 1});
    if (env)
      view.displayStyle.environment = Environment.fromJSON(env);

    return view;
  }

  class Decorations extends EnvironmentDecorations {
    public get sky() { return this._sky; }
    public get ground() { return this._ground; }
    public get environment() { return this._environment; }

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
      return BeDuration.wait(1);
    }
  }

  before(async () => {
    await IModelApp.startup();

    // 1x1 red png image
    const redPngData = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0, 144, 119, 83, 222, 0, 0, 0, 1, 115, 82, 71, 66, 0, 174, 206, 28, 233, 0, 0, 0, 4, 103, 65, 77, 65, 0, 0, 177, 143, 11, 252, 97, 5, 0, 0, 0, 9, 112, 72, 89, 115, 0, 0, 14, 195, 0, 0, 14, 195, 1, 199, 111, 168, 100, 0, 0, 0, 12, 73, 68, 65, 84, 24, 87, 99, 248, 207, 192, 0, 0, 3, 1, 1, 0, 99, 36, 85, 211, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);

    const textureImage = {
      image: await imageElementFromImageSource(new ImageSource(redPngData, ImageSourceFormat.Png)),
      format: ImageSourceFormat.Png,
    };

    const createTexture = () => {
      const img = textureImage.image;
      return { texture: Texture2DHandle.createForImage(img, false, RenderTexture.Type.SkyBox) } as unknown as RenderTexture;
    };
    const createTextureCube = () => {
      const img = textureImage.image;
      return { texture: TextureCubeHandle.createForCubeImages(img, img, img, img, img, img) } as unknown as RenderTexture;
    };
    IModelApp.renderSystem.createTextureFromCubeImages = createTextureCube;
    IModelApp.renderSystem.createTexture = createTexture;
    IModelApp.renderSystem.loadTextureImage = async () => Promise.resolve(textureImage);

    iModel = createBlankConnection();
  });

  after(async () => {
    await iModel.close();
    await IModelApp.shutdown();
  });

  it("draws sky cube", async () => {
    const view = createView({
      sky: {
        display: true,
        image: {
          type: SkyBoxImageType.Cube,
          textures: {
            front: "0x1", back: "0x2",
            left: "0x3", right: "0x4",
            top: "0x5", bottom: "0x6",
          },
        },
      },
    });

    viewport = ScreenViewport.create(div, view);

    const dec = await Decorations.create(view);

    expect(dec.sky.params!.type).to.equal("cube");
    expectColors(viewport, [ColorDef.red]);
  }).timeout(20000); // macOS is slow.

  it("draws sky sphere", async () => {
    const view = createView({
      sky: {
        display: true,
        image: {
          type: SkyBoxImageType.Spherical,
          texture: "0x3",
        },
      },
    });

    viewport = ScreenViewport.create(div, view);

    const dec = await Decorations.create(view);

    expect(dec.sky.params!.type).to.equal("sphere");
    expectColors(viewport, [ColorDef.red]);
  }).timeout(20000); // macOS is slow.

  it("draws sky gradient", async () => {
    const view = createView({
      sky: {
        display: true,
        nadirColor: ColorDef.blue.toJSON(),
        zenithColor: ColorDef.red.toJSON(),
        skyColor: ColorDef.white.toJSON(),
        groundColor: ColorDef.black.toJSON(),
        skyExponent: 42,
        groundExponent: 24,
      },
    });

    viewport = ScreenViewport.create(div, view);

    const dec = await Decorations.create(view);

    expect(dec.sky.params!.type).to.equal("gradient");
    expectNotTheseColors(viewport, [view.displayStyle.backgroundColor]);
  }).timeout(20000); // macOS is slow.

  it("draws no sky", async () => {
    const view = createView({});
    viewport = ScreenViewport.create(div, view);
    expectColors(viewport, [view.displayStyle.backgroundColor]);
  }).timeout(20000); // macOS is slow.
});
