/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Views */
import {
  ViewFlags,
  ColorDef,
  DisplayStyleProps,
  RenderTexture,
  RenderMaterial,
  SubCategoryOverride,
  SkyBoxProps,
  SkyBoxImageType,
  SkyCubeProps,
  EnvironmentProps,
  GroundPlane,
  DisplayStyleSettings,
  DisplayStyle3dSettings,
  BackgroundMapProps,
  ContextModelProps,
} from "@bentley/imodeljs-common";
import { ElementState } from "./EntityState";
import { IModelConnection } from "./IModelConnection";
import { JsonUtils, Id64, Id64String } from "@bentley/bentleyjs-core";
import { RenderSystem, TextureImage } from "./render/System";
import { BackgroundMapState } from "./tile/WebMercatorTileTree";
import { TileTreeModelState } from "./ModelState";
import { Plane3dByOriginAndUnitNormal } from "@bentley/geometry-core";
import { TileTree, TileTreeState } from "./tile/TileTree";
import { RealityModelTileTree } from "./tile/RealityModelTileTree";

class ContextModelState implements TileTreeModelState {
  protected _tilesetUrl: string;
  protected _name: string;
  protected _tileTreeState: TileTreeState;
  constructor(props: ContextModelProps, iModel: IModelConnection) {
    this._name = props.name ? props.name : "";
    this._tilesetUrl = props.tilesetUrl;
    this._tileTreeState = new TileTreeState(iModel, true, "");
  }
  public get tileTree(): TileTree | undefined { return this._tileTreeState.tileTree; }
  public get loadStatus(): TileTree.LoadStatus { return this._tileTreeState.loadStatus; }
  public loadTileTree(_asClassifier?: boolean, _classifierExpansion?: number): TileTree.LoadStatus {
    const tileTreeState = this._tileTreeState;
    if (TileTree.LoadStatus.NotLoaded !== tileTreeState.loadStatus)
      return tileTreeState.loadStatus;

    tileTreeState.loadStatus = TileTree.LoadStatus.Loading;

    RealityModelTileTree.loadRealityModelTileTree(this._tilesetUrl, undefined, tileTreeState);
    return tileTreeState.loadStatus;
  }
}
/** A DisplayStyle defines the parameters for 'styling' the contents of a [[ViewState]]
 * @note If the DisplayStyle is associated with a [[ViewState]] which is being rendered inside a [[Viewport]], modifying
 * the DisplayStyle directly will generally not result in immediately visible changes on the screen.
 * [[ViewState]] provides APIs which forward to the DisplayStyle API and also ensure the screen is updated promptly.
 */
export abstract class DisplayStyleState extends ElementState implements DisplayStyleProps {
  private _backgroundMap: BackgroundMapState;
  private _contextModels: ContextModelState[];

  public abstract get settings(): DisplayStyleSettings;

  constructor(props: DisplayStyleProps, iModel: IModelConnection) {
    super(props, iModel);
    const styles = this.jsonProperties.styles;
    const backgroundMap = undefined !== styles ? styles.backgroundMap : undefined;
    const mapProps = undefined !== backgroundMap ? backgroundMap : {};
    this._backgroundMap = new BackgroundMapState(mapProps, iModel);
    this._contextModels = [];

    /*  For testing...
    styles.contextModels = [];
    styles.contextModels.push({ tilesetUrl: "http://localhost:8080/ClarkIsland/74/TileRoot.json" })
    */

    if (styles && styles.contextModels)
      for (const contextModel of styles.contextModels)
        this._contextModels.push(new ContextModelState(contextModel, this.iModel));
  }

  /** @hidden */
  public setBackgroundMap(mapProps: BackgroundMapProps): void {
    if (!this.backgroundMap.equalsProps(mapProps)) {
      this._backgroundMap = new BackgroundMapState(mapProps, this.iModel);
      this.settings.backgroundMap = mapProps;
    }
  }
  /** @hidden */
  public forEachContextModel(func: (model: TileTreeModelState) => void): void {
    for (const contextModel of this._contextModels) { func(contextModel); }
  }
  public equalState(other: DisplayStyleState): boolean {
    return JSON.stringify(this.settings) === JSON.stringify(other.settings);
  }

