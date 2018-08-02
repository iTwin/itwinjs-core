/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Views */
import { Light, LightType, ViewFlags, HiddenLine, ColorDefProps, ColorDef, ColorByName, ElementProps, RenderTexture, RenderMaterial, Gradient, SubCategoryOverride } from "@bentley/imodeljs-common";
import { ElementState } from "./EntityState";
import { IModelConnection } from "./IModelConnection";
import { JsonUtils, Id64Props, Id64 } from "@bentley/bentleyjs-core";
import { Vector3d } from "@bentley/geometry-core";
import { RenderSystem } from "./rendering";

/** A DisplayStyle defines the parameters for 'styling' the contents of a View */
export abstract class DisplayStyleState extends ElementState {
  private _viewFlags: ViewFlags;
  private _background: ColorDef;
  private _monochrome: ColorDef;
  private _subCategoryOverrides: Map<string, SubCategoryOverride> = new Map<string, SubCategoryOverride>();

  constructor(props: ElementProps, iModel: IModelConnection) {
    super(props, iModel);
    this._viewFlags = ViewFlags.fromJSON(this.getStyle("viewflags"));
    this._background = ColorDef.fromJSON(this.getStyle("backgroundColor"));
    const monoName = "monochromeColor"; // because tslint: "object access via string literals is disallowed"...
    const monoJson = this.getStyles()[monoName];
    this._monochrome = undefined !== monoJson ? ColorDef.fromJSON(monoJson) : ColorDef.white.clone();
  }

  public equalState(other: DisplayStyleState): boolean {
    return JSON.stringify(this.getStyles()) === JSON.stringify(other.getStyles());
  }

  /** Get the name of this DisplayStyle */
  public get name(): string { return this.code.getValue(); }

  public get viewFlags(): ViewFlags { return this._viewFlags; }
  public set viewFlags(flags: ViewFlags) {
    flags.clone(this._viewFlags);
    this.setStyle("viewflags", flags);
  }

  public getStyles(): any { const p = this.jsonProperties as any; if (!p.styles) p.styles = new Object(); return p.styles; }
  public getStyle(name: string): any {
    const style: object = this.getStyles()[name];
    return style ? style : {};
  }
  /** change the value of a style on this DisplayStyle */
  public setStyle(name: string, value: any): void { this.getStyles()[name] = value; }

  /** Remove a Style from this DisplayStyle. */
  public removeStyle(name: string) { delete this.getStyles()[name]; }

  /** Get the background color for this DisplayStyle */
  public get backgroundColor(): ColorDef { return this._background; }
  public set backgroundColor(val: ColorDef) { this._background = val; this.setStyle("backgroundColor", val); }

  public getMonochromeColor(): ColorDef { return this._monochrome; }
  public setMonochromeColor(val: ColorDef): void { this._monochrome = val; this.setStyle("monochromeColor", val); }

  public is3d(): this is DisplayStyle3dState { return this instanceof DisplayStyle3dState; }

  public overrideSubCategory(id: Id64, ovr: SubCategoryOverride) {
    if (id.isValid)
      this._subCategoryOverrides.set(id.value, ovr);
  }

  public dropSubCategoryOverride(id: Id64) {
    this._subCategoryOverrides.delete(id.value);
  }

  public get hasSubCategoryOverride() { return this._subCategoryOverrides.entries.length > 0; }

  public getSubCategoryOverride(id: Id64 | string): SubCategoryOverride | undefined {
    return this._subCategoryOverrides.get(id.toString());
  }
}

/** A DisplayStyle for 2d views */
export class DisplayStyle2dState extends DisplayStyleState {
  constructor(props: ElementProps, iModel: IModelConnection) { super(props, iModel); }
}

export interface GroundPlaneProps {
  display?: boolean;
  elevation?: number;
  aboveColor?: ColorDefProps;
  belowColor?: ColorDefProps;
}

/** A circle drawn at a Z elevation, whose diameter is the the XY diagonal of the project extents */
export class GroundPlane implements GroundPlaneProps {
  public display: boolean = false;
  public elevation: number = 0.0;  // the Z height to draw the ground plane
  public aboveColor: ColorDef;     // the color to draw the ground plane if the view shows the ground from above
  public belowColor: ColorDef;     // the color to draw the ground plane if the view shows the ground from below
  private aboveSymb?: Gradient.Symb; // symbology for ground plane when view is from above
  private belowSymb?: Gradient.Symb; // symbology for ground plane when view is from below

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
   */
  public getGroundPlaneTextureSymb(aboveGround: boolean, groundColors?: ColorDef[]): Gradient.Symb {
    if (aboveGround) {
      if (this.aboveSymb) {
        return this.aboveSymb;
      }
    } else {
      if (this.belowSymb)
        return this.belowSymb;
    }

    const values = [0, .25, .5];   // gradient goes from edge of rectangle (0.0) to center (1.0)...
    const color = aboveGround ? this.aboveColor : this.belowColor;
    groundColors = groundColors !== undefined ? groundColors : [];
    groundColors.length = 0;
    groundColors.push(color.clone());
    groundColors.push(color.clone());
    groundColors.push(color.clone());

    const alpha = aboveGround ? 0x80 : 0x85;
    groundColors[0].setTransparency(0xff);
    groundColors[1].setTransparency(alpha);
    groundColors[2].setTransparency(alpha);

    // Get the possibly cached gradient from the system, specific to whether or not we want ground from above or below.
    const gradient = new Gradient.Symb();
    gradient.mode = Gradient.Mode.Spherical;
    gradient.keys = [{ color: groundColors[0], value: values[0] }, { color: groundColors[1], value: values[1] }, { color: groundColors[2], value: values[2] }];

    // Store the gradient for possible future use
    if (aboveGround)
      this.aboveSymb = gradient;
    else
      this.belowSymb = gradient;

    return gradient;
  }
}

