/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Views */
import {
  Light,
  LightType,
  ViewFlags,
  HiddenLine,
  ColorDefProps,
  ColorDef,
  ColorByName,
  DisplayStyleProps,
  RenderTexture,
  RenderMaterial,
  Gradient,
  SubCategoryOverride,
} from "@bentley/imodeljs-common";
import { ElementState } from "./EntityState";
import { IModelConnection } from "./IModelConnection";
import { JsonUtils, Id64, Id64String } from "@bentley/bentleyjs-core";
import { Vector3d } from "@bentley/geometry-core";
import { RenderSystem, TextureImage } from "./render/System";
import { BackgroundMapState } from "./tile/WebMercatorTileTree";
import { Plane3dByOriginAndUnitNormal } from "@bentley/geometry-core";

/** A DisplayStyle defines the parameters for 'styling' the contents of a [[ViewState]]
 * @note If the DisplayStyle is associated with a [[ViewState]] which is being rendered inside a [[Viewport]], modifying
 * the DisplayStyle directly will generally not result in immediately visible changes on the screen.
 * [[ViewState]] provides APIs which forward to the DisplayStyle API and also ensure the screen is updated promptly.
 */
export abstract class DisplayStyleState extends ElementState implements DisplayStyleProps {
  private readonly _viewFlags: ViewFlags;
  private readonly _background: ColorDef;
  private readonly _monochrome: ColorDef;
  private readonly _subCategoryOverrides: Map<string, SubCategoryOverride> = new Map<string, SubCategoryOverride>();
  private _backgroundMap: BackgroundMapState;

  constructor(props: DisplayStyleProps, iModel: IModelConnection) {
    super(props, iModel);
    this._viewFlags = ViewFlags.fromJSON(this.getStyle("viewflags"));
    this._background = ColorDef.fromJSON(this.getStyle("backgroundColor"));
    const monoName = "monochromeColor"; // because tslint: "object access via string literals is disallowed"...
    const monoJson = this.styles[monoName];
    this._monochrome = undefined !== monoJson ? ColorDef.fromJSON(monoJson) : ColorDef.white.clone();
    this._backgroundMap = new BackgroundMapState(this.getStyle("backgroundMap"), iModel);

    // Read subcategory overrides.
    // ###TODO: overrideSubCategory() and dropSubCategoryOverride() should be updating this element's JSON properties...
    // NB: Not using this.getStyle() because it inserts the style as an object if not found, but this style is supposed to be an array...
    const jsonProps = JsonUtils.asObject(props.jsonProperties);
    const styles = undefined !== jsonProps ? JsonUtils.asObject(jsonProps.styles) : undefined;
    const ovrsArray = undefined !== styles ? JsonUtils.asArray(styles.subCategoryOvr) : undefined;
    if (undefined !== ovrsArray) {
      for (const ovrJson of ovrsArray) {
        const subCatId = Id64.fromJSON(ovrJson.subCategory);
        if (Id64.isValid(subCatId)) {
          const subCatOvr = SubCategoryOverride.fromJSON(ovrJson);
          if (subCatOvr.anyOverridden)
            this.overrideSubCategory(subCatId, subCatOvr);
        }
      }
    }
  }

  /** @hidden */
  public syncBackgroundMapState() {
    this._backgroundMap = new BackgroundMapState(this.getStyle("backgroundMap"), this.iModel);
  }

  public equalState(other: DisplayStyleState): boolean {
    return JSON.stringify(this.styles) === JSON.stringify(other.styles);
  }

  /** @hidden */
  public get backgroundMap() { return this._backgroundMap; }

  /** Get the name of this DisplayStyle */
  public get name(): string { return this.code.getValue(); }

  /** The ViewFlags associated with this style.
   * @note If this style is associated with a [[ViewState]] attached to a [[Viewport]], use [[ViewState.viewFlags]] to modify the ViewFlags to ensure
   * the changes are promptly visible on the screen.
   */
  public get viewFlags(): ViewFlags { return this._viewFlags; }
  public set viewFlags(flags: ViewFlags) {
    flags.clone(this._viewFlags);
    this.setStyle("viewflags", flags);
  }

  /** @hidden */
  public get styles(): any {
    const p = this.jsonProperties as any;
    if (undefined === p.styles)
      p.styles = new Object();

    return p.styles;
  }

  /** @hidden */
  public getStyle(name: string): any {
    const style: object = this.styles[name];
    return style ? style : {};
  }
  /** @hidden */
  public setStyle(name: string, value: any): void { this.styles[name] = value; }
  /** @hidden */
  public removeStyle(name: string) { delete this.styles[name]; }

  /** The background color for this DisplayStyle */
  public get backgroundColor(): ColorDef { return this._background; }
  public set backgroundColor(val: ColorDef) { this._background.setFrom(val); this.setStyle("backgroundColor", val); }