  /** @hidden */
  public get backgroundMap() { return this._backgroundMap; }

  /** Get the name of this DisplayStyle */
  public get name(): string { return this.code.getValue(); }

  /** The ViewFlags associated with this style.
   * @note If this style is associated with a [[ViewState]] attached to a [[Viewport]], use [[ViewState.viewFlags]] to modify the ViewFlags to ensure
   * the changes are promptly visible on the screen.
   */
  public get viewFlags(): ViewFlags { return this.settings.viewFlags; }
  public set viewFlags(flags: ViewFlags) { this.settings.viewFlags = flags; }

  /** The background color for this DisplayStyle */
  public get backgroundColor(): ColorDef { return this.settings.backgroundColor; }
  public set backgroundColor(val: ColorDef) { this.settings.backgroundColor = val; }

  /** The color used to draw geometry in monochrome mode.
   * @see [[ViewFlags.monochrome]] for enabling monochrome mode.
   */
  public get monochromeColor(): ColorDef { return this.settings.monochromeColor; }
  public set monochromeColor(val: ColorDef) { this.settings.monochromeColor = val; }

  /** @hidden */
  public get backgroundMapPlane(): Plane3dByOriginAndUnitNormal | undefined { return this.viewFlags.backgroundMap ? this.backgroundMap.getPlane() : undefined; }

  public is3d(): this is DisplayStyle3dState { return this instanceof DisplayStyle3dState; }

  /** Customize the way geometry belonging to a [[SubCategory]] is drawn by this display style.
   * @param id The ID of the SubCategory whose appearance is to be overridden.
   * @param ovr The overrides to apply to the [[SubCategoryAppearance]].
   * @note If this style is associated with a [[ViewState]] attached to a [[Viewport]], use [[ViewState.overrideSubCategory]] to ensure
   * the changes are promptly visible on the screen.
   * @see [[dropSubCategoryOverride]]
   */
  public overrideSubCategory(id: Id64String, ovr: SubCategoryOverride) { this.settings.overrideSubCategory(id, ovr); }

  /** Remove any [[SubCategoryOverride]] applied to a [[SubCategoryAppearance]] by this style.
   * @param id The ID of the [[SubCategory]].
   * @note If this style is associated with a [[ViewState]] attached to a [[Viewport]], use [[ViewState.dropSubCategoryOverride]] to ensure
   * the changes are promptly visible on the screen.
   * @see [[overrideSubCategory]]
   */
  public dropSubCategoryOverride(id: Id64String) { this.settings.dropSubCategoryOverride(id); }

  /** Returns true if an [[SubCategoryOverride]s are defined by this style. */
  public get hasSubCategoryOverride() { return this.settings.hasSubCategoryOverride; }

  /** Obtain the overrides applied to a [[SubCategoryAppearance]] by this style.
   * @param id The ID of the [[SubCategory]].
   * @returns The corresponding SubCategoryOverride, or undefined if the SubCategory's appearance is not overridden.
   * @see [[overrideSubCategory]]
   */
  public getSubCategoryOverride(id: Id64String): SubCategoryOverride | undefined { return this.settings.getSubCategoryOverride(id); }
}

/** A DisplayStyle for 2d views */
export class DisplayStyle2dState extends DisplayStyleState {
  private readonly _settings: DisplayStyleSettings;

  public get settings(): DisplayStyleSettings { return this._settings; }

  constructor(props: DisplayStyleProps, iModel: IModelConnection) {
    super(props, iModel);
    this._settings = new DisplayStyleSettings(this.jsonProperties);
  }
}

/** The SkyBox is part of an [[Environment]] drawn in the background of spatial views to provide context.
 * Several types of skybox are supported:
 *  - A cube with a texture image mapped to each face;
 *  - A sphere with a single texture image mapped to its surface;
 *  - A sphere with a [[Gradient]] mapped to its surface.
 */
export abstract class SkyBox implements SkyBoxProps {
  /** Whether or not the skybox should be displayed. */
  public display: boolean = false;

