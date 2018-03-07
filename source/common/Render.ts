/*---------------------------------------------------------------------------------------------
Gradient/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { Id64, JsonUtils, assert } from "@bentley/bentleyjs-core";
import { ColorDef } from "./ColorDef";
import { IModel } from "./IModel";
import { Point3d, XYAndZ, Transform, Angle } from "@bentley/geometry-core";
import { PatternParams } from "./geometry/AreaPattern";
import { LineStyleInfo } from "./geometry/LineStyle";
import { CameraProps } from "./ViewProps";

export const enum RenderMode {
  Wireframe = 0,
  HiddenLine = 3,
  SolidFill = 4,
  SmoothShade = 6,
}

/**
 * The current position (eyepoint), lens angle, and focus distance of a camera.
 */
export class Camera implements CameraProps {
  public readonly lens: Angle;
  public focusDist: number;
  public readonly eye: Point3d;

  public static isValidLensAngle(val: Angle) { return val.radians > (Math.PI / 8.0) && val.radians < Math.PI; }
  public static validateLensAngle(val: Angle) { if (!this.isValidLensAngle(val)) val.setRadians(Math.PI / 2.0); }
  public invalidateFocus() { this.focusDist = 0.0; }
  public isFocusValid() { return this.focusDist > 0.0 && this.focusDist < 1.0e14; }
  public getFocusDistance() { return this.focusDist; }
  public setFocusDistance(dist: number) { this.focusDist = dist; }
  public isLensValid() { return Camera.isValidLensAngle(this.lens); }
  public validateLens() { Camera.validateLensAngle(this.lens); }
  public getLensAngle() { return this.lens; }
  public setLensAngle(angle: Angle) { this.lens.setFrom(angle); }
  public getEyePoint() { return this.eye; }
  public setEyePoint(pt: XYAndZ) { this.eye.setFrom(pt); }
  public isValid() { return this.isLensValid() && this.isFocusValid(); }
  public equals(other: Camera) { return this.lens === other.lens && this.focusDist === other.focusDist && this.eye.isExactEqual(other.eye); }
  public clone() { return new Camera(this); }
  public copyFrom(rhs: Camera) {
    this.lens.setFrom(rhs.lens);
    this.focusDist = rhs.focusDist;
    this.eye.setFrom(rhs.eye);
  }
  public constructor(json: CameraProps) {
    this.lens = Angle.fromJSON(json.lens);
    this.focusDist = JsonUtils.asDouble(json.focusDist);
    this.eye = Point3d.fromJSON(json.eye);
  }
}

/** Flags for view display style */
export class ViewFlags {
  public renderMode: RenderMode = RenderMode.Wireframe;
  public dimensions: boolean = true;            // Shows or hides dimensions.
  public patterns: boolean = true;              // Shows or hides pattern geometry.
  public weights: boolean = true;               // Controls whether non-zero line weights are used or display using weight 0.
  public styles: boolean = true;                // Controls whether custom line styles are used (e.g. control whether elements with custom line styles draw normally, or as solid lines).
  public transparency: boolean = true;          // Controls whether element transparency is used (e.g. control whether elements with transparency draw normally, or as opaque).
  public fill: boolean = true;                  // Controls whether the fills on filled elements are displayed.
  public textures: boolean = true;              // Controls whether to display texture maps for material assignments. When off only material color is used for display.
  public materials: boolean = true;             // Controls whether materials are used (e.g. control whether geometry with materials draw normally, or as if it has no material).
  public acsTriad: boolean = false;             // Shows or hides the ACS triad.
  public grid: boolean = false;                 // Shows or hides the grid. The grid settings are a design file setting.
  public visibleEdges: boolean = false;         // Shows or hides visible edges in the shaded render mode.
  public hiddenEdges: boolean = false;          // Shows or hides hidden edges in the shaded render mode.
  public sourceLights: boolean = false;         // Controls whether the source lights in spatial models are used
  public cameraLights: boolean = false;         // Controls whether camera (ambient, portrait, flashbulb) lights are used.
  public solarLight: boolean = false;           // Controls whether sunlight used
  public shadows: boolean = false;              // Shows or hides shadows.
  public noClipVolume: boolean = false;         // Controls whether the clip volume is applied.
  public constructions: boolean = false;        // Shows or hides construction class geometry.
  public monochrome: boolean = false;           // draw all graphics in a single color
  public noGeometryMap: boolean = false;        // ignore geometry maps
  public hLineMaterialColors: boolean = false;  // use material colors for hidden lines
  public edgeMask: number = 0;                  // 0=none, 1=generate mask, 2=use mask

  public static createFrom(other?: ViewFlags): ViewFlags {
    const val = new ViewFlags();
    if (other) {
      val.renderMode = other.renderMode;
      val.dimensions = other.dimensions;
      val.patterns = other.patterns;
      val.weights = other.weights;
      val.styles = other.styles;
      val.transparency = other.transparency;
      val.fill = other.fill;
      val.textures = other.textures;
      val.materials = other.materials;
      val.acsTriad = other.acsTriad;
      val.grid = other.grid;
      val.visibleEdges = other.visibleEdges;
      val.hiddenEdges = other.hiddenEdges;
      val.sourceLights = other.sourceLights;
      val.cameraLights = other.cameraLights;
      val.solarLight = other.solarLight;
      val.shadows = other.shadows;
      val.noClipVolume = other.noClipVolume;
      val.constructions = other.constructions;
      val.monochrome = other.monochrome;
      val.noGeometryMap = other.noGeometryMap;
      val.hLineMaterialColors = other.hLineMaterialColors;
      val.edgeMask = other.edgeMask;
    }
    return val;
  }

