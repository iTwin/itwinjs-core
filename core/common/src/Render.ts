/*---------------------------------------------------------------------------------------------
Gradient/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Views */

import { Id64, JsonUtils, assert } from "@bentley/bentleyjs-core";
import { ColorDef } from "./ColorDef";
import { Light } from "./Lighting";
import { IModel } from "./IModel";
import { Point3d, Point2d, XYAndZ, Transform, Angle, AngleProps, Vector3d } from "@bentley/geometry-core";
import { LineStyle } from "./geometry/LineStyle";
import { CameraProps } from "./ViewProps";
import { QParams3d } from "./QPoint";
import { OctEncodedNormal } from "./OctEncodedNormal";
import { ColorIndex, FeatureIndex } from "./FeatureIndex";
import { AreaPattern } from "./geometry/AreaPattern";

export const enum AsThickenedLine { No = 0, Yes = 1 }

export enum FillFlags {
  None       = 0,               // No fill, e.g. for any non-planar geometry.
  ByView     = 1 << 0,          // Use element fill color, when fill enabled by view
  Always     = 1 << 1,          // Use element fill color, even when fill is disabled by view
  Behind     = 1 << 2,          // Always rendered behind other geometry belonging to the same element. e.g., text background.
  Blanking   = Behind | Always, // Use element fill color, always rendered behind other geometry belonging to the same element.
  Background = 1 << 3,          // Use background color specified by view
}

export enum PolylineTypeFlags {
  Normal  = 0,      // Just an ordinary polyline
  Edge    = 1 << 0, // A polyline used to define the edges of a planar region.
  Outline = 1 << 1, // Like Edge, but the edges are only displayed in wireframe mode when surface fill is undisplayed.
}

/** Flags describing a polyline. A polyline may represent a continuous line string, or a set of discrete points. */
export class PolylineFlags {
  public isDisjoint: boolean;
  public isPlanar: boolean;
  public is2d: boolean;
  public type: PolylineTypeFlags;

  public constructor(is2d = false, isPlanar = false, isDisjoint = false, type = PolylineTypeFlags.Normal) {
    this.isDisjoint = isDisjoint;
    this.isPlanar = isPlanar;
    this.is2d = is2d;
    this.type = type;
  }

  /** Create a PolylineFlags from a serialized numberic representation. */
  public static unpack(value: number): PolylineFlags {
    const isDisjoint = 0 !== (value & 1);
    const isPlanar = 0 !== (value & 2);
    const is2d = 0 !== (value & 4);
    const type: PolylineTypeFlags = (value >> 3);
    assert(type === PolylineTypeFlags.Normal || type === PolylineTypeFlags.Edge || type === PolylineTypeFlags.Outline);

    return new PolylineFlags(is2d, isPlanar, isDisjoint, type);
  }

  public initDefaults() {
    this.isDisjoint = this.isPlanar = this.is2d = false;
    this.type = PolylineTypeFlags.Normal;
  }

  public get isOutlineEdge(): boolean { return PolylineTypeFlags.Outline === this.type; }
  public get isNormalEdge(): boolean { return PolylineTypeFlags.Edge === this.type; }
  public get isAnyEdge(): boolean { return PolylineTypeFlags.Normal !== this.type; }
  public setIsNormalEdge(): void { this.type = PolylineTypeFlags.Edge; }
  public setIsOutlineEdge(): void {this.type = PolylineTypeFlags.Outline; }

  /** Convert these flags to a numeric representation for serialization. */
  public pack(): number {
    let val: number = 0;
    if (this.isDisjoint)
      val += 1;
    if (this.isPlanar)
      val += 1 << 1;
    if (this.is2d)
      val += 1 << 2;
    val += (this.type as number) << 3;
    return val;
  }

  public equals(other: PolylineFlags) {
    return this.type === other.type && this.is2d === other.is2d && this.isPlanar === other.isPlanar && this.isDisjoint === other.isDisjoint;
  }
}

/* An individual polyline which indexes into a shared set of vertices */
export class PolylineData {
  public constructor(public vertIndices: number[] = [], public numIndices = 0, public startDistance = 0, public rangeCenter = new Point3d()) { }