  protected constructor(sky?: SkyBoxProps) {
    this.display = undefined !== sky && JsonUtils.asBool(sky.display, false);
  }

  public toJSON(): SkyBoxProps {
    return { display: this.display };
  }

  /** Instantiate a [[SkyBox]] from its JSON representation. */
  public static createFromJSON(json?: SkyBoxProps): SkyBox {
    let imageType = SkyBoxImageType.None;
    if (undefined !== json && undefined !== json.image && undefined !== json.image.type)
      imageType = json.image.type;

    let skybox: SkyBox | undefined;
    switch (imageType) {
      case SkyBoxImageType.Spherical:
        skybox = SkySphere.fromJSON(json!);
        break;
      case SkyBoxImageType.Cube:
        skybox = SkyCube.fromJSON(json!);
        break;
      case SkyBoxImageType.Cylindrical: // ###TODO...
        break;
    }

    return undefined !== skybox ? skybox : new SkyGradient(json);
  }

  /** @hidden */
  public abstract async loadParams(_system: RenderSystem, _iModel: IModelConnection): Promise<SkyBox.CreateParams | undefined>;
}

/** The SkyBox is part of an [[Environment]] drawn in the background of spatial views to provide context.
 * Several types of skybox are supported:
 *  - A cube with a texture image mapped to each face;
 *  - A sphere with a single texture image mapped to its surface;
 *  - A sphere with a [[Gradient]] mapped to its surface.
 */
export namespace SkyBox {
  /** @hidden */
  export class SphereParams {
    public constructor(public readonly texture: RenderTexture, public readonly rotation: number) { }
  }

  /** @hidden */
  export class CreateParams {
    public readonly gradient?: SkyGradient;
    public readonly sphere?: SphereParams;
    public readonly cube?: RenderTexture;
    public readonly zOffset: number;

    private constructor(zOffset: number, gradient?: SkyGradient, sphere?: SphereParams, cube?: RenderTexture) {
      this.gradient = gradient;
      this.sphere = sphere;
      this.cube = cube;
      this.zOffset = zOffset;
    }

    public static createForGradient(gradient: SkyGradient, zOffset: number) { return new CreateParams(zOffset, gradient); }
    public static createForSphere(sphere: SphereParams, zOffset: number) { return new CreateParams(zOffset, undefined, sphere); }
    public static createForCube(cube: RenderTexture) { return new CreateParams(0.0, undefined, undefined, cube); }
  }
}

/** ###TODO Document me... */
export class SkyGradient extends SkyBox {
  public readonly twoColor: boolean = false;
  public readonly zenithColor: ColorDef;         // the color of the zenith part of the sky gradient (shown when looking straight up.)
  public readonly nadirColor: ColorDef;          // the color of the nadir part of the ground gradient (shown when looking straight down.)
  public readonly groundColor: ColorDef;         // the color of the ground part of the ground gradient
  public readonly skyColor: ColorDef;            // the color of the sky part of the sky gradient
  public readonly groundExponent: number = 4.0;  // the cutoff between ground and nadir
  public readonly skyExponent: number = 4.0;     // the cutoff between sky and zenith

  public constructor(sky?: SkyBoxProps) {
    super(sky);

    sky = sky ? sky : {};
    this.twoColor = JsonUtils.asBool(sky.twoColor, false);
    this.groundExponent = JsonUtils.asDouble(sky.groundExponent, 4.0);
    this.skyExponent = JsonUtils.asDouble(sky.skyExponent, 4.0);
    this.groundColor = (undefined !== sky.groundColor) ? ColorDef.fromJSON(sky.groundColor) : ColorDef.from(120, 143, 125);
    this.zenithColor = (undefined !== sky.zenithColor) ? ColorDef.fromJSON(sky.zenithColor) : ColorDef.from(54, 117, 255);
    this.nadirColor = (undefined !== sky.nadirColor) ? ColorDef.fromJSON(sky.nadirColor) : ColorDef.from(40, 15, 0);
    this.skyColor = (undefined !== sky.skyColor) ? ColorDef.fromJSON(sky.skyColor) : ColorDef.from(143, 205, 255);
  }