  public hiddenEdgesVisible(): boolean {
    switch (this.renderMode) {
      case RenderMode.SolidFill:
      case RenderMode.HiddenLine:
        return this.hiddenEdges;
      case RenderMode.SmoothShade:
        return this.visibleEdges && this.hiddenEdges;
    }
    return true;
  }

  public toJSON(): any {
    const out: any = {};

    if (!this.constructions) out.noConstruct = true;
    if (!this.dimensions) out.noDim = true;
    if (!this.patterns) out.noPattern = true;
    if (!this.weights) out.noWeight = true;
    if (!this.styles) out.noStyle = true;
    if (!this.transparency) out.noTransp = true;
    if (!this.fill) out.noFill = true;
    if (this.grid) out.grid = true;
    if (this.acsTriad) out.acs = true;
    if (!this.textures) out.noTexture = true;
    if (!this.materials) out.noMaterial = true;
    if (!this.cameraLights) out.noCameraLights = true;
    if (!this.sourceLights) out.noSourceLights = true;
    if (!this.solarLight) out.noSolarLight = true;
    if (this.visibleEdges) out.visEdges = true;
    if (this.hiddenEdges) out.hidEdges = true;
    if (this.shadows) out.shadows = true;
    if (!this.noClipVolume) out.clipVol = true;
    if (this.hLineMaterialColors) out.hlMatColors = true;
    if (this.monochrome) out.monochrome = true;
    if (this.edgeMask !== 0) out.edgeMask = this.edgeMask;

    out.renderMode = this.renderMode;
    return out;
  }

  public static fromJSON(json: any): ViewFlags {
    const val = new ViewFlags();
    if (!json)
      return val;
    val.constructions = !JsonUtils.asBool(json.noConstruct);
    val.dimensions = !JsonUtils.asBool(json.noDim);
    val.patterns = !JsonUtils.asBool(json.noPattern);
    val.weights = !JsonUtils.asBool(json.noWeight);
    val.styles = !JsonUtils.asBool(json.noStyle);
    val.transparency = !JsonUtils.asBool(json.noTransp);
    val.fill = !JsonUtils.asBool(json.noFill);
    val.grid = JsonUtils.asBool(json.grid);
    val.acsTriad = JsonUtils.asBool(json.acs);
    val.textures = !JsonUtils.asBool(json.noTexture);
    val.materials = !JsonUtils.asBool(json.noMaterial);
    val.cameraLights = !JsonUtils.asBool(json.noCameraLights);
    val.sourceLights = !JsonUtils.asBool(json.noSourceLights);
    val.solarLight = !JsonUtils.asBool(json.noSolarLight);
    val.visibleEdges = JsonUtils.asBool(json.visEdges);
    val.hiddenEdges = JsonUtils.asBool(json.hidEdges);
    val.shadows = JsonUtils.asBool(json.shadows);
    val.noClipVolume = !JsonUtils.asBool(json.clipVol);
    val.monochrome = JsonUtils.asBool(json.monochrome);
    val.edgeMask = JsonUtils.asInt(json.edgeMask);
    val.hLineMaterialColors = JsonUtils.asBool(json.hlMatColors);

    const renderModeValue = JsonUtils.asInt(json.renderMode);
    if (renderModeValue < RenderMode.HiddenLine)
      val.renderMode = RenderMode.Wireframe;
    else if (renderModeValue > RenderMode.SolidFill)
      val.renderMode = RenderMode.SmoothShade;
    else
      val.renderMode = renderModeValue;

    return val;
  }
  public showDimensions() { return this.dimensions; }
  public ignoreGeometryMap() { return this.noGeometryMap; }
  public isMonochrome() { return this.monochrome; }
  public showAcsTriad() { return this.acsTriad; }
  public showCameraLights() { return this.cameraLights; }
  public showClipVolume() { return this.noClipVolume; }
  public showConstructions() { return this.constructions; }
  public showFill() { return this.fill; }
  public showGrid() { return this.grid; }
  public showHiddenEdges() { return this.hiddenEdges; }
  public showMaterials() { return this.materials; }
  public showPatterns() { return this.patterns; }
  public showShadows() { return this.shadows; }
  public showSolarLight() { return this.solarLight; }
  public showSourceLights() { return this.sourceLights; }
  public showStyles() { return this.styles; }
  public showTextures() { return this.textures; }
  public showTransparency() { return this.transparency; }
  public showVisibleEdges() { return this.visibleEdges; }
  public showWeights() { return this.weights; }
  public useHlineMaterialColors() { return this.hLineMaterialColors; }
  public getEdgeMask() { return this.edgeMask; }
  public setEdgeMask(val: number) { this.edgeMask = val; }
  public setIgnoreGeometryMap(val: boolean) { this.noGeometryMap = val; }
  public setMonochrome(val: boolean) { this.monochrome = val; }
  public setShowAcsTriad(val: boolean) { this.acsTriad = val; }
  public setShowCameraLights(val: boolean) { this.cameraLights = val; }
  public setShowClipVolume(val: boolean) { this.noClipVolume = !val; }
  public setShowConstructions(val: boolean) { this.constructions = val; }
  public setShowDimensions(val: boolean) { this.dimensions = val; }
  public setShowFill(val: boolean) { this.fill = val; }
  public setShowGrid(val: boolean) { this.grid = val; }
  public setShowHiddenEdges(val: boolean) { this.hiddenEdges = val; }
  public setShowMaterials(val: boolean) { this.materials = val; }
  public setShowPatterns(val: boolean) { this.patterns = val; }
  public setShowShadows(val: boolean) { this.shadows = val; }
  public setShowSolarLight(val: boolean) { this.solarLight = val; }
  public setShowSourceLights(val: boolean) { this.sourceLights = val; }
  public setShowStyles(val: boolean) { this.styles = val; }
  public setShowTextures(val: boolean) { this.textures = val; }
  public setShowTransparency(val: boolean) { this.transparency = val; }
  public setShowVisibleEdges(val: boolean) { this.visibleEdges = val; }
  public setShowWeights(val: boolean) { this.weights = val; }
  public setUseHlineMaterialColors(val: boolean) { this.hLineMaterialColors = val; }
  public getRenderMode() { return this.renderMode; }
  public setRenderMode(value: RenderMode) { this.renderMode = value; }
}