  public isValid(): boolean { return 0 < this.numIndices; }
  public reset(): void { this.numIndices = 0; this.vertIndices = []; this.startDistance = 0; }
  public init(polyline: MeshPolyline) {
    this.numIndices = polyline.indices.length;
    this.vertIndices = 0 < this.numIndices ? polyline.indices : [];
    this.startDistance = polyline.startDistance;
    this.rangeCenter = polyline.rangeCenter;
    return this.isValid();
  }
}

/* Information needed to draw a set of indexed polylines using a shared vertex buffer. */
export class IndexedPolylineArgs {
  public colors = new ColorIndex();
  public features = new FeatureIndex();
  public width = 0;
  public linePixels = LinePixels.Solid;
  public flags: PolylineFlags;
  public constructor(public points: Uint16Array = new Uint16Array(), public numPoints = 0, public lines: PolylineData[] = [], public numLines = 0, public pointParams?: QParams3d,
                     is2d = false, isPlanar = false) {
    this.flags = new PolylineFlags(is2d, isPlanar);
  }
}

export class MeshPolyline {
  public indices: number[] = [];
  public rangeCenter = new Point3d();
  public constructor(public startDistance = 0, rangeCenter?: Point3d, indices?: number[]) {
    if (rangeCenter) { this.rangeCenter = rangeCenter; }
    if (indices) { this.indices = indices.slice(); }
  }
  public addIndex(index: number) { if (this.indices.length === 0 || this.indices[this.indices.length - 1] !== index) this.indices.push(index); }
  public clear() { this.indices = []; }
}

export const enum MeshEdgeFlags {
  Invisible = 1,
  Visible = 0,
}

export class MeshEdge {
  public indices = [0, 0];
  public constructor(index0?: number, index1?: number) {
    if (!index0 || !index1) { return; }
    if (index0 < index1) {
      this.indices[0] = index0;
      this.indices[1] = index1;
    } else {
      this.indices[0] = index1;
      this.indices[1] = index0;
    }
  }
}

export class MeshEdges {
  public visible: MeshEdge[] = [];
  public silhouette: MeshEdge[] = [];
  public polylines: MeshPolyline[] = [];
  public silhouetteNormals = new OctEncodedNormal(0);
  public constructor() { }
}

export class EdgeArgs {
  public edges: MeshEdge[] = [];

  public clear(): void { this.edges = []; }
  public init(meshEdges: MeshEdges) {
    const visible = meshEdges.visible;
    if (visible.length === 0) { return false; }
    this.edges = visible;
    return true;
  }
  public isValid(): boolean { return this.edges.length !== 0; }
  public get numEdges() { return this.edges.length; }
}

export class SilhouetteEdgeArgs extends EdgeArgs {
  public normals?: OctEncodedNormal;
  public clear() { this.normals = undefined; super.clear(); }
  public init(meshEdges: MeshEdges) {
    const silhouette = meshEdges.silhouette;
    if (silhouette.length === 0) { return false; }
    this.edges = silhouette;
    this.normals = meshEdges.silhouetteNormals;
    return true;
  }
}

export class PolylineEdgeArgs {
  public constructor(public lines: PolylineData[] = [] /*, public numLines = 0*/) { }
  public get numLines() { return this.lines.length; }
  public isValid() { return this.lines.length !== 0; }
  public clear() { this.lines = []; }
  public init(polylines: PolylineData[]) {
    this.lines = 0 < this.numLines ? polylines : [];
    return this.isValid();
  }
}

// The vertices of the edges are shared with those of the surface
export class TriMeshArgsEdges {
  public edges = new EdgeArgs();
  public silhouettes = new SilhouetteEdgeArgs();
  public polylines = new PolylineEdgeArgs();
  public width = 0;
  public linePixels = LinePixels.Solid;

  public clear(): void {
    this.edges = new EdgeArgs();
    this.silhouettes = new SilhouetteEdgeArgs();
    this.polylines = new PolylineEdgeArgs();
    this.width = 0;
    this.linePixels = LinePixels.Solid;
  }
  public isValid(): boolean { return this.edges.isValid() || this.silhouettes.isValid() || this.polylines.isValid(); }
}

/* Information needed to draw a triangle mesh and its edges. */
export class TriMeshArgs {
  public edges = new TriMeshArgsEdges();
  public numIndices = 0;
  public vertIndex: number[] = [];
  public numPoints = 0;
  public points?: Uint16Array;
  public normals: OctEncodedNormal[] = [];
  public textureUv: Point2d[] = [];
  public texture?: Texture;
  public colors = new ColorIndex();
  public features = new FeatureIndex();
  public pointParams?: QParams3d;
  public material?: Material;
  public fillFlags = FillFlags.None;
  public isPlanar = false;
  public is2d = false;