  public toJSON(): SkyBoxProps {
    const val = super.toJSON();

    val.twoColor = this.twoColor ? true : undefined;
    val.groundExponent = this.groundExponent !== 4.0 ? this.groundExponent : undefined;
    val.skyExponent = this.skyExponent !== 4.0 ? this.skyExponent : undefined;

    val.groundColor = this.groundColor.toJSON();
    val.zenithColor = this.zenithColor.toJSON();
    val.nadirColor = this.nadirColor.toJSON();
    val.skyColor = this.skyColor.toJSON();

    return val;
  }

  public async loadParams(_system: RenderSystem, iModel: IModelConnection): Promise<SkyBox.CreateParams> {
    return Promise.resolve(SkyBox.CreateParams.createForGradient(this, iModel.globalOrigin.z));
  }
}

/** A [[SkyBox]] drawn as a sphere with an image mapped to its interior surface.
 * @see [[SkyBox.createFromJSON]]
 */
export class SkySphere extends SkyBox {
  /** The ID of the texture element which supplies the skybox image. */
  public textureId: Id64String;

  private constructor(textureId: Id64String, display?: boolean) {
    super({ display });
    this.textureId = textureId;
  }

  /** @hidden */
  public static fromJSON(json: SkyBoxProps): SkySphere | undefined {
    const textureId = Id64.fromJSON(undefined !== json.image ? json.image.texture : undefined);
    return undefined !== textureId && Id64.isValid(textureId) ? new SkySphere(textureId, json.display) : undefined;
  }

  public toJSON(): SkyBoxProps {
    const val = super.toJSON();
    val.image = {
      type: SkyBoxImageType.Spherical,
      texture: this.textureId,
    };
    return val;
  }

  /** @hidden */
  public async loadParams(system: RenderSystem, iModel: IModelConnection): Promise<SkyBox.CreateParams | undefined> {
    const texture = await system.loadTexture(this.textureId, iModel);
    if (undefined === texture)
      return undefined;

    const rotation = 0.0; // ###TODO: from where do we obtain rotation?
    return SkyBox.CreateParams.createForSphere(new SkyBox.SphereParams(texture, rotation), iModel.globalOrigin.z);
  }
}

/** A [[SkyBox]] drawn as a cube with an image mapped to each of its interior faces.
 * Each member specifies the ID of a texture element from which the image mapped to the corresponding face is obtained.
 * @see [[SkyBox.createFromJSON]].
 */
export class SkyCube extends SkyBox implements SkyCubeProps {
  public readonly front: Id64String;
  public readonly back: Id64String;
  public readonly top: Id64String;
  public readonly bottom: Id64String;
  public readonly right: Id64String;
  public readonly left: Id64String;

  private constructor(front: Id64String, back: Id64String, top: Id64String, bottom: Id64String, right: Id64String, left: Id64String, display?: boolean) {
    super({ display });

    this.front = front;
    this.back = back;
    this.top = top;
    this.bottom = bottom;
    this.right = right;
    this.left = left;
  }

  /** @hidden */
  public static fromJSON(skyboxJson: SkyBoxProps): SkyCube | undefined {
    const image = skyboxJson.image;
    const json = (undefined !== image && image.type === SkyBoxImageType.Cube ? image.textures : undefined) as SkyCubeProps;
    if (undefined === json)
      return undefined;

    return this.create(Id64.fromJSON(json.front), Id64.fromJSON(json.back), Id64.fromJSON(json.top), Id64.fromJSON(json.bottom), Id64.fromJSON(json.right), Id64.fromJSON(json.left), skyboxJson.display);
  }

  public toJSON(): SkyBoxProps {
    const val = super.toJSON();
    val.image = {
      type: SkyBoxImageType.Cube,
      textures: {
        front: this.front,
        back: this.back,
        top: this.top,
        bottom: this.bottom,
        right: this.right,
        left: this.left,
      },
    };
    return val;
  }

  /** @hidden */
  public static create(front: Id64String, back: Id64String, top: Id64String, bottom: Id64String, right: Id64String, left: Id64String, display?: boolean): SkyCube | undefined {
    if (!Id64.isValid(front) || !Id64.isValid(back) || !Id64.isValid(top) || !Id64.isValid(bottom) || !Id64.isValid(right) || !Id64.isValid(left))
      return undefined;
    else
      return new SkyCube(front, back, top, bottom, right, left, display);
  }