export namespace ViewFlag {
  export const enum PresenceFlag {
    kRenderMode,
    kText,
    kDimensions,
    kPatterns,
    kWeights,
    kStyles,
    kTransparency,
    kFill,
    kTextures,
    kMaterials,
    kVisibleEdges,
    kHiddenEdges,
    kSourceLights,
    kCameraLights,
    kSolarLight,
    kShadows,
    kClipVolume,
    kConstructions,
    kMonochrome,
    kGeometryMap,
    kHlineMaterialColors,
    kEdgeMask,
  }

  /**
   * Overrides a subset of ViewFlags.
   */
  export class Overrides {
    private present = 0;
    private readonly values = new ViewFlags();

    public setPresent(flag: PresenceFlag) { this.present |= (1 << flag); }
    public isPresent(flag: PresenceFlag): boolean { return 0 !== (this.present & (1 << flag)); }

    /** Construct a ViewFlagsOverrides which overrides all flags to match the specified ViewFlags */
    constructor(flags?: ViewFlags) { this.values = ViewFlags.createFrom(flags); this.present = 0xffffffff; }

    public setShowDimensions(val: boolean) { this.values.setShowDimensions(val); this.setPresent(PresenceFlag.kDimensions); }
    public setShowPatterns(val: boolean) { this.values.setShowPatterns(val); this.setPresent(PresenceFlag.kPatterns); }
    public setShowWeights(val: boolean) { this.values.setShowWeights(val); this.setPresent(PresenceFlag.kWeights); }
    public setShowStyles(val: boolean) { this.values.setShowStyles(val); this.setPresent(PresenceFlag.kStyles); }
    public setShowTransparency(val: boolean) { this.values.setShowTransparency(val); this.setPresent(PresenceFlag.kTransparency); }
    public setShowFill(val: boolean) { this.values.setShowFill(val); this.setPresent(PresenceFlag.kFill); }
    public setShowTextures(val: boolean) { this.values.setShowTextures(val); this.setPresent(PresenceFlag.kTextures); }
    public setShowMaterials(val: boolean) { this.values.setShowMaterials(val); this.setPresent(PresenceFlag.kMaterials); }
    public setShowSourceLights(val: boolean) { this.values.setShowSourceLights(val); this.setPresent(PresenceFlag.kSourceLights); }
    public setShowCameraLights(val: boolean) { this.values.setShowCameraLights(val); this.setPresent(PresenceFlag.kCameraLights); }
    public setShowSolarLight(val: boolean) { this.values.setShowSolarLight(val); this.setPresent(PresenceFlag.kSolarLight); }
    public setShowVisibleEdges(val: boolean) { this.values.setShowVisibleEdges(val); this.setPresent(PresenceFlag.kVisibleEdges); }
    public setShowHiddenEdges(val: boolean) { this.values.setShowHiddenEdges(val); this.setPresent(PresenceFlag.kHiddenEdges); }
    public setShowShadows(val: boolean) { this.values.setShowShadows(val); this.setPresent(PresenceFlag.kShadows); }
    public setShowClipVolume(val: boolean) { this.values.setShowClipVolume(val); this.setPresent(PresenceFlag.kClipVolume); }
    public setShowConstructions(val: boolean) { this.values.setShowConstructions(val); this.setPresent(PresenceFlag.kConstructions); }
    public setMonochrome(val: boolean) { this.values.setMonochrome(val); this.setPresent(PresenceFlag.kMonochrome); }
    public setIgnoreGeometryMap(val: boolean) { this.values.setIgnoreGeometryMap(val); this.setPresent(PresenceFlag.kGeometryMap); }
    public setUseHlineMaterialColors(val: boolean) { this.values.setUseHlineMaterialColors(val); this.setPresent(PresenceFlag.kHlineMaterialColors); }
    public setEdgeMask(val: number) { this.values.setEdgeMask(val); this.setPresent(PresenceFlag.kEdgeMask); }
    public setRenderMode(val: RenderMode) { this.values.renderMode = val; this.setPresent(PresenceFlag.kRenderMode); }
    public anyOverridden() { return 0 !== this.present; }
    public clear() { this.present = 0; }