  /** The color used to draw geometry in monochrome mode.
   * @see [[ViewFlags.monochrome]] for enabling monochrome mode.
   */
  public get monochromeColor(): ColorDef { return this._monochrome; }
  public set monochromeColor(val: ColorDef) { this._monochrome.setFrom(val); this.setStyle("monochromeColor", val); }

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
  public overrideSubCategory(id: Id64String, ovr: SubCategoryOverride) {
    this._subCategoryOverrides.set(id.toString(), ovr);
  }

  /** Remove any [[SubCategoryOverride]] applied to a [[SubCategoryAppearance]] by this style.
   * @param id The ID of the [[SubCategory]].
   * @note If this style is associated with a [[ViewState]] attached to a [[Viewport]], use [[ViewState.dropSubCategoryOverride]] to ensure
   * the changes are promptly visible on the screen.
   * @see [[overrideSubCategory]]
   */
  public dropSubCategoryOverride(id: Id64String) {
    this._subCategoryOverrides.delete(id.toString());
  }

  /** Returns true if an [[SubCategoryOverride]s are defined by this style. */
  public get hasSubCategoryOverride() { return this._subCategoryOverrides.entries.length > 0; }

  /** Obtain the overrides applied to a [[SubCategoryAppearance]] by this style.
   * @param id The ID of the [[SubCategory]].
   * @returns The corresponding SubCategoryOverride, or undefined if the SubCategory's appearance is not overridden.
   * @see [[overrideSubCategory]]
   */
  public getSubCategoryOverride(id: Id64String): SubCategoryOverride | undefined {
    return this._subCategoryOverrides.get(id.toString());
  }
}

/** A DisplayStyle for 2d views */
export class DisplayStyle2dState extends DisplayStyleState {
  constructor(props: DisplayStyleProps, iModel: IModelConnection) { super(props, iModel); }
}

/** JSON representation of a [[GroundPlane]]. */
export interface GroundPlaneProps {
  /** Whether the ground plane should be displayed. Defaults to false. */
  display?: boolean;
  /** The Z height at which to draw the ground plane. */
  elevation?: number;
  /** The color in which to draw the ground plane when viewed from above. */
  aboveColor?: ColorDefProps;
  /** The color in which to draw the ground plane when viewed from below. */
  belowColor?: ColorDefProps;
}

/** A circle drawn at a Z elevation, whose diameter is the the XY diagonal of the project extents, used to represent the ground as a reference point within a spatial view. */
export class GroundPlane implements GroundPlaneProps {
  /** Whether the ground plane should be displayed. */
  public display: boolean = false;
  /** The Z height at which to draw the plane. */
  public elevation: number = 0.0;
  /** The color in which to draw the ground plane when viewed from above. */
  public aboveColor: ColorDef;
  /** The color in which to draw the ground plane when viewed from below. */
  public belowColor: ColorDef;
  private _aboveSymb?: Gradient.Symb;
  private _belowSymb?: Gradient.Symb;

  public constructor(ground?: GroundPlaneProps) {
    ground = ground ? ground : {};
    this.display = JsonUtils.asBool(ground.display, false);
    this.elevation = JsonUtils.asDouble(ground.elevation, -.01);
    this.aboveColor = (undefined !== ground.aboveColor) ? ColorDef.fromJSON(ground.aboveColor) : new ColorDef(ColorByName.darkGreen);
    this.belowColor = (undefined !== ground.belowColor) ? ColorDef.fromJSON(ground.belowColor) : new ColorDef(ColorByName.darkBrown);
  }

  /**
   * Returns and locally stores gradient symbology for the ground plane texture depending on whether we are looking from above or below.
   * Will store the ground colors used in the optional ColorDef array provided.
   * @hidden
   */
  public getGroundPlaneGradient(aboveGround: boolean): Gradient.Symb {
    let gradient = aboveGround ? this._aboveSymb : this._belowSymb;
    if (undefined !== gradient)
      return gradient;

    const values = [0, .25, .5];   // gradient goes from edge of rectangle (0.0) to center (1.0)...
    const color = aboveGround ? this.aboveColor : this.belowColor;
    const alpha = aboveGround ? 0x80 : 0x85;
    const groundColors = [color.clone(), color.clone(), color.clone()];
    groundColors[0].setTransparency(0xff);
    groundColors[1].setTransparency(alpha);
    groundColors[2].setTransparency(alpha);

    // Get the possibly cached gradient from the system, specific to whether or not we want ground from above or below.
    gradient = new Gradient.Symb();
    gradient.mode = Gradient.Mode.Spherical;
    gradient.keys = [{ color: groundColors[0], value: values[0] }, { color: groundColors[1], value: values[1] }, { color: groundColors[2], value: values[2] }];

    // Store the gradient for possible future use
    if (aboveGround)
      this._aboveSymb = gradient;
    else
      this._belowSymb = gradient;

    return gradient;
  }
}