export const enum SkyBoxImageType {
  None,
  Spherical,
  Cylindrical,
}

export interface SkyBoxImageProps {
  type?: SkyBoxImageType;
  texture?: Id64Props;
}

export interface SkyBoxProps {
  display?: boolean;
  twoColor?: boolean;
  groundExponent?: number;
  skyExponent?: number;
  groundColor?: ColorDefProps;
  zenithColor?: ColorDefProps;
  nadirColor?: ColorDefProps;
  skyColor?: ColorDefProps;
  image?: SkyBoxImageProps;
}

export interface EnvironmentProps {
  ground?: GroundPlaneProps;
  sky?: SkyBoxProps;
}

/** The SkyBox is an environment drawn in the background of spatial views to provide context. */
export abstract class SkyBox implements SkyBoxProps {
  public display: boolean = false;

  protected constructor(sky?: SkyBoxProps) {
    this.display = undefined !== sky && JsonUtils.asBool(sky.display, false);
  }

  public toJSON(): SkyBoxProps {
    return { display: this.display };
  }

  public static fromJSON(json?: SkyBoxProps): SkyBox {
    let imageType = SkyBoxImageType.None;
    if (undefined !== json && undefined !== json.image && undefined !== json.image.type)
      imageType = json.image.type;

    switch (imageType) {
      case SkyBoxImageType.Spherical:
        return new SkySphere(json!); // imageType obtained from json.image.type => json not undefined...
      case SkyBoxImageType.Cylindrical: // ###TODO...
      case SkyBoxImageType.None:
      default:
        return new SkyGradient(json);
    }
  }

  public abstract async loadParams(_system: RenderSystem, _iModel: IModelConnection): Promise<SkyBox.CreateParams | undefined>;
}

export namespace SkyBox {
  export class SphereParams {
    public constructor(public readonly texture: RenderTexture, public readonly rotation: number) { }
  }

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

export class SkySphere extends SkyBox {
  public textureId: Id64;

  public constructor(json: SkyBoxProps) {
    super(json);
    this.textureId = new Id64(undefined !== json.image ? json.image.texture : undefined);
  }

  public toJSON(): SkyBoxProps {
    const val = super.toJSON();
    val.image = {
      type: SkyBoxImageType.Spherical,
      texture: this.textureId.value,
    };
    return val;
  }

  public async loadParams(_system: RenderSystem, _iModel: IModelConnection): Promise<SkyBox.CreateParams | undefined> {
    return Promise.resolve(undefined); // ###TODO
  }
}

// ###TODO: export class SkyCube extends SkyBox { ... }

/** The skyBox, groundPlane, etc. for a 3d view  */
export class Environment implements EnvironmentProps {
  public readonly sky: SkyBox;
  public readonly ground: GroundPlane;
  public constructor(json?: EnvironmentProps) {
    this.sky = SkyBox.fromJSON(undefined !== json ? json.sky : undefined);
    this.ground = new GroundPlane(undefined !== json ? json.ground : undefined);
  }

  public toJSON(): EnvironmentProps {
    return {
      sky: this.sky.toJSON(),
      ground: this.ground, // ###TODO GroundPlane.toJSON missing...but lots of JSON inconsistencies associated with DisplayStyle...fix them all up later?
    };
  }
}

/** A DisplayStyle for 3d views */
export class DisplayStyle3dState extends DisplayStyleState {
  public skyboxMaterial: RenderMaterial | undefined;
  private _skyBoxParams?: SkyBox.CreateParams;
  private _skyBoxParamsLoaded?: boolean;
  public constructor(props: ElementProps, iModel: IModelConnection) { super(props, iModel); }
  public getHiddenLineParams(): HiddenLine.Params { return new HiddenLine.Params(this.getStyle("hline")); }
  public setHiddenLineParams(params: HiddenLine.Params) { this.setStyle("hline", params); }

  /** change one of the scene light specifications (Ambient, Flash, or Portrait) for this display style */
  public setSceneLight(light: Light) {
    if (!light.isValid())
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

  /** change the light specification and direction of the solar light for this display style */
  public setSolarLight(light: Light, direction: Vector3d) {
    const sceneLights = this.getStyle("sceneLights");
    if (light.lightType !== LightType.Solar || !light.isValid()) {
      delete sceneLights.sunDir;
    } else {
      sceneLights.sun = light;
      sceneLights.sunDir = direction;
    }
    this.setStyle("sceneLights", sceneLights);
  }

  public getEnvironment() { return new Environment(this.getStyle("environment")); }
  public setEnvironment(env: Environment) { this.setStyle("environment", env); }

  public setSceneBrightness(fstop: number): void { fstop = Math.max(-3.0, Math.min(fstop, 3.0)); this.getStyle("sceneLights").fstop = fstop; }
  public getSceneBrightness(): number { return JsonUtils.asDouble(this.getStyle("sceneLights").fstop, 0.0); }

  /** Attempts to create textures for the sky of the environment, and load it into the sky. Returns true on success, and false otherwise. */
  public loadSkyBoxParams(system: RenderSystem): SkyBox.CreateParams | undefined {
    if (undefined === this._skyBoxParams && undefined === this._skyBoxParamsLoaded) {
      this._skyBoxParamsLoaded = false;
      const skybox = this.getEnvironment().sky;
      skybox.loadParams(system, this.iModel).then((params?: SkyBox.CreateParams) => {
        this._skyBoxParams = params;
        this._skyBoxParamsLoaded = true;
        }).catch((_err) => this._skyBoxParamsLoaded = true);
    }

    return this._skyBoxParams;
  }
}