    /** Apply these overrides to the supplied ViewFlags */
    public apply(base: ViewFlags) {
      if (!this.anyOverridden())
        return;

      if (this.isPresent(PresenceFlag.kDimensions)) base.setShowDimensions(this.values.showDimensions());
      if (this.isPresent(PresenceFlag.kPatterns)) base.setShowPatterns(this.values.showPatterns());
      if (this.isPresent(PresenceFlag.kWeights)) base.setShowWeights(this.values.showWeights());
      if (this.isPresent(PresenceFlag.kStyles)) base.setShowStyles(this.values.showStyles());
      if (this.isPresent(PresenceFlag.kTransparency)) base.setShowTransparency(this.values.showTransparency());
      if (this.isPresent(PresenceFlag.kFill)) base.setShowFill(this.values.showFill());
      if (this.isPresent(PresenceFlag.kTextures)) base.setShowTextures(this.values.showTextures());
      if (this.isPresent(PresenceFlag.kMaterials)) base.setShowMaterials(this.values.showMaterials());
      if (this.isPresent(PresenceFlag.kSolarLight)) base.setShowSolarLight(this.values.showSolarLight());
      if (this.isPresent(PresenceFlag.kCameraLights)) base.setShowCameraLights(this.values.showCameraLights());
      if (this.isPresent(PresenceFlag.kSourceLights)) base.setShowSourceLights(this.values.showSourceLights());
      if (this.isPresent(PresenceFlag.kVisibleEdges)) base.setShowVisibleEdges(this.values.showVisibleEdges());
      if (this.isPresent(PresenceFlag.kHiddenEdges)) base.setShowHiddenEdges(this.values.showHiddenEdges());
      if (this.isPresent(PresenceFlag.kShadows)) base.setShowShadows(this.values.showShadows());
      if (this.isPresent(PresenceFlag.kClipVolume)) base.setShowClipVolume(this.values.showClipVolume());
      if (this.isPresent(PresenceFlag.kConstructions)) base.setShowConstructions(this.values.showConstructions());
      if (this.isPresent(PresenceFlag.kMonochrome)) base.setMonochrome(this.values.isMonochrome());
      if (this.isPresent(PresenceFlag.kGeometryMap)) base.setIgnoreGeometryMap(this.values.ignoreGeometryMap());
      if (this.isPresent(PresenceFlag.kHlineMaterialColors)) base.setUseHlineMaterialColors(this.values.useHlineMaterialColors());
      if (this.isPresent(PresenceFlag.kEdgeMask)) base.setEdgeMask(this.values.getEdgeMask());
      if (this.isPresent(PresenceFlag.kRenderMode)) base.setRenderMode(this.values.getRenderMode());
    }
  }
}

export const enum LinePixels {
  Solid = 0,
  Code0 = Solid,            // 0
  Code1 = 0x80808080,       // 1
  Code2 = 0xf8f8f8f8,       // 2
  Code3 = 0xffe0ffe0,       // 3
  Code4 = 0xfe10fe10,       // 4
  Code5 = 0xe0e0e0e0,       // 5
  Code6 = 0xf888f888,       // 6
  Code7 = 0xff18ff18,       // 7
  HiddenLine = 0xcccccccc,  // hidden lines
  Invisible = 0x00000001,   // nearly invisible
  Invalid = 0xffffffff,
}

/** parameters for displaying hidden lines */
export namespace HiddenLine {

  export class Style {
    public ovrColor: boolean;
    public color: ColorDef;
    public pattern: LinePixels;
    public width: number;
    public constructor(json: any) {
      this.ovrColor = JsonUtils.asBool(json.ovrColor);
      this.color = ColorDef.fromJSON(json.color);
      this.pattern = JsonUtils.asInt(json.pattern, LinePixels.Solid);
      this.width = JsonUtils.asInt(json.width);
    }
    public equals(other: Style): boolean {
      return this.ovrColor === other.ovrColor && this.color === other.color && this.pattern === other.pattern && this.width === other.width;
    }
  }

  export class Params {
    public visible: Style;
    public hidden: Style;
    public transparencyThreshold: number = 1.0;
    public equals(other: Params): boolean { return this.visible === other.visible && this.hidden === other.hidden && this.transparencyThreshold === other.transparencyThreshold; }
    public constructor(json: any) {
      this.visible = new HiddenLine.Style(json.visible);
      this.hidden = new HiddenLine.Style(json.hidden);
      this.transparencyThreshold = JsonUtils.asDouble(json.transparencyThreshold, 1.0);
    }
  }
}
export namespace Gradient {
  export const enum Flags {
    None = 0,
    Invert = (1 << 0),
    Outline = (1 << 1),
  }

  export const enum Mode {
    None = 0,
    Linear = 1,
    Curved = 2,
    Cylindrical = 3,
    Spherical = 4,
    Hemispherical = 5,
  }

  export class Symb {
    public mode = Mode.None;
    public flags = Flags.None;
    public nKeys = 0;
    public angle = 0.0;
    public tint = 0.0;
    public shift = 0.0;
    public readonly colors: ColorDef[] = [];
    public readonly values: number[] = [];

    public clone(): Symb {
      const retVal = new Symb();
      retVal.mode = this.mode;
      retVal.flags = this.flags;
      retVal.nKeys = this.nKeys;
      retVal.angle = this.angle;
      retVal.tint = this.tint;
      retVal.shift = this.shift;
      for (let i = 0; i < this.nKeys; ++i) {
        retVal.colors.push(this.colors[i]);
        retVal.values.push(this.values[i]);
      }
      return retVal;
    }

    public isEqualTo(other: Symb): boolean {
      if (this === other)
        return true; // Same pointer
      if (this.mode !== other.mode)
        return false;
      if (this.flags !== other.flags)
        return false;
      if (this.nKeys !== other.nKeys)
        return false;
      if (this.angle !== other.angle)
        return false;
      if (this.tint !== other.tint)
        return false;
      if (this.shift !== other.shift)
        return false;
      for (let i = 0; i < this.nKeys; ++i) {
        if (other.values[i] !== this.values[i])
          return false;
        if (!other.colors[i].equals(this.colors[i]))
          return false;
      }
      return true;
    }
  }
}

/**  Whether a closed region should be drawn for wireframe display with its internal area filled or not. */
export const enum FillDisplay {
  /** don't fill, even if fill attribute is on for the viewport */
  Never = 0,
  /** fill if the fill attribute is on for the viewport */
  ByView = 1,
  /**  always fill, even if the fill attribute is off for the viewport */
  Always = 2,
  /** always fill, fill will always be behind subsequent geometry */
  Blanking = 3,
}