/** Enumerates the supported types of [[SkyBox]] images. */
export const enum SkyBoxImageType {
  None,
  /** A single image mapped to the surface of a sphere. @see [[SkySphere]] */
  Spherical,
  /** 6 images mapped to the faces of a cube. @see [[SkyCube]] */
  Cube,
  /** @hidden not yet supported */
  Cylindrical,
}

/** JSON representation of a set of images used by a [[SkyCube]]. Each property specifies the element ID of a texture associated with one face of the cube. */
export interface SkyCubeProps {
  front?: Id64String;
  back?: Id64String;
  top?: Id64String;
  bottom?: Id64String;
  right?: Id64String;
  left?: Id64String;
}

/** JSON representation of an image or images used by a [[SkySphere]] or [[SkyCube]]. */
export interface SkyBoxImageProps {
  /** The type of skybox image. */
  type?: SkyBoxImageType;
  /** For [[SkyBoxImageType.Spherical]], the element ID of the texture to be drawn as the "sky". */
  texture?: Id64String;
  /** For [[SkyBoxImageType.Cube]], the IDs of the texture elements drawn on each face of the cube. */
  textures?: SkyCubeProps;
}

/** JSON representation of a [[SkyBox]]. */
export interface SkyBoxProps {
  /** Whether or not the skybox should be displayed. Defaults to false. */
  display?: boolean;
  /** @hidden ###TODO Figure out how this is used... */
  twoColor?: boolean;
  /** @hidden ###TODO Figure out how this is used... */
  groundExponent?: number;
  /** @hidden ###TODO Figure out how this is used... */
  skyExponent?: number;
  /** For a [[SkyGradient]], the color of the ground. */
  groundColor?: ColorDefProps;
  /** @hidden ###TODO Figure out how this is used... */
  zenithColor?: ColorDefProps;
  /** @hidden ###TODO Figure out how this is used... */
  nadirColor?: ColorDefProps;
  /** For a [[SkyGradient]], the color of the sky. */
  skyColor?: ColorDefProps;
  /** For a [[SkySphere]] or [[SkyCube]], the skybox image(s). */
  image?: SkyBoxImageProps;
}

/** JSON representation of the environment setup of a [[DisplayStyle3dState]]. */
export interface EnvironmentProps {
  ground?: GroundPlaneProps;
  sky?: SkyBoxProps;
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
      ground: this.ground, // ###TODO GroundPlane.toJSON missing...but lots of JSON inconsistencies associated with DisplayStyle...fix them all up later?
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

  public constructor(props: DisplayStyleProps, iModel: IModelConnection) { super(props, iModel); }

  public getHiddenLineParams(): HiddenLine.Settings { return HiddenLine.Settings.fromJSON(this.getStyle("hline")); }
  public setHiddenLineParams(params: HiddenLine.Settings) { this.setStyle("hline", params.toJSON()); }

  /** change one of the scene light specifications (Ambient, Flash, or Portrait) for this display style
   * @hidden
   */
  public setSceneLight(light: Light) {
    if (!light.isValid)
      return;

    const sceneLights = this.getStyle("sceneLights");
    switch (light.lightType) {
      case LightType.Ambient:
        sceneLights.ambient = light;
        break;

      case LightType.Flash:
        sceneLights.flash = light;
        break;

      case LightType.Portrait:
        sceneLights.portrait = light;
        break;
    }
    this.setStyle("sceneLights", sceneLights);
  }

  /** change the light specification and direction of the solar light for this display style
   * @hidden
   */
  public setSolarLight(light: Light, direction: Vector3d) {
    const sceneLights = this.getStyle("sceneLights");
    if (light.lightType !== LightType.Solar || !light.isValid) {
      delete sceneLights.sunDir;
    } else {
      sceneLights.sun = light;
      sceneLights.sunDir = direction;
    }
    this.setStyle("sceneLights", sceneLights);
  }

  /** The [[SkyBox]] and [[GroundPlane]] settings for this style. */
  public get environment(): Environment {
    if (undefined === this._environment)
      this._environment = new Environment(this.getStyle("environment"));

    return this._environment;
  }
  public set environment(env: Environment) {
    this.setStyle("environment", env.toJSON());
    this._environment = undefined;
  }

  /** @hidden */
  public setSceneBrightness(fstop: number): void { fstop = Math.max(-3.0, Math.min(fstop, 3.0)); this.getStyle("sceneLights").fstop = fstop; }
  /** @hidden */
  public getSceneBrightness(): number { return JsonUtils.asDouble(this.getStyle("sceneLights").fstop, 0.0); }

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
