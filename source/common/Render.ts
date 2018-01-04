/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { JsonUtils } from "@bentley/bentleyjs-core/lib/JsonUtils";
import { ColorDef } from "./ColorDef";
import { ClipVector } from "@bentley/geometry-core/lib/numerics/ClipVector";
import { GeometryStreamEntryId } from "./geometry/GeometryStream";
import { Id64 } from "@bentley/bentleyjs-core/lib/Id";
import { DgnFB } from "./geometry/ElementGraphicsSchema";
import { IModel } from "./IModel";
import { assert } from "@bentley/bentleyjs-core/lib/Assert";
import { Transform, Point3d, Point2d, Range3d, Range2d } from "@bentley/geometry-core/lib/PointVector";
import { PatternParams } from "./geometry/AreaPattern";
import { LineStyleInfo } from "./geometry/LineStyle";
import { Arc3d } from "@bentley/geometry-core/lib/curve/Arc3d";
import { BSplineCurve3d } from "@bentley/geometry-core/lib/bspline/BSplineCurve";
import { BSplineSurface3d } from "@bentley/geometry-core/lib/bspline/BSplineSurface";

// tslint:disable:no-empty

export const enum RenderMode {
  Wireframe = 0,
  HiddenLine = 3,
  SolidFill = 4,
  SmoothShade = 6,
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
    public _angle = 0.0;
    public tint = 0.0;
    public shift = 0.0;
    public readonly colors: ColorDef[] = [];
    public readonly values: number[] = [];
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
  private materialId: Id64; // render material Id.
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
  private geometryClass = DgnFB.GeometryClass.Primary; // geometry class
  private styleInfo?: LineStyleInfo; // line style id plus modifiers.
  private gradient?: Gradient.Symb; // gradient fill settings.
  private pattern?: PatternParams; // area pattern settings.

  constructor(public categoryId: Id64, public subCategoryId = new Id64()) { if (!subCategoryId.isValid()) this.subCategoryId = IModel.getDefaultSubCategoryId(categoryId); }

  // void ResetAppearance(); //!< Like Init, but saves and restores category and sub-category around the call to Init. This is particularly useful when a single element draws objects of different symbology, but its draw code does not have easy access to reset the category.
  // void Resolve(DgnDbR, DgnViewportP vp = nullptr); // Resolve effective values using the supplied DgnDb and optional DgnViewport (for view bg fill and view sub-category overrides)...
  // void Resolve(ViewContextR); // Resolve effective values using the supplied ViewContext.

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
  public setLineStyle(styleInfo: LineStyleInfo) { this.appearanceOverrides.style = true; this.styleInfo = styleInfo; if (styleInfo) this.resolved = false; }
  public setLineColor(color: ColorDef) { this.appearanceOverrides.color = true; this.lineColor.setFrom(color); }
  public setFillDisplay(display: FillDisplay) { this.fillDisplay = display; }
  public setFillColor(color: ColorDef) { this.appearanceOverrides.fill = true; this.fillColor.setFrom(color); this.backgroundFill = BackgroundFill.None; }
  public setFillColorFromViewBackground(outline = false) { this.appearanceOverrides.fill = true; this.backgroundFill = outline ? BackgroundFill.Outline : BackgroundFill.Solid; this.resolved = false; }
  public setGradient(gradient: Gradient.Symb) { this.gradient = gradient; }
  public setGeometryClass(geomClass: DgnFB.GeometryClass) { this.geometryClass = geomClass; }
  public setTransparency(transparency: number) { this.elmTransparency = this.netElmTransparency = this.fillTransparency = this.netFillTransparency = transparency; this.resolved = false; } // NOTE: Sets BOTH element and fill transparency...
  public setFillTransparency(transparency: number) { this.fillTransparency = this.netFillTransparency = transparency; this.resolved = false; }
  public setDisplayPriority(priority: number) { this.elmPriority = this.netPriority = priority; this.resolved = false; } // Set display priority (2d only).
  public setMaterialId(materialId: Id64) { this.appearanceOverrides.material = true; this.materialId = materialId; }
  public setPatternParams(patternParams: PatternParams) { this.pattern = patternParams; }
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

  // //! Compare two GeometryParams for equivalence, i.e. both values are from sub-category appearance or have the same override.
  // bool IsEquivalent(GeometryParamsCR) const;

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

/**
 * Exposes methods for constructing a Graphic from geometric primitives.
 */
export abstract class GraphicBuilder {
  //   //! Parameters used to construct a GraphicBuilder.
  //   struct CreateParams
  //   {
  //     private:
  //     DgnDbR          this.dgndb;
  //     Transform       this.placement;
  //     DgnViewportP    this.viewport;
  //     GraphicType     this.type;

  //     public:
  //     DGNPLATFORM_EXPORT CreateParams(DgnDbR db, TransformCR tf, DgnViewportP vp, GraphicType type);
  //     DGNPLATFORM_EXPORT CreateParams(DgnViewportR vp, TransformCR tf, GraphicType type);

  //         //! Create params for a graphic in world coordinates, not necessarily associated with any viewport.
  //         //! This function is chiefly used for tile generation code as the tolerance for faceting the graphic's geometry is independent of any viewport.
  //         //! If this function is used outside of tile generation context, a default coarse tolerance will be used.
  //         //! To get a tolerance appropriate to a viewport, use the overload accepting a DgnViewport.
  //         static CreateParams Scene(DgnDbR db, TransformCR placement = Transform:: FromIdentity(), DgnViewportP vp = nullptr)
  //     { return CreateParams(db, placement, vp, GraphicType:: Scene); }

  //         //! Create params for a graphic in world coordinates associated with a viewport.
  //         //! This function is chiefly used for code which produces 'normal' decorations and dynamics.
  //         static CreateParams Scene(DgnViewportR vp, TransformCR placement = Transform:: FromIdentity())
  //     { return CreateParams(vp, placement, GraphicType:: Scene); }

  //         //! Create params for a WorldDecoration-type Graphic
  //         //! The faceting tolerance will be computed from the finished graphic's range and the viewport.
  //         static CreateParams WorldDecoration(DgnViewportR vp, TransformCR placement = Transform:: FromIdentity())
  //     { return CreateParams(vp, placement, GraphicType:: WorldDecoration); }

  //         //! Create params for a WorldOverlay-type Graphic
  //         //! The faceting tolerance will be computed from the finished graphic's range and the viewport.
  //         static CreateParams WorldOverlay(DgnViewportR vp, TransformCR placement = Transform:: FromIdentity())
  //     { return CreateParams(vp, placement, GraphicType:: WorldOverlay); }

  //         //! Create params for a ViewOverlay-type Graphic
  //         static CreateParams ViewOverlay(DgnViewportR vp, TransformCR placement = Transform:: FromIdentity())
  //     { return CreateParams(vp, placement, GraphicType:: ViewOverlay); }

  //     //! Create params for a subgraphic
  //     CreateParams SubGraphic(TransformCR placement = Transform:: FromIdentity()) const
  //       { return CreateParams(m_dgndb, placement, this.viewport, this.type);
  //   }

  // }
  // TransformCR GetPlacement() const { return this.placement; }
  // DgnViewportP GetViewport() const { return this.viewport; }
  // GraphicType GetType() const { return this.type; }
  // bool IsViewCoordinates() const { return GraphicType:: ViewBackground == GetType() || GraphicType:: ViewOverlay == GetType(); }
  // bool IsWorldCoordinates() const { return !IsViewCoordinates(); }
  // bool IsSceneGraphic() const { return GraphicType:: Scene == GetType(); }
  // bool IsViewBackground() const { return GraphicType:: ViewBackground == GetType(); }
  // bool IsOverlay() const { return GraphicType:: ViewOverlay == GetType() || GraphicType:: WorldOverlay == GetType(); }

  // void SetPlacement(TransformCR tf) { this.placement = tf; }
  //     };

  // CreateParams    this.createParams;
  public currClip?: ClipVector;

  // GraphicBuilder(CreateParams const& params): this.createParams(params) { }

  public abstract isOpen(): boolean;
  protected abstract _finish(): Graphic;

  /**
   * Get the current GeometryStreamEntryId.
   * @return A GeometryStream entry identifier for the graphics that are currently being drawn.
   */
  public getGeometryStreamEntryId(): GeometryStreamEntryId | undefined { return undefined; }
  /** Set the current GeometryStreamEntryId. */
  public setGeometryStreamEntryId(_id: GeometryStreamEntryId): void { }
  /**
   * Set a GraphicParams to be the "active" GraphicParams for this Graphic.
   * @param graphicParams The new active GraphicParams. All geometry drawn via calls to this Graphic will use them
   * @param geomParams The source GeometryParams if graphicParams was created by cooking geomParams, nullptr otherwise.
   */
  public abstract activateGraphicParams(graphicParams: GraphicParams, geomParams?: GeometryParams): void;

  /**
   * Draw a 3D line string.
   * @param numPoints Number of vertices in points array.
   * @param points Array of vertices in the line string.
   */
  public abstract addLineString(numPoints: number, points: Point3d[]): void;
  /**
   * Draw a 2D line string.
   * @param numPoints Number of vertices in points array.
   * @param points Array of vertices in the line string.
   * @param zDepth Z depth value in local coordinates.
   */
  public abstract addLineString2d(numPoints: number, points: Point2d[], zDepth: number): void;
  /**
   * Draw a 3D point string. A point string is displayed as a series of points, one at each vertex in the array, with no vectors connecting the vertices.
   * @param numPoints Number of vertices in points array.
   * @param points Array of vertices in the point string.
   */
  public abstract addPointString(numPoints: number, points: Point3d[]): void;
  /**
   * Draw a 2D point string. A point string is displayed as a series of points, one at each vertex in the array, with no vectors connecting the vertices.
   * @param numPoints Number of vertices in points array.
   * @param points Array of vertices in the point string.
   * @param zDepth Z depth value.
   */
  public abstract addPointString2d(numPoints: number, points: Point2d[], zDepth: number): void;
  /**
   *  Draw a closed 3D shape.
   * @param numPoints Number of vertices in \c points array. If the last vertex in the array is not the same as the first vertex, an
   *  additional vertex will be added to close the shape.
   * @param points Array of vertices of the shape.
   * @param filled If true, the shape will be drawn filled.
   */
  public abstract addShape(numPoints: number, points: Point3d[], filled: boolean): void;
  /**
   * Draw a 2D shape.
   * @param numPoints Number of vertices in \c points array. If the last vertex in the array is not the same as the first vertex, an
   * additional vertex will be added to close the shape.
   * @param points Array of vertices of the shape.
   * @param zDepth Z depth value.
   * @param filled If true, the shape will be drawn filled.
   */
  public abstract addShape2d(numPoints: number, points: Point2d[], filled: boolean, zDepth: number): void;
  /**
   * Draw a filled triangle strip from 3D points.
   * @param numPoints Number of vertices in \c points array.
   * @param points Array of vertices.
   *  @param asThickenedLine whether the tri-strip represents a thickened line.
   */
  public abstract addTriStrip(numPoints: number, points: Point3d[], asThickenedLine: AsThickenedLine): void;
  /**
   * Draw a filled triangle strip from 2D points.
   * @param numPoints Number of vertices in \c points array.
   * @param points Array of vertices.
   * @param zDepth Z depth value.
   * @param asThickenedLine whether the tri-strip represents a thickened line.
   */
  public abstract addTriStrip2d(numPoints: number, points: Point2d[], asThickenedLine: AsThickenedLine, zDepth: number): void;
  /**
   * Draw a 3D elliptical arc or ellipse.
   * @param ellipse arc data.
   * @param isEllipse If true, and if full sweep, then draw as an ellipse instead of an arc.
   * @param filled If true, and isEllipse is also true, then draw ellipse filled.
   */
  public abstract addArc(ellipse: Arc3d, isEllipse: boolean, filled: boolean): void;
  /**
   * Draw a 2D elliptical arc or ellipse.
   * @param ellipse arc data.
   * @param isEllipse If true, and if full sweep, then draw as an ellipse instead of an arc.
   * @param filled If true, and isEllipse is also true, then draw ellipse filled.
   * @param zDepth Z depth value
   */
  public abstract addArc2d(ellipse: Arc3d, isEllipse: boolean, filled: boolean, zDepth: number): void;
  /** Draw a BSpline curve. */
  public abstract addBSplineCurve(curve: BSplineCurve3d, filled: boolean): void;
  /**
   * Draw a BSpline curve as 2d geometry with display priority.
   * @note Only necessary for non-ICachedDraw calls to support non-zero display priority.
   */
  public abstract addBSplineCurve2d(curve: BSplineCurve3d, filled: boolean, zDepth: number): void;
  // //! Draw a curve vector.
  // public abstract addCurveVector(CurveVectorCR curves, isFilled: boolean): void;
  // //! Draw a curve vector as 2d geometry with display priority.
  // //! @note Only necessary for non-ICachedDraw calls to support non-zero display priority.
  // public abstract addCurveVector2d(CurveVectorCR curves, isFilled: boolean, zDepth: number): void;
  // //! Draw a light-weight surface or solid primitive.
  // //! @remarks Solid primitives can be capped or uncapped, they include cones, torus, box, spheres, and sweeps.
  // public abstract addSolidPrimitive(ISolidPrimitiveCR primitive): void;

  /** Draw a BSpline surface. */
  public abstract addBSplineSurface(surface: BSplineSurface3d): void;
  // //! @remarks Wireframe fill display supported for non-illuminated meshes.
  // public abstract addPolyface(PolyfaceQueryCR meshData, filled: boolean = false): void;
  // //! Draw a BRep surface/solid entity from the solids kernel.
  // public abstract addBody(IBRepEntityCR): void;
  // //! Draw a series of Glyphs.
  // //! @param text Text drawing parameters
  // public abstract addTextString(TextStringCR text): void;
  // //! Draw a series of Glyphs with display priority.
  // //! @param text   Text drawing parameters
  // //! @param zDepth Priority value in 2d
  // public abstract addTextString2d(TextStringCR text, zDepth: number): void;

  public abstract addSubGraphic(graphic: Graphic, trans: Transform, params: GraphicParams, clip?: ClipVector): void;
  public abstract createSubGraphic(trans: Transform, clip?: ClipVector): GraphicBuilder;
  // public wantStrokeLineStyle(LineStyleSymbCR, IFacetOptionsPtr &) { return true; }
  public wantStrokePattern(_pattern: PatternParams) { return true; }
  //   DGNPLATFORM_EXPORT virtual bool _WantPreBakedBody(IBRepEntityCR body); // By default, returns true if parasolid is not supported, or if the body contains no curved faces or edges.

  //   virtual void _AddBSplineCurveR(RefCountedMSBsplineCurveR curve, bool filled) { _AddBSplineCurve(curve, filled); }
  // virtual void _AddBSplineCurve2dR(RefCountedMSBsplineCurveR curve, bool filled, double zDepth) { _AddBSplineCurve2d(curve, filled, zDepth); }
  // virtual void _AddCurveVectorR(CurveVectorR curves, bool isFilled) { _AddCurveVector(curves, isFilled); }
  // virtual void _AddCurveVector2dR(CurveVectorR curves, bool isFilled, double zDepth) { _AddCurveVector2d(curves, isFilled, zDepth); }
  // virtual void _AddSolidPrimitiveR(ISolidPrimitiveR primitive) { _AddSolidPrimitive(primitive); }
  // virtual void _AddBSplineSurfaceR(RefCountedMSBsplineSurfaceR surface) { _AddBSplineSurface(surface); }
  // virtual void _AddPolyfaceR(PolyfaceHeaderR meshData, bool filled = false) { _AddPolyface(meshData, filled); }
  // virtual void _AddBodyR(IBRepEntityR body) { _AddBody(body); }
  // virtual void _AddTextStringR(TextStringR text) { _AddTextString(text); }
  // virtual void _AddTextString2dR(TextStringR text, double zDepth) { _AddTextString2d(text, zDepth); }

  public finish(): Graphic | undefined { assert(this.isOpen()); return this.isOpen() ? this._finish() : undefined; }

  public setCurrentClip(clip?: ClipVector) { this.currClip = clip; }
  public GgtCurrentClip() { return this.currClip; }
  // CreateParams const& GetCreateParams() const { return this.createParams;}
  // DgnDbR GetDgnDb() const { return this.createParams.GetDgnDb();}
  // TransformCR GetLocalToWorldTransform() const { return this.createParams.GetPlacement();}
  // DgnViewportP GetViewport() const { return this.createParams.GetViewport();}
  // bool IsWorldCoordinates() const { return this.createParams.IsWorldCoordinates();}
  // bool IsViewCoordinates() const { return this.createParams.IsViewCoordinates();}
  // bool WantStrokeLineStyle(LineStyleSymbCR symb, IFacetOptionsPtr & facetOptions) { return _WantStrokeLineStyle(symb, facetOptions); }
  // bool WantStrokePattern(PatternParamsCR pattern) { return _WantStrokePattern(pattern); }
  // bool WantPreBakedBody(IBRepEntityCR body) { return _WantPreBakedBody(body); }

  // //! Helper Methods to draw simple SolidPrimitives.
  // void AddTorus(DPoint3dCR center, DVec3dCR vectorX, DVec3dCR vectorY, double majorRadius, double minorRadius, double sweepAngle, bool capped) { AddSolidPrimitive(* ISolidPrimitive:: CreateDgnTorusPipe(DgnTorusPipeDetail(center, vectorX, vectorY, majorRadius, minorRadius, sweepAngle, capped))); }
  // void AddBox(DVec3dCR primary, DVec3dCR secondary, DPoint3dCR basePoint, DPoint3dCR topPoint, double baseWidth, double baseLength, double topWidth, double topLength, bool capped) { AddSolidPrimitive(* ISolidPrimitive:: CreateDgnBox(DgnBoxDetail:: InitFromCenters(basePoint, topPoint, primary, secondary, baseWidth, baseLength, topWidth, topLength, capped))); }

  /** Add DRange3d edges */
  public addRangeBox(range: Range3d) {
    const p: Point3d[] = [];
    for (let i = 0; i < 8; ++i)
      p[i] = new Point3d();

    p[0].x = p[3].x = p[4].x = p[5].x = range.low.x;
    p[1].x = p[2].x = p[6].x = p[7].x = range.high.x;
    p[0].y = p[1].y = p[4].y = p[7].y = range.low.y;
    p[2].y = p[3].y = p[5].y = p[6].y = range.high.y;
    p[0].z = p[1].z = p[2].z = p[3].z = range.low.z;
    p[4].z = p[5].z = p[6].z = p[7].z = range.high.z;

    const tmpPts: Point3d[] = [];
    tmpPts[0] = p[0]; tmpPts[1] = p[1]; tmpPts[2] = p[2];
    tmpPts[3] = p[3]; tmpPts[4] = p[5]; tmpPts[5] = p[6];
    tmpPts[6] = p[7]; tmpPts[7] = p[4]; tmpPts[8] = p[0];

    this.addLineString(9, tmpPts);
    this.addLineString(2, [p[0], p[3]]);
    this.addLineString(2, [p[4], p[5]]);
    this.addLineString(2, [p[1], p[7]]);
    this.addLineString(2, [p[2], p[6]]);
  }

  /** Add DRange2d edges */
  public addRangeBox2d(range: Range2d, zDepth: number) {
    const tmpPts: Point2d[] = [];
    tmpPts[0] = new Point2d(range.low.x, range.low.y);
    tmpPts[1] = new Point2d(range.high.x, range.low.y);
    tmpPts[2] = new Point2d(range.high.x, range.high.y);
    tmpPts[3] = new Point2d(range.low.x, range.high.y);
    tmpPts[4] = tmpPts[0];
    this.addLineString2d(5, tmpPts, zDepth);
  }

  /**
   * Set symbology for decorations that are only used for display purposes. Pickable decorations require a category, must initialize
   * a GeometryParams and cook it into a GraphicParams to have a locatable decoration.
   */
  public setSymbology(lineColor: ColorDef, fillColor: ColorDef, lineWidth: number, linePixels = LinePixels.Solid) {
    this.activateGraphicParams(GraphicParams.fromSymbology(lineColor, fillColor, lineWidth, linePixels));
  }

  /**
   * Set blanking fill symbology for decorations that are only used for display purposes. Pickable decorations require a category, must initialize
   * a GeometryParams and cook it into a GraphicParams to have a locatable decoration.
   */
  public setBlankingFill(fillColor: ColorDef) { this.activateGraphicParams(GraphicParams.FromBlankingFill(fillColor)); }
}

/**
 * Describes the type of a Graphic. Used when creating a GraphicBuilder to specify the purpose of the Graphic.
 * For Graphics like overlays and view background for which depth testing is disabled:
 *  - The individual geometric primitives are rendered in the order in which they were defined in the GraphicBuilder; and
 *  - The individual Graphics within the DecorationList are rendered in the order in which they appear in the list.
 */
export const enum GraphicType {
  /** Renders behind all other graphics. Coordinates: view. RenderMode: smooth. Lighting: none. Z-testing: disabled. */
  ViewBackground,
  /** Renders as if it were part of the scene. Coordinates: world. RenderMode: from view. Lighting: from view. Z-testing: enabled. */
  /** Used for the scene itself, dynamics, and 'normal' decorations. */
  Scene,
  /** Renders within the scene. Coordinates: world. RenderMode: smooth. Lighting: default. Z-testing: enabled */
  WorldDecoration,
  /**
   * Renders atop the scene. Coordinates: world. RenderMode: smooth. Lighting: none. Z-testing: disabled
   * Used for things like the ACS triad and the grid.
   */
  WorldOverlay,
  /**
   * Renders atop the scene. Coordinates: view. RenderMode: smooth. Lighting: none. Z-testing: disabled
   * Used for things like the locate circle.
   */
  ViewOverlay,
}

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
  public world: DecorationList;        // drawn with zbuffer, with default lighting, smooth shading
  public worldOverlay: DecorationList; // drawn in overlay mode, world units
  public viewOverlay: DecorationList;  // drawn in overlay mode, view units
}