export const enum BackgroundFill {
  /** single color fill uses the fill color and line color to draw either a solid or outline fill */
  None = 0,
  /** single color fill uses the view's background color to draw a solid fill */
  Solid = 1,
  /** single color fill uses the view's background color and line color to draw an outline fill */
  Outline = 2,
}

export const enum GeometryClass {
  Primary = 0,
  Construction = 1,
  Dimension = 2,
  Pattern = 3,
}

export class Texture {
}

export class Material {
}

export class AppearanceOverrides {
  public color = false;
  public weight = false;
  public style = false;
  public material = false;
  public fill = false;
  public clear() { this.color = this.weight = this.style = this.material = this.fill = false; }
}

/**
 * This structure holds the displayable parameters of a GeometrySource
 */
export class GeometryParams {
  public readonly appearanceOverrides = new AppearanceOverrides(); // flags for parameters that override SubCategory::Appearance.
  private resolved = false; // whether Resolve has established SubCategory::Appearance/effective values.
  private materialId?: Id64; // render material Id.
  private elmPriority = 0; // display priority (applies to 2d only)
  private netPriority = 0; // net display priority for element/category (applies to 2d only)
  private weight = 0;
  private readonly lineColor = new ColorDef();
  private readonly fillColor = new ColorDef(); // fill color (applicable only if filled)
  private backgroundFill = BackgroundFill.None; // support for fill using the view's background color.
  private fillDisplay = FillDisplay.Never; // whether or not the element should be displayed filled
  private elmTransparency = 0; // transparency, 1.0 == completely transparent.
  private netElmTransparency = 0; // net transparency for element/category.
  private fillTransparency = 0;  // fill transparency, 1.0 == completely transparent.
  private netFillTransparency = 0; // net transparency for fill/category.
  private geometryClass = GeometryClass.Primary; // geometry class
  private styleInfo?: LineStyleInfo; // line style id plus modifiers.
  private gradient?: Gradient.Symb; // gradient fill settings.
  private pattern?: PatternParams; // area pattern settings.

  constructor(public categoryId: Id64, public subCategoryId = new Id64()) { if (!subCategoryId.isValid()) this.subCategoryId = IModel.getDefaultSubCategoryId(categoryId); }

  // void Resolve(DgnDbR, DgnViewportP vp = nullptr); // Resolve effective values using the supplied DgnDb and optional DgnViewport (for view bg fill and view sub-category overrides)...
  // void Resolve(ViewContextR); // Resolve effective values using the supplied ViewContext.

  public clone(): GeometryParams {
    const retVal = new GeometryParams(this.categoryId, this.subCategoryId);
    retVal.appearanceOverrides.color = this.appearanceOverrides.color;
    retVal.appearanceOverrides.weight = this.appearanceOverrides.weight;
    retVal.appearanceOverrides.style = this.appearanceOverrides.style;
    retVal.appearanceOverrides.material = this.appearanceOverrides.material;
    retVal.appearanceOverrides.fill = this.appearanceOverrides.fill;
    retVal.resolved = this.resolved;
    retVal.materialId = this.materialId;
    retVal.elmPriority = this.elmPriority;
    retVal.netPriority = this.netPriority;
    retVal.weight = this.weight;
    retVal.lineColor.setFrom(this.lineColor);
    retVal.fillColor.setFrom(this.fillColor);
    retVal.backgroundFill = this.backgroundFill;
    retVal.fillDisplay = this.fillDisplay;
    retVal.elmTransparency = this.elmTransparency;
    retVal.netElmTransparency = this.netElmTransparency;
    retVal.fillTransparency = this.fillTransparency;
    retVal.netFillTransparency = this.netFillTransparency;
    retVal.geometryClass = this.geometryClass;
    retVal.styleInfo = this.styleInfo ? this.styleInfo.clone() : undefined;
    retVal.gradient = this.gradient ? this.gradient.clone() : undefined;
    retVal.pattern = this.pattern ? this.pattern.clone() : undefined;
    return retVal;
  }

  /**
   *  Clears appearance overrides while preserving category and sub-category.
   */
  public resetAppearance() {
    this.appearanceOverrides.clear();
    this.resolved = false;
    this.materialId = undefined;
    this.elmPriority = 0;
    this.netPriority = 0;
    this.weight = 0;
    this.lineColor.setFrom(new ColorDef());
    this.fillColor.setFrom(new ColorDef());
    this.backgroundFill = BackgroundFill.None;
    this.fillDisplay = FillDisplay.Never;
    this.elmTransparency = 0;
    this.netElmTransparency = 0;
    this.fillTransparency = 0;
    this.netFillTransparency = 0;
    this.geometryClass = GeometryClass.Primary;
    this.styleInfo = undefined;
    this.gradient = undefined;
    this.pattern = undefined;
  }

