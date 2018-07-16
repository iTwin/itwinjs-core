/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Views */
import { Light, LightType, ViewFlags, HiddenLine, ColorDef, ColorByName, ElementProps, RenderTexture, ImageBuffer, ImageBufferFormat, RenderMaterial, TextureMapping, Gradient, SubCategoryOverride } from "@bentley/imodeljs-common";
import { ElementState } from "./EntityState";
import { IModelConnection } from "./IModelConnection";
import { JsonUtils, Id64 } from "@bentley/bentleyjs-core";
import { Vector3d } from "@bentley/geometry-core";
import { RenderSystem } from "./rendering";
import { SkyBoxCreateParams } from "./render/System";

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

/** A circle drawn at a Z elevation, whose diameter is the the XY diagonal of the project extents */
export class GroundPlane {
  public display: boolean = false;
  public elevation: number = 0.0;  // the Z height to draw the ground plane
  public aboveColor: ColorDef;     // the color to draw the ground plane if the view shows the ground from above
  public belowColor: ColorDef;     // the color to draw the ground plane if the view shows the ground from below
  private aboveSymb?: Gradient.Symb; // symbology for ground plane when view is from above
  private belowSymb?: Gradient.Symb; // symbology for ground plane when view is from below

  public constructor(ground: any) {
    ground = ground ? ground : {};
    this.display = JsonUtils.asBool(ground.display, false);
    this.elevation = JsonUtils.asDouble(ground.elevation, -.01);
    this.aboveColor = ground.aboveColor ? ColorDef.fromJSON(ground.aboveColor) : new ColorDef(ColorByName.darkGreen);
    this.belowColor = ground.belowColor ? ColorDef.fromJSON(ground.belowColor) : new ColorDef(ColorByName.darkBrown);
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

/** The SkyBox is a grid drawn in the background of spatial views to provide context. */
export class SkyBox {
  public display: boolean = false;
  public twoColor: boolean = false;
  public jpegFile: string;              // the name of a jpeg file with a spherical skybox
  public zenithColor: ColorDef;         // if no jpeg file, the color of the zenith part of the sky gradient (shown when looking straight up.)
  public nadirColor: ColorDef;          // if no jpeg file, the color of the nadir part of the ground gradient (shown when looking straight down.)
  public groundColor: ColorDef;         // if no jpeg file, the color of the ground part of the ground gradient
  public skyColor: ColorDef;            // if no jpeg file, the color of the sky part of the sky gradient
  public groundExponent: number = 4.0;  // if no jpeg file, the cutoff between ground and nadir
  public skyExponent: number = 4.0;     // if no jpeg file, the cutoff between sky and zenith

  public constructor(sky: any) {
    sky = sky ? sky : {};
    this.display = JsonUtils.asBool(sky.display, false);
    this.twoColor = JsonUtils.asBool(sky.twoColor, false);
    this.jpegFile = JsonUtils.asString(sky.file);
    this.groundExponent = JsonUtils.asDouble(sky.groundExponent, 4.0);
    this.skyExponent = JsonUtils.asDouble(sky.skyExponent, 4.0);
    this.groundColor = sky.groundColor ? ColorDef.fromJSON(sky.groundColor) : ColorDef.from(120, 143, 125);
    this.zenithColor = sky.zenithColor ? ColorDef.fromJSON(sky.zenithColor) : ColorDef.from(54, 117, 255);
    this.nadirColor = sky.nadirColor ? ColorDef.fromJSON(sky.nadirColor) : ColorDef.from(40, 15, 0);
    this.skyColor = sky.skyColor ? ColorDef.fromJSON(sky.skyColor) : ColorDef.from(143, 205, 255);
  }

  public toJSON(): any {
    const val: any = {};
    if (this.display)
      val.display = true;
    if (this.twoColor)
      val.twoColor = true;
    if (this.jpegFile !== "")
      val.jpegFile = this.jpegFile;
    if (this.groundExponent !== 4.0)
      val.groundExponent = this.groundExponent;
    if (this.skyExponent !== 4.0)
      val.skyExponent = this.groundExponent;

    val.groundColor = this.groundColor;
    val.zenithColor = this.zenithColor;
    val.nadirColor = this.nadirColor;
    val.skyColor = this.skyColor;
    return val;
  }
}

/** The skyBox, groundPlane, etc. for a 3d view  */
export class Environment {
  public readonly sky: SkyBox;
  public readonly ground: GroundPlane;
  public constructor(json: any) {
    this.sky = new SkyBox(json.sky);
    this.ground = new GroundPlane(json.ground);
  }
}

/** A DisplayStyle for 3d views */
export class DisplayStyle3dState extends DisplayStyleState {
  public skyboxMaterial: RenderMaterial | undefined;
  public skyBoxParams?: SkyBoxCreateParams;
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
  public loadSkyBoxParams(system: RenderSystem): boolean {
    if (this.skyBoxParams !== undefined)
      return true;  // skybox textures have already been loaded

    // const env = this.getEnvironment();
    // ###TODO - Use actual textures - just defining our own textures for now (different colors to distinguish them); can key off env.sky.jpegFile (needs more than one file though!)
    // ###TODO - If possible, use a cubemap texture to store all six images in one fell swoop (better use of GPU resources)

    const params = new RenderTexture.Params(undefined, false, false, false, true);

    const front = system.createTextureFromImageBuffer(
      ImageBuffer.create(new Uint8Array([
        0, 255, 255,
        0, 255, 255,
        0, 104, 10,
        0, 104, 10]), ImageBufferFormat.Rgb, 2)!, this.iModel, params)!;
    const back = system.createTextureFromImageBuffer(ImageBuffer.create(new Uint8Array([0, 255, 0]), ImageBufferFormat.Rgb, 1)!, this.iModel, params)!;
    const top = system.createTextureFromImageBuffer(ImageBuffer.create(new Uint8Array([0, 0, 255]), ImageBufferFormat.Rgb, 1)!, this.iModel, params)!;
    const bottom = system.createTextureFromImageBuffer(ImageBuffer.create(new Uint8Array([255, 255, 0]), ImageBufferFormat.Rgb, 1)!, this.iModel, params)!;
    const left = system.createTextureFromImageBuffer(ImageBuffer.create(new Uint8Array([0, 255, 255]), ImageBufferFormat.Rgb, 1)!, this.iModel, params)!;
    const right = system.createTextureFromImageBuffer(ImageBuffer.create(new Uint8Array([255, 0, 255]), ImageBufferFormat.Rgb, 1)!, this.iModel, params)!;

    this.skyBoxParams = SkyBoxCreateParams.createForTexturedCube(front, back, top, bottom, left, right);

    // ###TODO - if any image buffer or texture fails to load, bail out.
    return true;
  }

  /** Attempts to create a texture and material for the sky of the environment, and load it into the sky. Returns true on success, and false otherwise. */
  public loadSkyBoxMaterial(system: RenderSystem): boolean {
    if (this.skyboxMaterial !== undefined)
      return true;  // material has already been loaded

    const env = this.getEnvironment();
    let texture: RenderTexture | undefined;

    // ### TODO
    // if (env.sky.jpegFile.length !== 0)
    // Read jpeg data from file

    // we didn't get a jpeg sky, just create a gradient
    if (!texture) {
      const gradientPixelCount = 1024;
      const sizeOfColorDef = 4;

      const buffer = new Uint8Array(gradientPixelCount * sizeOfColorDef);
      let currentBufferIdx = 0;
      let color1: ColorDef;
      let color2: ColorDef;

      // set up the 4 color gradient
      for (let i = 0; i < gradientPixelCount; i++ , currentBufferIdx += 4) {
        let frac = i / gradientPixelCount;

        if (env.sky.twoColor) {
          color1 = env.sky.zenithColor;
          color2 = env.sky.nadirColor;
        } else if (frac > 0.5) {
          color1 = env.sky.nadirColor;
          color2 = env.sky.groundColor;
          frac = 1.0 - (2.0 * (frac - 0.5));
          frac = Math.pow(frac, env.sky.groundExponent);
        } else {
          color1 = env.sky.zenithColor;
          color2 = env.sky.skyColor;
          frac = 2.0 * frac;
          frac = Math.pow(frac, env.sky.skyExponent);
        }

        color1.lerp(color2, frac, color1);
        color1.setAlpha(color1.getAlpha() + frac * (color2.getAlpha() - color1.getAlpha()));
        buffer[currentBufferIdx] = color1.colors.r;
        buffer[currentBufferIdx + 1] = color1.colors.g;
        buffer[currentBufferIdx + 2] = color1.colors.b;
        buffer[currentBufferIdx + 3] = color1.getAlpha();
      }
      const image = ImageBuffer.create(buffer, ImageBufferFormat.Rgba, 1);
      if (!image)
        return false;
      texture = system.createTextureFromImageBuffer(image, this.iModel, RenderTexture.Params.defaults);
      if (!texture)
        return false;
    }

    const matParams = new RenderMaterial.Params();
    matParams.diffuseColor = ColorDef.white;
    matParams.shadows = false;
    matParams.ambient = 1;
    matParams.diffuse = 0;

    const mapParams = new TextureMapping.Params();
    const transform = new TextureMapping.Trans2x3(0, 1, 0, 1, 0, 0);
    mapParams.textureMatrix = transform;
    mapParams.textureMatrix.setTransform();
    matParams.textureMapping = new TextureMapping(texture, mapParams);

    this.skyboxMaterial = system.createMaterial(matParams, this.iModel);
    return true;
  }
}
