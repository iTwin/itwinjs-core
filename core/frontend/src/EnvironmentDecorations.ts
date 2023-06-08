/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { assert, Id64 } from "@itwin/core-bentley";
import {
  ColorDef, Environment, Gradient, GraphicParams, RenderTexture, SkyCube, SkySphere, TextureImageSpec, TextureMapping,
} from "@itwin/core-common";
import { Point2d, Point3d, PolyfaceBuilder, StrokeOptions } from "@itwin/core-geometry";
import { tryImageElementFromUrl } from "./common/ImageUtil";
import { IModelApp } from "./IModelApp";
import { GraphicType } from "./render/GraphicBuilder";
import { RenderGraphic } from "./render/RenderGraphic";
import { RenderSkyBoxParams } from "./render/RenderSystem";
import { DecorateContext } from "./ViewContext";
import { ViewState3d } from "./ViewState";

/** @internal */
export interface GroundPlaneDecorations {
  readonly aboveParams: GraphicParams;
  readonly belowParams: GraphicParams;
}

interface SkyBoxParamsLoader {
  // Invoke to obtain sky box params.
  load(): RenderSkyBoxParams | undefined;
  // If defined, await before invoking load().
  preload?: Promise<boolean>;
}

/** @internal */
export interface SkyBoxDecorations {
  params?: RenderSkyBoxParams;
  promise?: Promise<boolean>;
}

/** @internal */
export class EnvironmentDecorations {
  protected readonly _view: ViewState3d;
  protected readonly _onLoaded: () => void;
  protected readonly _onDispose: () => void;
  protected _environment: Environment;
  protected _ground?: GroundPlaneDecorations;
  protected _sky: SkyBoxDecorations;

  public constructor(view: ViewState3d, onLoaded: () => void, onDispose: () => void) {
    this._environment = view.displayStyle.environment;
    this._view = view;
    this._onLoaded = onLoaded;
    this._onDispose = onDispose;
    this._sky = {};
    this.loadSkyBox();
    if (this._environment.displayGround)
      this.loadGround();
  }

  public dispose(): void {
    this._ground = undefined;
    this._sky.params = this._sky.promise = undefined;

    this._onDispose();
  }

  public setEnvironment(env: Environment): void {
    const prev = this._environment;
    if (prev === env)
      return;

    this._environment = env;

    // Update ground plane
    if (!env.displayGround || env.ground !== prev.ground)
      this._ground = undefined;

    if (env.displayGround && !this._ground)
      this.loadGround();

    // Update sky box
    if (env.sky !== prev.sky)
      this.loadSkyBox();
  }

  public decorate(context: DecorateContext): void {
    const env = this._environment;

    let sky: RenderGraphic | undefined;
    if (env.displayAtmosphere) {
      sky = IModelApp.renderSystem.createSkyBox(this.createSkyGradientParams());
    } else if (env.displaySky && this._sky.params) {
      sky = IModelApp.renderSystem.createSkyBox(this._sky.params);
    }
    if (sky)
      context.setSkyBox(sky);

    if (!env.displayGround || !this._ground)
      return;

    const extents = this._view.getGroundExtents(context.viewport);
    if (extents.isNull)
      return;

    const points: Point3d[] = [extents.low.clone(), extents.low.clone(), extents.high.clone(), extents.high.clone()];
    points[1].x = extents.high.x;
    points[3].x = extents.low.x;

    const aboveGround = this._view.isEyePointAbove(extents.low.z);
    const params = aboveGround ? this._ground.aboveParams : this._ground.belowParams;
    const builder = context.createGraphicBuilder(GraphicType.WorldDecoration);
    builder.activateGraphicParams(params);

    const strokeOptions = new StrokeOptions();
    strokeOptions.needParams = true;
    const polyfaceBuilder = PolyfaceBuilder.create(strokeOptions);
    polyfaceBuilder.toggleReversedFacetFlag();
    const uvParams: Point2d[] = [Point2d.create(0, 0), Point2d.create(1, 0), Point2d.create(1, 1), Point2d.create(0, 1)];
    polyfaceBuilder.addQuadFacet(points, uvParams);
    const polyface = polyfaceBuilder.claimPolyface(false);

    builder.addPolyface(polyface, true);
    context.addDecorationFromBuilder(builder);
  }

  private loadGround(): void {
    assert(undefined === this._ground);
    const aboveParams = this.createGroundParams(true);
    const belowParams = this.createGroundParams(false);
    if (aboveParams && belowParams)
      this._ground = { aboveParams, belowParams };
  }