  /**
   *  Compare two GeometryParams for equivalence, i.e. both values are from sub-category appearance or have the same override.
   */
 public isEquivalent(other: GeometryParams): boolean {
   if (this === other)
     return true; // Same pointer

   if (!this.categoryId.equals(other.categoryId))
     return false;
   if (!this.subCategoryId.equals(other.subCategoryId))
     return false;
   if (this.geometryClass !== other.geometryClass)
     return false;

   // Don't compare netPriority, compare the inputs: elmPriority + subCateogoryId.
   if (this.elmPriority !== other.elmPriority)
     return false;
   // Don't compare netElmTransparency, compare the inputs: elmTransparency + subCateogoryId.
   if (this.elmTransparency !== other.elmTransparency)
     return false;
   // Don't compare netFillTransparency, compare the inputs: fillTransparency + subCateogoryId.
   if (this.fillTransparency !== other.fillTransparency)
     return false;

   // Don't compare lineColor unless sub-category appearance override is set...
   if (this.appearanceOverrides.color !== other.appearanceOverrides.color)
     return false;
   if (this.appearanceOverrides.color && (!this.lineColor.equals(other.lineColor)))
     return false;

   // Don't compare weight unless sub-category appearance override is set...
   if (this.appearanceOverrides.weight !== other.appearanceOverrides.weight)
     return false;
   if (this.appearanceOverrides.weight && (this.weight !== other.weight))
     return false;

   // Don't compare m_materialId unless sub-category appearance override is set...
   if (this.appearanceOverrides.material !== other.appearanceOverrides.material)
     return false;
   if (this.appearanceOverrides.material && (!this.materialId!.equals(other.materialId!)))
     return false;

   // Don't compare m_styleInfo unless sub-category appearance override is set...
   if (this.appearanceOverrides.style !== other.appearanceOverrides.style)
     return false;
   if (this.appearanceOverrides.style) {
     if ((this.styleInfo === undefined) !== (other.styleInfo === undefined))
       return false;
     if (this.styleInfo) {
       if (!this.styleInfo.styleId.equals(other.styleInfo!.styleId))
         return false;
       if (!this.styleInfo.lStyleSymb.isEqualTo(other.styleInfo!.lStyleSymb))
         return false;
     }
   }

   if (this.fillDisplay !== other.fillDisplay)
     return false;
   if (this.fillDisplay !== FillDisplay.Never) {
     // Don't compare fillColor/gradient unless sub-category appearance override is set...
     if (this.appearanceOverrides.fill !== other.appearanceOverrides.fill)
       return false;
     if (this.appearanceOverrides.fill) {
       if ((this.gradient === undefined) !== (other.gradient === undefined))
         return false;
       if (this.gradient && !this.gradient.isEqualTo(other.gradient!))
         return false;
       if (this.backgroundFill !== other.backgroundFill)
         return false;
       if (this.backgroundFill !== BackgroundFill.None && !this.fillColor.equals(other.fillColor))
         return false;
     }
   }

   if ((this.pattern === undefined) !== (other.pattern === undefined))
     return false;
   if (this.pattern && !this.pattern.isEqualTo(other.pattern!))
     return false;

   return true;
  }

  /** Whether effective values have been resolved. */
  public isResolved() { return this.resolved; }

  /** Setting the Category Id also sets the SubCategory to the default. */
  public setCategoryId(categoryId: Id64, clearAppearanceOverrides = true) {
    this.categoryId = categoryId;
    this.subCategoryId = IModel.getDefaultSubCategoryId(categoryId);
    if (clearAppearanceOverrides)
      this.appearanceOverrides.clear();
    this.resolved = false;
  }
  public setSubCategoryId(subCategoryId: Id64, clearAppearanceOverrides = true) {
    this.subCategoryId = subCategoryId;
    if (clearAppearanceOverrides)
      this.appearanceOverrides.clear();
    this.resolved = false;
  }
  public setWeight(weight: number) { this.appearanceOverrides.weight = true; this.weight = weight; }
  public setLineStyle(styleInfo: LineStyleInfo | undefined) { this.appearanceOverrides.style = true; this.styleInfo = styleInfo; if (styleInfo) this.resolved = false; }
  public setLineColor(color: ColorDef) { this.appearanceOverrides.color = true; this.lineColor.setFrom(color); }
  public setFillDisplay(display: FillDisplay) { this.fillDisplay = display; }
  public setFillColor(color: ColorDef) { this.appearanceOverrides.fill = true; this.fillColor.setFrom(color); this.backgroundFill = BackgroundFill.None; }
  public setFillColorFromViewBackground(outline = false) { this.appearanceOverrides.fill = true; this.backgroundFill = outline ? BackgroundFill.Outline : BackgroundFill.Solid; this.resolved = false; }
  public setGradient(gradient: Gradient.Symb | undefined) { this.gradient = gradient; }
  public setGeometryClass(geomClass: GeometryClass) { this.geometryClass = geomClass; }
  public setTransparency(transparency: number) { this.elmTransparency = this.netElmTransparency = this.fillTransparency = this.netFillTransparency = transparency; this.resolved = false; } // NOTE: Sets BOTH element and fill transparency...
  public setFillTransparency(transparency: number) { this.fillTransparency = this.netFillTransparency = transparency; this.resolved = false; }
  public setDisplayPriority(priority: number) { this.elmPriority = this.netPriority = priority; this.resolved = false; } // Set display priority (2d only).
  public setMaterialId(materialId: Id64 | undefined) { this.appearanceOverrides.material = true; this.materialId = materialId; }
  public setPatternParams(patternParams: PatternParams | undefined) { this.pattern = patternParams; }
  public getNetTransparency() { return this.netElmTransparency; }
  public getNetFillTransparency() { return this.netFillTransparency; }
  /** Get net display priority (2d only). */
  public getNetDisplayPriority() { return this.netPriority; }
  public setNetDisplayPriority(priority: number) { this.netPriority = priority; }
  public setLineColorToSubCategoryAppearance() { this.resolved = this.appearanceOverrides.color = false; }
  public setWeightToSubCategoryAppearance() { this.resolved = this.appearanceOverrides.weight = false; }
  public setLineStyleToSubCategoryAppearance() { this.resolved = this.appearanceOverrides.style = false; }
  public setMaterialToSubCategoryAppearance() { this.resolved = this.appearanceOverrides.material = false; }
  public setFillColorToSubCategoryAppearance() { this.resolved = this.appearanceOverrides.fill = false; }
  public isLineColorFromSubCategoryAppearance() { return !this.appearanceOverrides.color; }
  public isWeightFromSubCategoryAppearance() { return !this.appearanceOverrides.weight; }
  public isLineStyleFromSubCategoryAppearance() { return !this.appearanceOverrides.style; }
  public isMaterialFromSubCategoryAppearance() { return !this.appearanceOverrides.material; }
  public isFillColorFromSubCategoryAppearance() { return !this.appearanceOverrides.fill; }