  // public toPolyface(): IndexedPolyface {
  //   let polyFace = IndexedPolyface.create(); // PolyfaceHeaderPtr polyFace = PolyfaceHeader::CreateFixedBlockIndexed(3);
  //   let pointIndex = polyFace.pointCount;
  //   pointIndex. // In Progress!!
  // }
}

/**
 * A renderer-specific object that can be placed into a display list.
 */
export abstract class RenderGraphic {
  constructor(public readonly iModel: IModel) { }
}

/**
 * The "cooked" material and symbology for a RenderGraphic. This determines the appearance
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

export const enum AntiAliasPref { Detect = 0, On = 1, Off = 2 }

export const enum RenderMode {
  Wireframe = 0,
  HiddenLine = 3,
  SolidFill = 4,
  SmoothShade = 6,
}

export class GraphicList {
  public list: RenderGraphic[] = [];
  public isEmpty(): boolean { return this.list.length === 0; }
  public clear() { this.list.length = 0; }
  public add(graphic: RenderGraphic) { this.list.push(graphic); }
  public getCount(): number { return this.list.length; }
  public at(index: number): RenderGraphic | undefined { return this.list[index]; }
  public get length(): number { return this.list.length; }
  constructor(...graphics: RenderGraphic[]) { graphics.forEach(this.add.bind(this)); }
}

export class DecorationList extends GraphicList {
}

/**
 * A set of GraphicLists of various types of RenderGraphics that are "decorated" into the Render::Target,
 * in addition to the Scene.
 */
export class Decorations {
  public viewBackground?: RenderGraphic; // drawn first, view units, with no zbuffer, smooth shading, default lighting. e.g., a skybox
  public normal?: GraphicList;       // drawn with zbuffer, with scene lighting
  public world?: DecorationList;        // drawn with zbuffer, with default lighting, smooth shading
  public worldOverlay?: DecorationList; // drawn in overlay mode, world units
  public viewOverlay?: DecorationList;  // drawn in overlay mode, view units
}

export class GraphicBranch {
  public get entries(): RenderGraphic[] { return this._entries; }
  constructor(private _entries: RenderGraphic[] = [],
              private _viewFlagOverrides: ViewFlag.Overrides = new ViewFlag.Overrides()) {}
  public add(graphic: RenderGraphic): void { this._entries.push(graphic); }
  public addRange(graphics: RenderGraphic[]): void { graphics.forEach(this.add); }
  public setViewFlagOverrides(ovr: ViewFlag.Overrides) { this._viewFlagOverrides = ovr; }
  public getViewFlags(flags: ViewFlags): ViewFlags { return this._viewFlagOverrides.apply(flags); }
  public clear() { this._entries = []; }
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
  public clone(): ViewFlags { return ViewFlags.createFrom(this); }
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
    public apply(base: ViewFlags): ViewFlags {
      if (!this.anyOverridden())
        return base;

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
      return base;
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
    Thematic = 6,
  }

  /** @hidden Gradient settings specific to thematic mesh display */
  export interface ThematicProps {
    mode?: number;
    stepCount?: number;
    margin?: number;
    marginColor?: ColorDef;
    colorScheme?: number;
    rangeLow?: number;
    rangeHigh?: number;
  }

  /** Gradient fraction value to [[ColorDef]] pair */
  export interface KeyColorProps {
    /** Fraction from 0.0 to 1.0 to denote position along gradient */
    value: number;
    /** Color value for given fraction */
    color: ColorDef;
  }

  export class KeyColor implements KeyColorProps {
    public value: number;
    public color: ColorDef;
    public constructor(json: KeyColorProps) {
      this.value = json.value;
      this.color = json.color;
    }
  }

  /** Multi-color area fill defined by a range of colors that vary by position */
  export interface SymbProps {
    /** Gradient type, must be set to something other than [[Gradient.Mode.None]] in order to display fill */
    mode: Mode;
    /** Gradient flags to enable outline display and invert color fractions */
    flags?: Flags;
    /** Gradient rotation angle */
    angle?: AngleProps;
    /** Gradient tint value from 0.0 to 1.0, only used when [[GradientKeyColorProps]] size is 1 */
    tint?: number;
    /** Gradient shift value from 0.0 to 1.0 */
    shift?: number;
    /** Gradient fraction value/color pairs, 1 minimum (uses tint for 2nd color), 8 maximum */
    keys: KeyColorProps[];
    /** @hidden Settings applicable to meshes and Gradient.Mode.Thematic only */
    thematicSettings?: ThematicProps;
  }