  private createGroundParams(above: boolean): GraphicParams | undefined {
    // Create a gradient texture.
    const ground = this._environment.ground;
    const values = [0, 0.25, 0.5];
    const color = above ? ground.aboveColor : ground.belowColor;
    const alpha = above ? 0x80 : 0x85;
    const groundColors = [color.withTransparency(0xff), color, color];
    groundColors[1] = groundColors[2] = color.withTransparency(alpha);

    const gradient = new Gradient.Symb();
    gradient.mode = Gradient.Mode.Spherical;
    gradient.keys = [{ color: groundColors[0], value: values[0] }, { color: groundColors[1], value: values[1] }, { color: groundColors[2], value: values[2] }];
    const texture = IModelApp.renderSystem.getGradientTexture(gradient, this._view.iModel);
    if (!texture)
      return undefined;

    // Create a material using the gradient texture
    const material = IModelApp.renderSystem.createRenderMaterial({
      diffuse: { color: ColorDef.white, weight: 0 },
      textureMapping: {
        texture,
        transform: new TextureMapping.Trans2x3(0, 1, 0, 1, 0, 0),
      },
    });

    if (!material)
      return undefined;

    // Create GraphicParams using the material.
    const params = new GraphicParams();
    params.lineColor = gradient.keys[0].color;
    params.fillColor = ColorDef.white;  // Fill should be set to opaque white for gradient texture...
    params.material = material;

    return params;
  }

  private loadSkyBox(): void {
    const loader = this.loadSkyBoxParams();
    if (undefined === loader.preload) {
      this.setSky(loader.load());
      return;
    }

    const promise = loader.preload;
    this._sky.promise = promise;
    loader.preload.then((loaded) => {
      if (promise === this._sky.promise)
        this.setSky(loaded ? loader.load() : undefined);
    }).catch(() => {
      if (promise === this._sky.promise)
        this.setSky(undefined);
    });
  }

  private setSky(params: RenderSkyBoxParams | undefined): void {
    this._sky.promise = undefined;
    this._sky.params = params ?? this.createSkyGradientParams();
    this._onLoaded();
  }

  private loadSkyBoxParams(): SkyBoxParamsLoader {
    let load: (() => RenderSkyBoxParams | undefined);
    let preload: Promise<boolean> | undefined;

    const sky = this._environment.sky;
    if (sky instanceof SkyCube) {
      const key = this.createCubeImageKey(sky);
      load = () => {
        const texture = IModelApp.renderSystem.findTexture(key, this._view.iModel);
        return texture ? { type: "cube", texture } : undefined;
      };

      if (!IModelApp.renderSystem.findTexture(key, this._view.iModel)) {
        // Some faces may use the same image. Only request each image once.
        const promises = [];
        const specs = new Set<string>([sky.images.front, sky.images.back, sky.images.left, sky.images.right, sky.images.top, sky.images.bottom]);
        for (const spec of specs)
          promises.push(this.imageFromSpec(spec));

        preload = Promise.all(promises).then((images) => {
          const idToImage = new Map<TextureImageSpec, HTMLImageElement>();
          let index = 0;
          for (const spec of specs) {
            const image = images[index++];
            if (!image)
              return false;
            else
              idToImage.set(spec, image);
          }

          // eslint-disable-next-line deprecation/deprecation
          const params = new RenderTexture.Params(key, RenderTexture.Type.SkyBox);
          const txImgs = [
            idToImage.get(sky.images.front)!, idToImage.get(sky.images.back)!, idToImage.get(sky.images.top)!,
            idToImage.get(sky.images.bottom)!, idToImage.get(sky.images.right)!, idToImage.get(sky.images.left)!,
          ];

          return undefined !== IModelApp.renderSystem.createTextureFromCubeImages(txImgs[0], txImgs[1], txImgs[2], txImgs[3], txImgs[4], txImgs[5], this._view.iModel, params);
        });
      }
    } else if (sky instanceof SkySphere) {
      load = () => {
        const texture = IModelApp.renderSystem.findTexture(sky.image, this._view.iModel);
        return texture ? {
          type: "sphere",
          texture,
          rotation: 0,
          zOffset: this._view.iModel.globalOrigin.z,
        } : undefined;
      };

      if (!IModelApp.renderSystem.findTexture(sky.image, this._view.iModel)) {
        preload = this.imageFromSpec(sky.image).then((image) => {
          if (!image)
            return false;

          return undefined !== IModelApp.renderSystem.createTexture({
            image: { source: image },
            ownership: { iModel: this._view.iModel, key: sky.image },
          });
        });
      }
    } else {
      load = () => this.createSkyGradientParams();
    }

    return { load, preload };
  }

  private createCubeImageKey(sky: SkyCube): string {
    const i = sky.images;
    return `skycube:${i.front}:${i.back}:${i.left}:${i.right}:${i.top}:${i.bottom}`;
  }

  private createSkyGradientParams(): RenderSkyBoxParams {
    return {
      type: "gradient",
      gradient: this._environment.sky.gradient,
      zOffset: this._view.iModel.globalOrigin.z,
    };
  }

  private async imageFromSpec(spec: TextureImageSpec): Promise<HTMLImageElement | undefined> {
    if (Id64.isValidId64(spec))
      return (await IModelApp.renderSystem.loadTextureImage(spec, this._view.iModel))?.image;

    return tryImageElementFromUrl(spec);
  }
}