  /** Get element category */
  public getCategoryId() { return this.categoryId; }

  /** Get element sub-category */
  public getSubCategoryId() { return this.subCategoryId; }

  /**  Get element color */
  public getLineColor() { assert(this.appearanceOverrides.color || this.resolved); return this.lineColor; }

  /**  Get element fill color */
  public getFillColor() { assert((this.appearanceOverrides.fill && BackgroundFill.None === this.backgroundFill) || this.resolved); return this.fillColor; }

  /**  Get fill display setting */
  public getFillDisplay() { return this.fillDisplay; }

  /**  Get solid fill color type setting */
  public isFillColorFromViewBackground(): boolean { return BackgroundFill.None !== this.backgroundFill; }

  /**  Get whether background color solid fill should display an outline using the line color or not */
  public isBackgroundFillOutlined(): boolean { return BackgroundFill.Outline === this.backgroundFill; }

  /**  Get gradient fill information. Valid when FillDisplay::Never != GetFillDisplay() and not nullptr. */
  public getGradient() { return this.gradient; }

  /**  Get the area pattern params. */
  public getPatternParams() { return this.pattern; }

  /**  Get the geometry class. */
  public getGeometryClass() { return this.geometryClass; }

  /**  Get line style information. */
  public getLineStyle() { assert(this.appearanceOverrides.style || this.resolved); return this.styleInfo; }

  /**  Get line weight. */
  public getWeight() { assert(this.appearanceOverrides.weight || this.resolved); return this.weight; }

  /**  Get transparency. */
  public getTransparency() { return this.elmTransparency; }

  /**  Get fill/gradient transparency. */
  public getFillTransparency() { return this.fillTransparency; }

  /**  Get render material. */
  public getMaterialId() { assert(this.appearanceOverrides.material || this.resolved); return this.materialId; }

  /**  Get display priority (2d only). */
  public getDisplayPriority() { return this.elmPriority; }

  public hasStrokedLineStyle() {
    assert(this.appearanceOverrides.style || this.resolved);
    return (this.styleInfo ? this.styleInfo.lStyleSymb.lStyle && this.styleInfo.lStyleSymb.useStroker : false);
  }

  /**  Get whether this GeometryParams contains information that needs to be transformed (ex. to apply local to world). */
  public isTransformable() { return this.pattern || this.styleInfo; }

  /**  Transform GeometryParams data like PatternParams and LineStyleInfo. */
  public applyTransform(transform: Transform, options = 0) {
    if (this.pattern)
      this.pattern.applyTransform(transform);

    if (this.styleInfo)
      this.styleInfo.styleParams.applyTransform(transform, options);
  }
}

/**
 * The "cooked" material and symbology for a Render::Graphic. This determines the appearance
 * (e.g. texture, color, width, linestyle, etc.) used to draw Geometry.
 */
export class GraphicParams {
  public isFilled = false;
  public isBlankingRegion = false;
  public linePixels = LinePixels.Solid;
  public rasterWidth = 1;
  public readonly lineColor = new ColorDef();
  public readonly fillColor = new ColorDef();
  public trueWidthStart = 0;
  public trueWidthEnd = 0;
  public lineTexture?: Texture;
  public material?: Material;
  public gradient?: Gradient.Symb;

  // void Cook(GeometryParamsCR, ViewContextR);
  // void Init() {* this = GraphicParams(); }
  // Compare two GraphicParams.
  // DGNPLATFORM_EXPORT bool operator == (GraphicParamsCR rhs) const ;
  // copy operator
  // DGNPLATFORM_EXPORT GraphicParamsR operator = (GraphicParamsCR rhs);

  /** set the line color
   *  @param lineColor the new line color for this GraphicParams.
   */
  public setLineColor(lineColor: ColorDef) { this.lineColor.setFrom(lineColor); }
  public setLineTransparency(transparency: number) { this.lineColor.setAlpha(transparency); }

  /**
   * Set the current fill color for this GraphicParams.
   * @param fillColor the new fill color for this GraphicParams.
   */
  public setFillColor(fillColor: ColorDef) { this.fillColor.setFrom(fillColor); }
  public setFillTransparency(transparency: number) { this.fillColor.setAlpha(transparency); }

  /** Set the linear pixel pattern for this GraphicParams. This is only valid for overlay decorators in pixel mode. */
  public setLinePixels(code: LinePixels) { this.linePixels = code; this.lineTexture = undefined; }

  public static fromSymbology(lineColor: ColorDef, fillColor: ColorDef, lineWidth: number, linePixels = LinePixels.Solid): GraphicParams {
    const graphicParams = new GraphicParams();
    graphicParams.setLineColor(lineColor);
    graphicParams.setFillColor(fillColor);
    graphicParams.rasterWidth = lineWidth;
    graphicParams.setLinePixels(linePixels);
    return graphicParams;
  }

  public static FromBlankingFill(fillColor: ColorDef): GraphicParams {
    const graphicParams = new GraphicParams();
    graphicParams.setFillColor(fillColor);
    graphicParams.isBlankingRegion = true;
    return graphicParams;
  }
}