  /** @hidden */
  public async loadParams(system: RenderSystem, iModel: IModelConnection): Promise<SkyBox.CreateParams | undefined> {
    // ###TODO: We never cache the actual texture *images* used here to create a single cubemap texture...
    const textureIds = new Set<string>([this.front, this.back, this.top, this.bottom, this.right, this.left]);
    const promises = new Array<Promise<TextureImage | undefined>>();
    for (const textureId of textureIds)
      promises.push(system.loadTextureImage(textureId, iModel));

    try {
      const images = await Promise.all(promises);

      // ###TODO there's gotta be a simpler way to map the unique images back to their texture IDs...
      const idToImage = new Map<string, HTMLImageElement>();
      let index = 0;
      for (const textureId of textureIds) {
        const image = images[index++];
        if (undefined === image || undefined === image.image)
          return undefined;
        else
          idToImage.set(textureId, image.image);
      }

      const params = new RenderTexture.Params(undefined, RenderTexture.Type.SkyBox);
      const textureImages = [
        idToImage.get(this.front)!, idToImage.get(this.back)!, idToImage.get(this.top)!,
        idToImage.get(this.bottom)!, idToImage.get(this.right)!, idToImage.get(this.left)!,
      ];

      const texture = system.createTextureFromCubeImages(textureImages[0], textureImages[1], textureImages[2], textureImages[3], textureImages[4], textureImages[5], iModel, params);
      return undefined !== texture ? SkyBox.CreateParams.createForCube(texture) : undefined;
    } catch (_err) {
      return undefined;
    }
  }
}

/** Describes the [[SkyBox]] and [[GroundPlane]] associated with a [[DisplayStyle3dState]]. */
export class Environment implements EnvironmentProps {
  public readonly sky: SkyBox;
  public readonly ground: GroundPlane;

  public constructor(json?: EnvironmentProps) {
    this.sky = SkyBox.createFromJSON(undefined !== json ? json.sky : undefined);
    this.ground = new GroundPlane(undefined !== json ? json.ground : undefined);
  }

  public toJSON(): EnvironmentProps {
    return {
      sky: this.sky.toJSON(),
      ground: this.ground.toJSON(),
    };
  }
}

/** A {{DisplayStyle]] for 3d views */
export class DisplayStyle3dState extends DisplayStyleState {
  /** @hidden */
  public skyboxMaterial: RenderMaterial | undefined;
  private _skyBoxParams?: SkyBox.CreateParams;
  private _skyBoxParamsLoaded?: boolean;
  private _environment?: Environment;
  private _settings: DisplayStyle3dSettings;

  public get settings(): DisplayStyle3dSettings { return this._settings; }

  public constructor(props: DisplayStyleProps, iModel: IModelConnection) {
    super(props, iModel);
    this._settings = new DisplayStyle3dSettings(this.jsonProperties);
  }

  /** The [[SkyBox]] and [[GroundPlane]] settings for this style. */
  public get environment(): Environment {
    if (undefined === this._environment)
      this._environment = new Environment(this.settings.environment);

    return this._environment;
  }
  public set environment(env: Environment) {
    this.settings.environment = env.toJSON();
    this._environment = undefined;
  }

  /** Attempts to create textures for the sky of the environment, and load it into the sky. Returns true on success, and false otherwise.
   * @hidden
   */
  public loadSkyBoxParams(system: RenderSystem): SkyBox.CreateParams | undefined {
    if (undefined === this._skyBoxParams && undefined === this._skyBoxParamsLoaded) {
      this._skyBoxParamsLoaded = false;
      const skybox = this.environment.sky;
      skybox.loadParams(system, this.iModel).then((params?: SkyBox.CreateParams) => {
        this._skyBoxParams = params;
        this._skyBoxParamsLoaded = true;
      }).catch((_err) => this._skyBoxParamsLoaded = true);
    }

    return this._skyBoxParams;
  }
}