  export class Symb implements SymbProps {
    public mode = Mode.None;
    public flags?: Flags;
    public angle?: Angle;
    public tint?: number;
    public shift?: number;
    public keys: KeyColor[] = [];

    /** create a GradientSymb from a json object. */
    public static fromJSON(json?: SymbProps) {
      const result = new Symb();
      if (!json)
        return result;
      result.mode = json.mode;
      result.flags = json.flags;
      result.angle = json.angle ? Angle.fromJSON(json.angle) : undefined;
      result.tint = json.tint;
      result.shift = json.shift;
      json.keys.forEach((key) => result.keys.push(key));
      return result;
    }

    /** Add properties to an object for serializing to JSON */
    public toJSON(): SymbProps {
      return this.toJSON() as SymbProps;
    }

    public clone(): Symb {
      const retVal = new Symb();
      retVal.mode = this.mode;
      retVal.flags = this.flags;
      retVal.angle = this.angle;
      retVal.tint = this.tint;
      retVal.shift = this.shift;
      this.keys.forEach((key) => retVal.keys.push(key));
      return retVal;
    }

    public isEqualTo(other: Symb): boolean {
      if (this === other)
        return true; // Same pointer
      if (this.mode !== other.mode)
        return false;
      if (this.flags !== other.flags)
        return false;
      if (this.tint !== other.tint)
        return false;
      if (this.shift !== other.shift)
        return false;
      if ((this.angle === undefined) !== (other.angle === undefined))
        return false;
      if (this.angle && !this.angle.isAlmostEqualNoPeriodShift(other.angle!))
        return false;
      for (let i = 0; i < this.keys.length; ++i) {
        if (this.keys[i].value !== other.keys[i].value)
          return false;
        if (!this.keys[i].color.equals(other.keys[i].color))
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

export class Material {
}

/**
 * Geometry display properties used to override or augment the SubCategory Appearance.
 */
export class GeometryParams {
  public materialId?: Id64; // render material Id.
  public elmPriority?: number; // display priority (applies to 2d only)
  public weight?: number;
  public lineColor?: ColorDef;
  public fillColor?: ColorDef; // fill color (applicable only if filled)
  public backgroundFill?: BackgroundFill; // support for fill using the view's background color, default BackgroundFill.None
  public fillDisplay?: FillDisplay; // whether or not the element should be displayed filled, default FillDisplay.Never
  public elmTransparency?: number; // transparency, 1.0 == completely transparent
  public fillTransparency?: number;  // fill transparency, 1.0 == completely transparent
  public geometryClass?: GeometryClass; // geometry class, default GeometryClass.Primary
  public styleInfo?: LineStyle.Info; // line style id plus modifiers.
  public gradient?: Gradient.Symb; // gradient fill settings.
  public pattern?: AreaPattern.Params; // area pattern settings.

  constructor(public categoryId: Id64, public subCategoryId = new Id64()) { if (!subCategoryId.isValid()) this.subCategoryId = IModel.getDefaultSubCategoryId(categoryId); }

  public clone(): GeometryParams {
    const retVal = new GeometryParams(this.categoryId, this.subCategoryId);
    retVal.materialId = this.materialId;
    retVal.elmPriority = this.elmPriority;
    retVal.weight = this.weight;
    retVal.lineColor = this.lineColor ? this.lineColor.clone() : undefined;
    retVal.fillColor = this.fillColor ? this.fillColor.clone() : undefined;
    retVal.backgroundFill = this.backgroundFill;
    retVal.fillDisplay = this.fillDisplay;
    retVal.elmTransparency = this.elmTransparency;
    retVal.fillTransparency = this.fillTransparency;
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
    this.materialId = undefined;
    this.elmPriority = undefined;
    this.weight = undefined;
    this.lineColor = undefined;
    this.fillColor = undefined;
    this.backgroundFill = undefined;
    this.fillDisplay = undefined;
    this.elmTransparency = undefined;
    this.fillTransparency = undefined;
    this.geometryClass = undefined;
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

    if (this.elmPriority !== other.elmPriority)
      return false;
    if (this.elmTransparency !== other.elmTransparency)
      return false;
    if (this.fillTransparency !== other.fillTransparency)
      return false;

    if ((this.lineColor === undefined) !== (other.lineColor === undefined))
      return false;
    if (this.lineColor && !this.lineColor.equals(other.lineColor!))
      return false;

    if (this.weight !== other.weight)
      return false;

    if ((this.materialId === undefined) !== (other.materialId === undefined))
      return false;
    if (this.materialId && !this.materialId.equals(other.materialId!))
      return false;

    if ((this.styleInfo === undefined) !== (other.styleInfo === undefined))
      return false;
    if (this.styleInfo && !this.styleInfo.isEqualTo(other.styleInfo!))
      return false;

    if (this.fillDisplay !== other.fillDisplay)
      return false;

    if (this.fillDisplay !== undefined && this.fillDisplay !== FillDisplay.Never) {
      if ((this.gradient === undefined) !== (other.gradient === undefined))
        return false;
      if (this.gradient && !this.gradient.isEqualTo(other.gradient!))
        return false;
      if (this.backgroundFill !== other.backgroundFill)
        return false;
      if (this.backgroundFill === undefined || this.backgroundFill === BackgroundFill.None) {
        if ((this.fillColor === undefined) !== (other.fillColor === undefined))
          return false;
        if (this.fillColor && !this.fillColor.equals(other.fillColor!))
          return false;
      }
    }

    if ((this.pattern === undefined) !== (other.pattern === undefined))
      return false;
    if (this.pattern && !this.pattern.isEqualTo(other.pattern!))
      return false;

    return true;
  }

  /** Setting the Category Id also sets the SubCategory to the default. */
  public setCategoryId(categoryId: Id64, clearAppearanceOverrides = true) {
    this.categoryId = categoryId;
    this.subCategoryId = IModel.getDefaultSubCategoryId(categoryId);
    if (clearAppearanceOverrides)
      this.resetAppearance();
  }
  public setSubCategoryId(subCategoryId: Id64, clearAppearanceOverrides = true) {
    this.subCategoryId = subCategoryId;
    if (clearAppearanceOverrides)
      this.resetAppearance();
  }

  /**  Get whether this GeometryParams contains information that needs to be transformed (ex. to apply local to world). */
  public isTransformable() { return this.pattern || this.styleInfo; }

  /**  Transform GeometryParams data like PatternParams and LineStyleInfo. */
  public applyTransform(transform: Transform) {
    if (this.pattern)
      this.pattern.applyTransform(transform);
    if (this.styleInfo && this.styleInfo.styleMod)
      this.styleInfo.styleMod.applyTransform(transform);
  }
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
 * Describes a "feature" within a batched RenderGraphic. A batched RenderGraphic can
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
 * Defines a look-up table for Features within a batched RenderGraphic. Consecutive 32-bit
 * indices are assigned to each unique Feature. Primitives within the RenderGraphic can
 * use per-vertex indices to specify the distribution of Features within the primitive.
 * A FeatureTable can be shared amongst multiple primitives within a single RenderGraphic, and
 * amongst multiple sub-Graphics of a RenderGraphic.
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

export class TextureCreateParams {
  constructor(public key: Id64,
              public pitch: number = 0,
              public isTileSection: boolean = false,
              public isGlyph: boolean = false,
              public isRGBE: boolean = false) {}
}

/** A Texture for rendering */
export class Texture {
  public get key(): Id64 { return this.params.key; }
  public get isGlyph(): boolean { return this.params.isGlyph; }
  constructor(public params: TextureCreateParams) {}
  // public getImageSource(): ImageSource;
}

export namespace ImageLight {
  export class Solar {
    constructor(public direction: Vector3d = new Vector3d(),
                public color: ColorDef = ColorDef.white,
                public intensity: number = 0) {}
  }
}

/** A list of Render::Lights, plus the f-stop setting for the camera */
export class SceneLights {
  private _list: Light[] = [];
  public get isEmpty(): boolean { return this._list.length === 0; }
  constructor(public imageBased: { environmentalMap: Texture, diffuseImage: Texture, solar: ImageLight.Solar },
              public fstop: number = 0, // must be between -3 and +3
              ) {}
  public addLight(light: Light): void { if (light.isValid()) this._list.push(light); }
}