/**
 * A renderer-specific object that can be placed into a display list.
 */
export class Graphic {
}

export const enum AsThickenedLine { No = 0, Yes = 1 }

export class GraphicList {
  public list: Graphic[] = [];
  public isEmpty(): boolean { return this.list.length === 0; }
  public clear() { this.list.length = 0; }
  public add(graphic: Graphic) { this.list.push(graphic); }
  public getCount(): number { return this.list.length; }
}

export class DecorationList extends GraphicList {
}

export namespace Hilite {
  /**  Describes the width of the outline applied to hilited geometry. */
  export const enum Silhouette {
    None,
    Thin,
    Thick,
  }

  const defaultColor = ColorDef.from(0x23, 0xbb, 0xfc);
  const defaultVisibleRatio = 0.25;
  const defaultHiddenRatio = 0.0;
  const defaultWidth = Silhouette.Thin;

  /**
   * Describes the effect applied to hilited elements within a view.
   */
  export class Settings {
    private static clamp(value: number) { return Math.min(1.0, Math.max(0.0, value)); }
    public constructor(public readonly color = defaultColor.clone(), public visibleRatio = defaultVisibleRatio, public hiddenRatio = defaultHiddenRatio, public silhouette = defaultWidth) {
      this.visibleRatio = Settings.clamp(this.visibleRatio);
      this.hiddenRatio = Settings.clamp(this.hiddenRatio);
    }
    /** Change the color, preserving all other settings */
    public setColor(color: ColorDef) { this.color.setFrom(color); }
  }
}

/**
 * A set of GraphicLists of various types of Graphics that are "decorated" into the Render::Target,
 * in addition to the Scene.
 */
export class Decorations {
  public viewBackground?: Graphic; // drawn first, view units, with no zbuffer, smooth shading, default lighting. e.g., a skybox
  public normal?: GraphicList;       // drawn with zbuffer, with scene lighting
  public world?: DecorationList;        // drawn with zbuffer, with default lighting, smooth shading
  public worldOverlay?: DecorationList; // drawn in overlay mode, world units
  public viewOverlay?: DecorationList;  // drawn in overlay mode, view units
}

/**
 * Describes a "feature" within a batched Graphic. A batched Graphic can
 * contain multiple features. Each feature is associated with a unique combination of
 * attributes (element ID, subcategory, geometry class). This allows geometry to be
 * more efficiently batched on the GPU, while enabling features to be re-symbolized
 * individually.
 *
 * As a simple example, a single mesh primitive may contain geometry for 3 elements,
 * all belonging to the same subcategory and geometry class. The mesh would therefore
 * contain 3 Features. Each vertex within the mesh would be associated with the
 * index of the Feature to which it belongs, where the index is determined by the
 * FeatureTable associated with the primitive.
 */
export class Feature {
  public get isDefined(): boolean { return this.elementId.isValid() || this.subCategoryId.isValid() || this.geometryClass !== GeometryClass.Primary; }
  public get isUndefined(): boolean { return !this.isDefined; }
  constructor(public readonly elementId: Id64, public readonly subCategoryId: Id64, public readonly geometryClass: GeometryClass = GeometryClass.Primary) { }
  public equals(other: Feature): boolean { return this.isUndefined && other.isUndefined ? true : this.elementId.equals(other.elementId) && this.subCategoryId.equals(other.subCategoryId) && this.geometryClass === other.geometryClass; }
}

/**
 * Defines a look-up table for Features within a batched Graphic. Consecutive 32-bit
 * indices are assigned to each unique Feature. Primitives within the Graphic can
 * use per-vertex indices to specify the distribution of Features within the primitive.
 * A FeatureTable can be shared amongst multiple primitives within a single Graphic, and
 * amongst multiple sub-Graphics of a Graphic.
 */
export class FeatureTable {
  public get size(): number { return this.map.size; }
  public get isFull(): boolean { assert(this.size <= this.maxFeatures); return this.size >= this.maxFeatures; }
  public get isUniform(): boolean { return this.size === 1; }
  public get numIndices(): number { return new Uint32Array([this.size])[0]; }
  public get anyDefined(): boolean { return this.size > 1 || (this.isUniform && Array.from(this.map.values())[0].isDefined); }
  constructor(public readonly maxFeatures: number,
    public readonly modelId = new Id64(),
    public readonly map: Map<number, Feature> = new Map<number, Feature>()) { }
  /**
   * returns index of feature, unless it doesn't exist, then the feature is added and its key, which is the current numIndices is returned
   */
  public getIndex(feature: Feature): number {
    assert(!this.isFull);
    let key = this.findIndex(feature);
    if (key === -1 && !this.isFull) {
      key = this.numIndices;
      this.map.set(key, feature);
      return key;
    }
    return key;
  }
  /**
   * Deviates from native source in the following ways: no index parameter since primitives are always pass by value in js,
   * consequently instead of returning a boolean and setting the index reference, the index value is returned, which will be -1 when
   * the feature isn't found, which is a common practice in js
   */
  public findIndex(feature: Feature): number {
    let index = -1;
    this.map.forEach((v, k) => { if (v.equals(feature)) index = k; });
    return index;
  }
  /**
   * Deviates from native source in the following ways: no feature parameter since the Feature's properties are readonly. Instead, the
   * feature corresponding to the index will be returned, which could be undefined if not found.
   */
  public findFeature(index: number): Feature | undefined { return this.map.get(index); }
  public clear(): void { this.map.clear(); }
  public static fromFeatureTable(table: FeatureTable): FeatureTable { return new FeatureTable(table.maxFeatures, table.modelId, table.map); }
}
