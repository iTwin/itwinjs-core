/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { assert, Id64} from "@itwin/core-bentley";
import { Point2d, Point3d, PolyfaceBuilder, StrokeOptions } from "@itwin/core-geometry";
import {
  ColorDef, Environment, Gradient, GraphicParams, RenderMaterial, RenderTexture, SkyCube, SkySphere, TextureImageSpec, TextureMapping,
} from "@itwin/core-common";
import { IModelApp } from "./IModelApp";
import { ViewState3d } from "./ViewState";
import { DecorateContext } from "./ViewContext";
import { tryImageElementFromUrl } from "./ImageUtil";
import { GraphicType } from "./render/GraphicBuilder";
import { RenderSkyBoxParams } from "./render/RenderSystem";

/** @internal */
export interface GroundPlaneDecorations {
  readonly aboveParams: GraphicParams;
  readonly belowParams: GraphicParams;
}

/** @internal */
export interface SkyBoxDecorations {
  params?: RenderSkyBoxParams | undefined;
  promise?: Promise<RenderSkyBoxParams | undefined>;
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

    this._sky = { };
    this.loadSky();
    if (this._environment.displayGround)
      this.loadGround();
  }

  public dispose(): void {
    this._ground = undefined;

    this._sky.promise = this._sky.params = undefined;

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
      this.loadSky();
  }

  public decorate(context: DecorateContext): void {
    const env = this._environment;
    if (env.displaySky && this._sky.params) {
      const sky = IModelApp.renderSystem.createSkyBox(this._sky.params);
      if (sky)
        context.setSkyBox(sky);
    }

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
    const values = [0, 0.25, 0.5 ];
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
    const matParams = new RenderMaterial.Params();
    matParams.diffuseColor = ColorDef.white;
    matParams.shadows = false;
    matParams.ambient = 1;
    matParams.diffuse = 0;

    const mapParams = new TextureMapping.Params();
    const transform = new TextureMapping.Trans2x3(0, 1, 0, 1, 0, 0);
    mapParams.textureMatrix = transform;
    matParams.textureMapping = new TextureMapping(texture, mapParams);
    const material = IModelApp.renderSystem.createMaterial(matParams, this._view.iModel);
    if (!material)
      return undefined;

    // Create GraphicParams using the material.
    const params = new GraphicParams();
    params.lineColor = gradient.keys[0].color;
    params.fillColor = ColorDef.white;  // Fill should be set to opaque white for gradient texture...
    params.material = material;

    return params;
  }

  private loadSky(): void {
    const promise = this.loadSkyParams();
    this._sky.promise = promise;

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    promise.then((params) => {
      if (promise === this._sky.promise)
        this.setSky(params ?? this.createSkyGradientParams());
    });

    promise.catch(() => {
      if (this._sky.promise === promise)
        this.setSky(this.createSkyGradientParams());
    });
  }

  private setSky(params: RenderSkyBoxParams): void {
    this._sky.promise = undefined;
    this._sky.params = params;
    this._onLoaded();
  }

  private async loadSkyParams(): Promise<RenderSkyBoxParams | undefined> {
    const sky = this._environment.sky;
    if (sky instanceof SkyCube) {
      const key = this.createCubeImageKey(sky);
      const existingTexture = IModelApp.renderSystem.findTexture(key, this._view.iModel);
      if (existingTexture)
        return { type: "cube", texture: existingTexture };

      // Some faces may use the same image. Only request each image once.
      const specs = new Set<string>([sky.images.front, sky.images.back, sky.images.left, sky.images.right, sky.images.top, sky.images.bottom]);
      const promises = [];
      for (const spec of specs)
        promises.push(this.imageFromSpec(spec));

      return Promise.all(promises).then((images) => {
        const idToImage = new Map<TextureImageSpec, HTMLImageElement>();
        let index = 0;
        for (const spec of specs) {
          const image = images[index++];
          if (!image)
            return undefined;
          else
            idToImage.set(spec, image);
        }

        // eslint-disable-next-line deprecation/deprecation
        const params = new RenderTexture.Params(key, RenderTexture.Type.SkyBox);
        const txImgs = [
          idToImage.get(sky.images.front)!, idToImage.get(sky.images.back)!, idToImage.get(sky.images.top)!,
          idToImage.get(sky.images.bottom)!, idToImage.get(sky.images.right)!, idToImage.get(sky.images.left)!,
        ];

        const texture = IModelApp.renderSystem.createTextureFromCubeImages(txImgs[0], txImgs[1], txImgs[2], txImgs[3], txImgs[4], txImgs[5], this._view.iModel, params);
        return texture ? { type: "cube", texture } : undefined;
      });
    } else if (sky instanceof SkySphere) {
      const rotation = 0; // ###TODO where is this supposed to come from?
      let texture = IModelApp.renderSystem.findTexture(sky.image, this._view.iModel);
      if (!texture) {
        const image = await this.imageFromSpec(sky.image);
        if (image) {
          texture = IModelApp.renderSystem.createTexture({
            image: { source: image },
            ownership: { iModel: this._view.iModel, key: sky.image },
          });
        }
      }

      if (!texture)
        return undefined;

      return { type: "sphere", texture, rotation, zOffset: this._view.iModel.globalOrigin.z };
    } else {
      return this.createSkyGradientParams();
    }
  }

  private createCubeImageKey(sky: SkyCube): string {
    const i = sky.images;
    return `skycube:${i.front}:${i.back}:${i.left}:${i.right}:${i.top}:${i.bottom}`;
  }

  private createSkyGradientParams(): RenderSkyBoxParams {
    return { type: "gradient", gradient: this._environment.sky.gradient, zOffset: this._view.iModel.globalOrigin.z };
  }

  private async imageFromSpec(spec: TextureImageSpec): Promise<HTMLImageElement | undefined> {
    if (Id64.isValidId64(spec))
      return (await IModelApp.renderSystem.loadTextureImage(spec, this._view.iModel))?.image;

    return tryImageElementFromUrl(spec);
  }
}
