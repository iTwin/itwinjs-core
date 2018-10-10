/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Rendering */

import { Id64, Id64String, JsonUtils, assert, IndexMap, IndexedValue, Comparable, compare, compareNumbers, compareStrings, IDisposable } from "@bentley/bentleyjs-core";
import { ColorDef, ColorDefProps } from "./ColorDef";
import { Light } from "./Lighting";
import { IModel } from "./IModel";
import { Point3d, XYAndZ, Transform, Angle, AngleProps, Vector3d, ClipPlane, Point2d, IndexedPolyfaceVisitor, PolyfaceVisitor, Range1d } from "@bentley/geometry-core";
import { LineStyle } from "./geometry/LineStyle";
import { CameraProps } from "./ViewProps";
import { OctEncodedNormalPair } from "./OctEncodedNormal";
import { AreaPattern } from "./geometry/AreaPattern";
import { Frustum } from "./Frustum";
import { ImageBuffer, ImageBufferFormat } from "./Image";
import { ViewFlagProps } from "./ViewProps";

/** Flags indicating whether and how the interiors of closed planar regions is displayed within a view. */
export enum FillFlags {
  /** No fill */
  None = 0,
  /** Use the element's fill color when fill is enabled in the view's [[ViewFlags]]. */
  ByView = 1 << 0,
  /** Use the element's fill color even when fill is disabled in the view's [[ViewFlags]]. */
  Always = 1 << 1,
  /** Render the fill behind other geometry belonging to the same element.
   * For example if an element's geometry contains text with background fill, the text always renders in front of the fill.
   */
  Behind = 1 << 2,
  /** Combines Behind and Always flags. */
  Blanking = Behind | Always,
  /** Use the view's background color instead of the element's fill color. */
  Background = 1 << 3,
}

/** @hidden */
export enum PolylineTypeFlags {
  Normal = 0,      // Just an ordinary polyline
  Edge = 1 << 0, // A polyline used to define the edges of a planar region.
  Outline = 1 << 1, // Like Edge, but the edges are only displayed in wireframe mode when surface fill is undisplayed.
}

/** Flags describing a polyline. A polyline may represent a continuous line string, or a set of discrete points.
 * @hidden
 */
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

  public clone(): PolylineFlags { return new PolylineFlags(this.is2d, this.isPlanar, this.isDisjoint, this.type); }

  /** Create a PolylineFlags from a serialized numeric representation. */
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
  public setIsOutlineEdge(): void { this.type = PolylineTypeFlags.Outline; }

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

/** @hidden */
export class PolylineData {
  public vertIndices: number[];
  public numIndices: number;
  public startDistance: number;
  public constructor(vertIndices: number[] = [], numIndices = 0, startDistance = 0) {
    this.vertIndices = vertIndices;
    this.numIndices = numIndices;
    this.startDistance = startDistance;
  }
  public get isValid(): boolean { return 0 < this.numIndices; }
  public reset(): void { this.numIndices = 0; this.vertIndices = []; this.startDistance = 0; }
  public init(polyline: MeshPolyline) {
    this.numIndices = polyline.indices.length;
    this.vertIndices = 0 < this.numIndices ? polyline.indices : [];
    this.startDistance = polyline.startDistance;
    return this.isValid;
  }
}

/** @hidden */
export class MeshPolyline {
  public readonly indices: number[];
  public readonly startDistance: number;
  public constructor(startDistance: number = 0, indices: number[] = []) {
    this.indices = indices.slice();
    this.startDistance = startDistance;
  }
  public addIndex(index: number) {
    const { indices } = this;
    if (indices.length === 0 || indices[indices.length - 1] !== index)
      indices.push(index);
  }
  public clear() { this.indices.length = 0; }
}

/** @hidden */
export class MeshPolylineList extends Array<MeshPolyline> { constructor(...args: MeshPolyline[]) { super(...args); } }

/** @hidden */
export class MeshEdge {
  public indices = [0, 0];
  public constructor(index0?: number, index1?: number) {
    if (undefined === index0 || undefined === index1) { return; }
    if (index0 < index1) {
      this.indices[0] = index0;
      this.indices[1] = index1;
    } else {
      this.indices[0] = index1;
      this.indices[1] = index0;
    }
  }
}

/** @hidden */
export class MeshEdges {
  public visible: MeshEdge[] = [];
  public silhouette: MeshEdge[] = [];
  public polylines: MeshPolylineList = new MeshPolylineList();
  public silhouetteNormals: OctEncodedNormalPair[] = [];
  public constructor() { }
}

/** @hidden */
export class EdgeArgs {
  public edges?: MeshEdge[];

  public init(meshEdges?: MeshEdges): boolean {
    this.clear();
    if (undefined !== meshEdges && 0 < meshEdges.visible.length)
      this.edges = meshEdges.visible;

    return this.isValid;
  }

  public clear(): void { this.edges = undefined; }
  public get isValid(): boolean { return 0 < this.numEdges; }
  public get numEdges() { return undefined !== this.edges ? this.edges.length : 0; }
}

/** @hidden */
export class SilhouetteEdgeArgs extends EdgeArgs {
  public normals?: OctEncodedNormalPair[];

  public init(meshEdges?: MeshEdges) {
    this.clear();
    if (undefined !== meshEdges && 0 < meshEdges.silhouette.length) {
      this.edges = meshEdges.silhouette;
      this.normals = meshEdges.silhouetteNormals;
    }

    return this.isValid;
  }

  public clear() { this.normals = undefined; super.clear(); }
}

/** @hidden */
export class PolylineEdgeArgs {
  public lines?: PolylineData[];

  public constructor(lines?: PolylineData[]) { this.init(lines); }

  public init(lines?: PolylineData[]): boolean {
    this.lines = undefined !== lines && 0 < lines.length ? lines : undefined;
    return this.isValid;
  }

  public get numLines() { return undefined !== this.lines ? this.lines.length : 0; }
  public get isValid() { return this.numLines > 0; }
  public clear() { this.lines = undefined; }
}

/** Represents a texture image applied to a surface during rendering.
 * A RenderTexture is typically - but not always - associated with a [[RenderMaterial]].
 * @see [[RenderSystem]] for functions used to create RenderTextures.
 */
export abstract class RenderTexture implements IDisposable {
  /** A string uniquely identifying this texture within the context of an [[IModelConnection]]. Typically this is the element ID of the corresponding Texture element in the [[IModelDb]].
   * Textures created on the front-end generally have no key.
   */
  public readonly key: string | undefined;
  /** Indicates the type of texture. */
  public readonly type: RenderTexture.Type;
  /** Indicates that some object is managing the lifetime of this texture and will take care of calling its dispose function appropriately.
   * An unowned texture associated with a [[RenderGraphic]] will be disposed when the RenderGraphic is disposed.
   */
  public readonly isOwned: boolean;

  public get isTileSection(): boolean { return RenderTexture.Type.TileSection === this.type; }
  public get isGlyph(): boolean { return RenderTexture.Type.Glyph === this.type; }
  public get isSkyBox(): boolean { return RenderTexture.Type.SkyBox === this.type; }

  protected constructor(params: RenderTexture.Params) {
    this.key = params.key;
    this.type = params.type;
    this.isOwned = params.isOwned;
  }

  /** Releases any WebGL resources owned by this texture.
   * If [[RenderTexture.isOwned]] is true, then whatever object claims ownership of the texture is reponsible for disposing of it when it is no longer needed.
   * Otherwise, imodeljs will handle its disposal.
   */
  public abstract dispose(): void;
}

/** Represents a texture image applied to a surface during rendering.
 * A RenderTexture is typically - but not always - associated with a [[RenderMaterial]].
 * @see [[RenderSystem]] for functions used to create RenderTextures.
 */
export namespace RenderTexture {
  /** Enumerates the types of [[RenderTexture]]s. */
  export const enum Type {
    /** An image applied to a surface, with support for mip-mapping and repeating. */
    Normal,
    /** An image containing any number of text glyphs, used for efficiently rendering readable small text. */
    Glyph,
    /** A non-repeating image with no mip-maps, used for example for tiled map imagery. */
    TileSection,
    /** A three-dimensional texture used for rendering a skybox. */
    SkyBox,
  }

  /** Parameters used to construct a [[RenderTexture]]. */
  export class Params {
    /** A string uniquely identifying this texture within the context of an [[IModelConnection]]. Typically this is the element ID of the corresponding Texture element in the [[IModelDb]].
     * Textures created on the front-end generally have no key.
     */
    public readonly key?: string; // The ID of a persistent texture
    /** Indicates the type of texture. */
    public readonly type: Type;
    /** Indicates that some object is managing the lifetime of this texture and will take care of calling its dispose function appropriately.
     * An unowned texture associated with a [[RenderGraphic]] will be disposed when the RenderGraphic is disposed.
     */
    public readonly isOwned: boolean; // For unnamed textures

    public constructor(key?: string, type: Type = Type.Normal, isOwned: boolean = false) {
      this.key = key;
      this.type = type;
      this.isOwned = isOwned;
    }

    public get isTileSection(): boolean { return Type.TileSection === this.type; }
    public get isGlyph(): boolean { return Type.Glyph === this.type; }
    public get isSkyBox(): boolean { return Type.SkyBox === this.type; }

    /** Obtain a RenderTexture params object with default values. */
    public static readonly defaults = new Params();
  }
}

/** Represents a material which can be applied to a surface to control aspects of its appearance such as color, reflectivity, texture, and so on. */
export abstract class RenderMaterial {
  /** If the material originated from a Material element in the [[IModelDb]], the ID of that element. */
  public readonly key?: string;
  /** Describes how to map an image to a surface to which this material is applied. */
  public readonly textureMapping?: TextureMapping;

  protected constructor(params: RenderMaterial.Params) {
    this.key = params.key;
    this.textureMapping = params.textureMapping;
  }

  public get hasTexture(): boolean { return this.textureMapping !== undefined && this.textureMapping.texture !== undefined; }
}

/** Represents a material which can be applied to a surface to control aspects of its appearance such as color, reflectivity, and so on. */
export namespace RenderMaterial {
  /** Parameters used to construct a [[RenderMaterial]] */
  export class Params {
    /** If the material originates from a Material element in the [[IModelDb]], the ID of that element. */
    public key?: string;
    public diffuseColor?: ColorDef;
    public specularColor?: ColorDef;
    public emissiveColor?: ColorDef;
    public reflectColor?: ColorDef;
    public textureMapping?: TextureMapping;
    public diffuse: number = 0.6;
    public specular: number = .4;
    public specularExponent: number = 13.5;
    public reflect: number = 0.0;
    public transparency: number = 0.0;
    public refract: number = 1.0;
    public ambient: number = .3;
    public shadows = true;

    public constructor(key?: string) { this.key = key; }

    /** Obtain an immutable instance of a RenderMaterial with all default properties. */
    public static readonly defaults = new Params();

    /** Create a RenderMaterial params object using specified key and ColorDef values, as well as an optional texture mapping. */
    public static fromColors(key?: string, diffuseColor?: ColorDef, specularColor?: ColorDef, emissiveColor?: ColorDef, reflectColor?: ColorDef, textureMap?: TextureMapping): Params {
      const materialParams = new Params();
      materialParams.key = key;
      materialParams.diffuseColor = diffuseColor;
      materialParams.specularColor = specularColor;
      materialParams.emissiveColor = emissiveColor;
      materialParams.reflectColor = reflectColor;
      materialParams.textureMapping = textureMap;
      return materialParams;
    }
  }
}
Object.freeze(RenderMaterial.Params.defaults);

/** @hidden */
export namespace ImageLight {
  export class Solar {
    constructor(public direction: Vector3d = new Vector3d(),
      public color: ColorDef = ColorDef.white,
      public intensity: number = 0) { }
  }
}

/**
 * The "cooked" material and symbology for a [[RenderGraphic]]. This determines the appearance
 * (e.g. texture, color, width, linestyle, etc.) used to draw Geometry.
 */
export class GraphicParams {
  public fillFlags = FillFlags.None;
  public linePixels = LinePixels.Solid;
  public rasterWidth = 1;
  public readonly lineColor = new ColorDef();
  public readonly fillColor = new ColorDef();
  public trueWidthStart = 0;
  public trueWidthEnd = 0;
  public lineTexture?: RenderTexture;
  public material?: RenderMaterial;
  public gradient?: Gradient.Symb;

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

  public static fromBlankingFill(fillColor: ColorDef): GraphicParams {
    const graphicParams = new GraphicParams();
    graphicParams.setFillColor(fillColor);
    graphicParams.fillFlags = FillFlags.Blanking;
    return graphicParams;
  }
}

export const enum AntiAliasPref { Detect = 0, On = 1, Off = 2 }

/**
 * Enumerates the available rendering modes. The rendering mode chiefly controls whether and how surfaces and their edges are drawn.
 * Generally speaking,
 *  - Wireframe draws only edges.
 *  - SmoothShade draws only surfaces.
 *  - HiddenLine and SolidFill draw both surfaces and edges.
 *  - Lighting is only applied in SmoothShade mode.
 *
 * The [[FillFlags]] associated with planar regions controls whether and how the region's interior area is displayed in Wireframe mode.
 * [[ViewFlags]] has options for enabling display of visible and/or hidden edges in SmoothShade mode.
 * [[HiddenLine.Settings]] allow aspects of edge and surface symbology to be overridden within a view.
 */
export const enum RenderMode {
  /** Render only edges, no surfaces, with exceptions for planar regions with [[FillFlags]] set up to render the surface in wireframe mode. */
  Wireframe = 0,
  /** Render only surfaces, no edges, with lighting. */
  SmoothShade = 6,
  /** Render edges and surfaces. Surfaces are drawn using the view's background color instead of the element's fill color. */
  HiddenLine = 3,
  /** Render edges and surfaces. */
  SolidFill = 4,
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
  public get isFocusValid() { return this.focusDist > 0.0 && this.focusDist < 1.0e14; }
  public getFocusDistance() { return this.focusDist; }
  public setFocusDistance(dist: number) { this.focusDist = dist; }
  public get isLensValid() { return Camera.isValidLensAngle(this.lens); }
  public validateLens() { Camera.validateLensAngle(this.lens); }
  public getLensAngle() { return this.lens; }
  public setLensAngle(angle: Angle) { this.lens.setFrom(angle); }
  public getEyePoint() { return this.eye; }
  public setEyePoint(pt: XYAndZ) { this.eye.setFrom(pt); }
  public get isValid() { return this.isLensValid && this.isFocusValid; }
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

/** Flags for controlling how graphics appear within a View. */
export class ViewFlags {
  /** The [[RenderMode]] of the view. */
  public renderMode: RenderMode = RenderMode.Wireframe;
  /** Shows or hides dimensions. */
  public dimensions: boolean = true;
  /** Shows or hides pattern geometry. */
  public patterns: boolean = true;
  /** Controls whether non-zero line weights are used or display using weight 0. */
  public weights: boolean = true;
  /** Controls whether custom line styles are used (e.g. control whether elements with custom line styles draw normally, or as solid lines). */
  public styles: boolean = true;
  /** Controls whether element transparency is used (e.g. control whether elements with transparency draw normally, or as opaque). */
  public transparency: boolean = true;
  /** @hidden This doesn't belong here - it is not persistent. */
  public continuousRendering: boolean = false;
  /** Controls whether the fills on filled elements are displayed. */
  public fill: boolean = true;
  /** Controls whether to display texture maps for material assignments. When off only material color is used for display. */
  public textures: boolean = true;
  /** Controls whether materials are used (e.g. control whether geometry with materials draw normally, or as if it has no material). */
  public materials: boolean = true;
  /** Shows or hides the ACS triad. */
  public acsTriad: boolean = false;
  /** Shows or hides the grid. The grid settings are a design file setting. */
  public grid: boolean = false;
  /** Shows or hides visible edges in the shaded render mode. */
  public visibleEdges: boolean = false;
  /** Shows or hides hidden edges in the shaded render mode. */
  public hiddenEdges: boolean = false;
  /** Controls whether the source lights in spatial models are used */
  public sourceLights: boolean = false;
  /** Controls whether camera (ambient, portrait, flashbulb) lights are used. */
  public cameraLights: boolean = false;
  /** Controls whether sunlight used */
  public solarLight: boolean = false;
  /** Shows or hides shadows. */
  public shadows: boolean = false;
  /** Controls whether the clip volume is applied. */
  public clipVolume: boolean = true;
  /** Shows or hides construction class geometry. */
  public constructions: boolean = false;
  /** Draw all graphics in a single color */
  public monochrome: boolean = false;
  /** Ignore geometry maps */
  public noGeometryMap: boolean = false;
  /** Display background map */
  public backgroundMap: boolean = false;
  /** Use material colors for hidden lines */
  public hLineMaterialColors: boolean = false;
  /** @hidden 0=none, 1=generate mask, 2=use mask */
  public edgeMask: number = 0;

  public clone(out?: ViewFlags): ViewFlags { return ViewFlags.createFrom(this, out); }
  public static createFrom(other?: ViewFlags, out?: ViewFlags): ViewFlags {
    const val = undefined !== out ? out : new ViewFlags();
    if (other) {
      val.renderMode = other.renderMode;
      val.dimensions = other.dimensions;
      val.patterns = other.patterns;
      val.weights = other.weights;
      val.styles = other.styles;
      val.transparency = other.transparency;
      val.continuousRendering = other.continuousRendering;
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
      val.clipVolume = other.clipVolume;
      val.constructions = other.constructions;
      val.monochrome = other.monochrome;
      val.noGeometryMap = other.noGeometryMap;
      val.hLineMaterialColors = other.hLineMaterialColors;
      val.backgroundMap = other.backgroundMap;
      val.edgeMask = other.edgeMask;
    }
    return val;
  }

  /** @hidden */
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

  public toJSON(): ViewFlagProps {
    const out: ViewFlagProps = {};
    if (!this.constructions) out.noConstruct = true;
    if (!this.dimensions) out.noDim = true;
    if (!this.patterns) out.noPattern = true;
    if (!this.weights) out.noWeight = true;
    if (!this.styles) out.noStyle = true;
    if (!this.transparency) out.noTransp = true;
    if (this.continuousRendering) out.contRend = true;
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
    if (this.clipVolume) out.clipVol = true;
    if (this.hLineMaterialColors) out.hlMatColors = true;
    if (this.monochrome) out.monochrome = true;
    if (this.backgroundMap) out.backgroundMap = true;
    if (this.edgeMask !== 0) out.edgeMask = this.edgeMask;

    out.renderMode = this.renderMode;
    return out;
  }

  public static fromJSON(json?: ViewFlagProps): ViewFlags {
    const val = new ViewFlags();
    if (!json)
      return val;

    val.constructions = !JsonUtils.asBool(json.noConstruct);
    val.dimensions = !JsonUtils.asBool(json.noDim);
    val.patterns = !JsonUtils.asBool(json.noPattern);
    val.weights = !JsonUtils.asBool(json.noWeight);
    val.styles = !JsonUtils.asBool(json.noStyle);
    val.transparency = !JsonUtils.asBool(json.noTransp);
    val.continuousRendering = JsonUtils.asBool(json.contRend);
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
    val.clipVolume = JsonUtils.asBool(json.clipVol);
    val.monochrome = JsonUtils.asBool(json.monochrome);
    val.edgeMask = JsonUtils.asInt(json.edgeMask);
    val.hLineMaterialColors = JsonUtils.asBool(json.hlMatColors);
    val.backgroundMap = JsonUtils.asBool(json.backgroundMap);

    const renderModeValue = JsonUtils.asInt(json.renderMode);
    if (renderModeValue < RenderMode.HiddenLine)
      val.renderMode = RenderMode.Wireframe;
    else if (renderModeValue > RenderMode.SolidFill)
      val.renderMode = RenderMode.SmoothShade;
    else
      val.renderMode = renderModeValue;

    return val;
  }

  public equals(other: ViewFlags): boolean {
    return this.renderMode === other.renderMode
      && this.dimensions === other.dimensions
      && this.patterns === other.patterns
      && this.weights === other.weights
      && this.styles === other.styles
      && this.transparency === other.transparency
      && this.continuousRendering === other.continuousRendering
      && this.fill === other.fill
      && this.textures === other.textures
      && this.materials === other.materials
      && this.acsTriad === other.acsTriad
      && this.grid === other.grid
      && this.visibleEdges === other.visibleEdges
      && this.hiddenEdges === other.hiddenEdges
      && this.sourceLights === other.sourceLights
      && this.cameraLights === other.cameraLights
      && this.solarLight === other.solarLight
      && this.shadows === other.shadows
      && this.clipVolume === other.clipVolume
      && this.constructions === other.constructions
      && this.monochrome === other.monochrome
      && this.noGeometryMap === other.noGeometryMap
      && this.hLineMaterialColors === other.hLineMaterialColors
      && this.backgroundMap === other.backgroundMap
      && this.edgeMask === other.edgeMask;
  }
}

/** @hidden */
export namespace ViewFlag {
  /** @hidden */
  export const enum PresenceFlag {
    kRenderMode,
    kText,
    kDimensions,
    kPatterns,
    kWeights,
    kStyles,
    kTransparency,
    kContinuousRendering,
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
    kBackgroundMap,
  }

  /**
   * Overrides a subset of ViewFlags.
   * @hidden
   */
  export class Overrides {
    private _present = 0;
    private readonly _values = new ViewFlags();

    public setPresent(flag: PresenceFlag) { this._present |= (1 << flag); }
    public isPresent(flag: PresenceFlag): boolean { return 0 !== (this._present & (1 << flag)); }

    /** Construct a ViewFlagsOverrides which overrides all flags to match the specified ViewFlags, or overrides nothing if no ViewFlags are supplied. */
    constructor(flags?: ViewFlags) {
      if (undefined !== flags)
        this.overrideAll(flags);
    }

    public overrideAll(flags?: ViewFlags) {
      ViewFlags.createFrom(flags, this._values);
      this._present = 0xffffffff;
    }

    public clone(out?: Overrides) {
      const result = undefined !== out ? out : new Overrides();
      result.copyFrom(this);
      return result;
    }
    public copyFrom(other: Overrides): void {
      other._values.clone(this._values);
      this._present = other._present;
    }

    public setShowDimensions(val: boolean) { this._values.dimensions = val; this.setPresent(PresenceFlag.kDimensions); }
    public setShowPatterns(val: boolean) { this._values.patterns = val; this.setPresent(PresenceFlag.kPatterns); }
    public setShowWeights(val: boolean) { this._values.weights = val; this.setPresent(PresenceFlag.kWeights); }
    public setShowStyles(val: boolean) { this._values.styles = val; this.setPresent(PresenceFlag.kStyles); }
    public setShowTransparency(val: boolean) { this._values.transparency = val; this.setPresent(PresenceFlag.kTransparency); }
    public setShowFill(val: boolean) { this._values.fill = val; this.setPresent(PresenceFlag.kFill); }
    public setShowTextures(val: boolean) { this._values.textures = val; this.setPresent(PresenceFlag.kTextures); }
    public setShowMaterials(val: boolean) { this._values.materials = val; this.setPresent(PresenceFlag.kMaterials); }
    public setShowSourceLights(val: boolean) { this._values.sourceLights = val; this.setPresent(PresenceFlag.kSourceLights); }
    public setShowCameraLights(val: boolean) { this._values.cameraLights = val; this.setPresent(PresenceFlag.kCameraLights); }
    public setShowSolarLight(val: boolean) { this._values.solarLight = val; this.setPresent(PresenceFlag.kSolarLight); }
    public setShowVisibleEdges(val: boolean) { this._values.visibleEdges = val; this.setPresent(PresenceFlag.kVisibleEdges); }
    public setShowHiddenEdges(val: boolean) { this._values.hiddenEdges = val; this.setPresent(PresenceFlag.kHiddenEdges); }
    public setShowShadows(val: boolean) { this._values.shadows = val; this.setPresent(PresenceFlag.kShadows); }
    public setShowClipVolume(val: boolean) { this._values.clipVolume = val; this.setPresent(PresenceFlag.kClipVolume); }
    public setShowConstructions(val: boolean) { this._values.constructions = val; this.setPresent(PresenceFlag.kConstructions); }
    public setMonochrome(val: boolean) { this._values.monochrome = val; this.setPresent(PresenceFlag.kMonochrome); }
    public setIgnoreGeometryMap(val: boolean) { this._values.noGeometryMap = val; this.setPresent(PresenceFlag.kGeometryMap); }
    public setShowBackgroundMap(val: boolean) { this._values.backgroundMap = val; this.setPresent(PresenceFlag.kBackgroundMap); }
    public setUseHlineMaterialColors(val: boolean) { this._values.hLineMaterialColors = val; this.setPresent(PresenceFlag.kHlineMaterialColors); }
    public setEdgeMask(val: number) { this._values.edgeMask = val; this.setPresent(PresenceFlag.kEdgeMask); }
    public setRenderMode(val: RenderMode) { this._values.renderMode = val; this.setPresent(PresenceFlag.kRenderMode); }
    public anyOverridden() { return 0 !== this._present; }
    public clear() { this._present = 0; }

    /** Apply these overrides to the supplied ViewFlags */
    public apply(base: ViewFlags): ViewFlags {
      if (!this.anyOverridden())
        return base;

      if (this.isPresent(PresenceFlag.kDimensions)) base.dimensions = this._values.dimensions;
      if (this.isPresent(PresenceFlag.kPatterns)) base.patterns = this._values.patterns;
      if (this.isPresent(PresenceFlag.kWeights)) base.weights = this._values.weights;
      if (this.isPresent(PresenceFlag.kStyles)) base.styles = this._values.styles;
      if (this.isPresent(PresenceFlag.kTransparency)) base.transparency = this._values.transparency;
      if (this.isPresent(PresenceFlag.kFill)) base.fill = this._values.fill;
      if (this.isPresent(PresenceFlag.kTextures)) base.textures = this._values.textures;
      if (this.isPresent(PresenceFlag.kMaterials)) base.materials = this._values.materials;
      if (this.isPresent(PresenceFlag.kSolarLight)) base.solarLight = this._values.solarLight;
      if (this.isPresent(PresenceFlag.kCameraLights)) base.cameraLights = this._values.cameraLights;
      if (this.isPresent(PresenceFlag.kSourceLights)) base.sourceLights = this._values.sourceLights;
      if (this.isPresent(PresenceFlag.kVisibleEdges)) base.visibleEdges = this._values.visibleEdges;
      if (this.isPresent(PresenceFlag.kHiddenEdges)) base.hiddenEdges = this._values.hiddenEdges;
      if (this.isPresent(PresenceFlag.kShadows)) base.shadows = this._values.shadows;
      if (this.isPresent(PresenceFlag.kClipVolume)) base.clipVolume = this._values.clipVolume;
      if (this.isPresent(PresenceFlag.kConstructions)) base.constructions = this._values.constructions;
      if (this.isPresent(PresenceFlag.kMonochrome)) base.monochrome = this._values.monochrome;
      if (this.isPresent(PresenceFlag.kGeometryMap)) base.noGeometryMap = this._values.noGeometryMap;
      if (this.isPresent(PresenceFlag.kBackgroundMap)) base.backgroundMap = this._values.backgroundMap;
      if (this.isPresent(PresenceFlag.kHlineMaterialColors)) base.hLineMaterialColors = this._values.hLineMaterialColors;
      if (this.isPresent(PresenceFlag.kEdgeMask)) base.edgeMask = this._values.edgeMask;
      if (this.isPresent(PresenceFlag.kRenderMode)) base.renderMode = this._values.renderMode;
      return base;
    }
  }
}

/** Enumerates the available patterns for drawing patterned lines.
 * Each is a 32-bit pattern in which each bit specifies the on- or off-state of a pixel.
 */
export const enum LinePixels {
  Solid = 0,
  Code0 = Solid,
  Code1 = 0x80808080,
  Code2 = 0xf8f8f8f8,
  Code3 = 0xffe0ffe0,
  Code4 = 0xfe10fe10,
  Code5 = 0xe0e0e0e0,
  Code6 = 0xf888f888,
  Code7 = 0xff18ff18,
  HiddenLine = 0xcccccccc,
  Invisible = 0x00000001,
  Invalid = -1,
}

/** Represents a frustum as 6 planes and provides containment and intersection testing
 * @hidden
 */
export class FrustumPlanes {
  private _planes?: ClipPlane[];

  public constructor(frustum?: Frustum) {
    if (undefined !== frustum) {
      this.init(frustum);
    }
  }

  public get isValid(): boolean { return undefined !== this._planes; }

  public init(frustum: Frustum) {
    if (undefined === this._planes) {
      this._planes = [];
    } else {
      this._planes.length = 0;
    }

    FrustumPlanes.addPlaneFromPoints(this._planes, frustum.points, 1, 3, 5);  // right
    FrustumPlanes.addPlaneFromPoints(this._planes, frustum.points, 0, 4, 2);  // left
    FrustumPlanes.addPlaneFromPoints(this._planes, frustum.points, 2, 6, 3);  // top
    FrustumPlanes.addPlaneFromPoints(this._planes, frustum.points, 0, 1, 4);  // bottom
    FrustumPlanes.addPlaneFromPoints(this._planes, frustum.points, 0, 2, 1);  // back
    FrustumPlanes.addPlaneFromPoints(this._planes, frustum.points, 4, 5, 6);  // front
  }

  public computeFrustumContainment(box: Frustum): FrustumPlanes.Containment { return this.computeContainment(box.points); }
  public intersectsFrustum(box: Frustum): boolean { return FrustumPlanes.Containment.Outside !== this.computeFrustumContainment(box); }
  public containsPoint(point: Point3d, tolerance: number = 1.0e-8): boolean { return FrustumPlanes.Containment.Outside !== this.computeContainment([point], tolerance); }

  public computeContainment(points: Point3d[], tolerance: number = 1.0e-8): FrustumPlanes.Containment {
    assert(this.isValid);
    if (undefined === this._planes) {
      return FrustumPlanes.Containment.Outside;
    }

    let allInside = true;
    for (const plane of this._planes) {
      let nOutside = 0;
      for (const point of points) {
        if (plane.evaluatePoint(point) + tolerance < 0.0) {
          ++nOutside;
          allInside = false;
        }
      }

      if (nOutside === points.length) {
        return FrustumPlanes.Containment.Outside;
      }
    }

    return allInside ? FrustumPlanes.Containment.Inside : FrustumPlanes.Containment.Partial;
  }

  public intersectsRay(origin: Point3d, direction: Vector3d): boolean {
    assert(this.isValid);
    if (undefined === this._planes) {
      return false;
    }

    let tFar = 1e37;
    let tNear = -tFar;

    for (const plane of this._planes) {
      const vD = plane.dotProductVector(direction);
      const vN = plane.evaluatePoint(origin);
      if (0.0 === vD) {
        // ray is parallel... no need to continue testing if outside halfspace.
        if (vN < 0.0) {
          return false;
        }
      } else {
        const rayDistance = -vN / vD;
        if (vD < 0.0) {
          tFar = Math.min(rayDistance, tFar);
        } else {
          tNear = Math.max(rayDistance, tNear);
        }
      }
    }

    return tNear <= tFar;
  }
}

/** @hidden */
export namespace FrustumPlanes {
  /** @hidden */
  export const enum Containment {
    Outside = 0,
    Partial = 1,
    Inside = 2,
  }

  /** @hidden */
  export function addPlaneFromPoints(planes: ClipPlane[], points: Point3d[], i0: number, i1: number, i2: number, expandPlaneDistance: number = 1.0e-6): void {
    const normal = Vector3d.createCrossProductToPoints(points[i2], points[i1], points[i0]);
    normal.normalizeInPlace();
    const plane = ClipPlane.createNormalAndDistance(normal, normal.dotProduct(points[i0]) - expandPlaneDistance);
    if (undefined !== plane) {
      planes.push(plane);
    }
  }
}

/** Namespace containing types controlling how edges and surfaces should be drawn in "hidden line" and "solid fill" [[RenderMode]]s. */
export namespace HiddenLine {
  /** Describes the symbology with which edges should be drawn. */
  export interface StyleProps {
    /** @hidden
     * This JSON representation is awkward, but it must match that used in the db.
     * If the JSON came from the db then all members are present and:
     *  - color is overridden only if ovrColor = true.
     *  - width is overridden only if width != 0
     *  - pattern is overridden only if pattern != LinePixels.Invalid
     * The 'public' JSON representation is more sensible:
     *  - Color, width, and pattern are each overridden iff they are not undefined.
     * To make this work for both scenarios, the rules are:
     *  - color is overridden if color != undefined and ovrColor != false
     *  - width is overridden if width != undefined and width != 0
     *  - pattern is overridden if pattern != undefined and pattern != LinePixels.Invalid
     */
    readonly ovrColor?: boolean;
    /** If defined, the color used to draw the edges. If undefined, edges are drawn using the element's line color. */
    readonly color?: ColorDefProps;
    /** If defined, the pixel pattern used to draw the edges. If undefined, edges are drawn using the element's line pattern. */
    readonly pattern?: LinePixels;
    /** If defined, the width of the edges in pixels. If undefined (or 0), edges are drawn using the element's line width.
     * @note Non-integer values are truncated, and values are clamped to the range [1, 32].
     */
    readonly width?: number;
  }

  /** Describes the symbology with which edges should be drawn. */
  export class Style implements StyleProps {
    /** @hidden */
    public get ovrColor(): boolean { return undefined !== this.color; }
    /** If defined, the color used to draw the edges. If undefined, edges are drawn using the element's line color. */
    public readonly color?: ColorDef;
    /** If defined, the pixel pattern used to draw the edges. If undefined, edges are drawn using the element's line pattern. */
    public readonly pattern?: LinePixels;
    /** If defined, the width of the edges in pixels. If undefined (or 0), edges are drawn using the element's line width.
     * @note Non-integer values are truncated, and values are clamped to the range [1, 32].
     */
    public readonly width?: number;

    private constructor(json?: StyleProps) {
      if (undefined === json)
        return;

      if (undefined !== json.color && false !== json.ovrColor)
        this.color = ColorDef.fromJSON(json.color);

      if (undefined !== json.pattern) {
        const pattern = JsonUtils.asInt(json.pattern, LinePixels.Invalid);
        if (LinePixels.Invalid !== pattern)
          this.pattern = pattern;
      }

      if (undefined !== json.width) {
        let width = JsonUtils.asInt(json.width, 0);
        if (0 !== width) {
          width = Math.max(1, width);
          this.width = Math.min(32, width);
        }
      }
    }

    public static defaults = new Style({ });

    public static fromJSON(json?: StyleProps): Style { return undefined !== json ? new Style(json) : this.defaults; }

    /** Create a Style equivalent to this one but with the specified color override. */
    public overrideColor(color: ColorDef): Style {
      if (undefined !== this.color && this.color.equals(color))
        return this;

      return Style.fromJSON({
        color,
        ovrColor: true,
        pattern: this.pattern,
        width: this.width,
      });
    }

    /** Returns true if this Style is equivalent to the supplied Style. */
    public equals(other: Style): boolean {
      if (this === other)
        return true;
      else if (this.ovrColor !== other.ovrColor || this.pattern !== other.pattern || this.width !== other.width)
        return false;
      else
        return undefined === this.color || this.color.equals(other.color!);
    }

    public toJSON(): StyleProps {
      return {
        ovrColor: this.ovrColor,
        color: undefined !== this.color ? this.color : ColorDef.white,
        pattern: undefined !== this.pattern ? this.pattern : LinePixels.Invalid,
        width: undefined !== this.width ? this.width : 0,
      };
    }
  }

  /** Describes how visible and hidden edges and transparent surfaces should be rendered in "hidden line" and "solid fill" [[RenderMode]]s. */
  export interface SettingsProps {
    /** Describes how visible edges (those unobscured by other geometry) should be displayed. */
    readonly visible?: StyleProps;
    /** Describes how hidden edges (those obscured by other geometry) should be displayed. */
    readonly hidden?: StyleProps;
    /** A value in the range [0.0, 1.0] specifying a threshold below which transparent surfaces should not be drawn.
     * A value of 0.0 indicates any surface that is not 100% opaque should not be drawn.
     * A value of 0.25 indicates any surface that is less than 25% opaque should not be drawn.
     * A value of 1.0 indicates that all surfaces should be drawn regardless of transparency.
     * @note values will be clamped to the range [0.0, 1.0].
     * @note Defaults to 1.0.
     */
    readonly transThreshold?: number;
  }

  /** Describes how visible and hidden edges and transparent surfaces should be rendered in "hidden line" and "solid fill" [[RenderMode]]s. */
  export class Settings {
    /** Describes how visible edges (those unobscured by other geometry) should be displayed. */
    public readonly visible: Style;
    /** Describes how hidden edges (those obscured by other geometry) should be displayed. */
    public readonly hidden: Style;
    /** A value in the range [0.0, 1.0] specifying a threshold below which transparent surfaces should not be drawn.
     * A value of 0.0 indicates any surface that is not 100% opaque should not be drawn.
     * A value of 0.25 indicates any surface that is less than 25% opaque should not be drawn.
     * A value of 1.0 indicates that all surfaces should be drawn regardless of transparency.
     * @note values will be clamped to the range [0.0, 1.0].
     * @note Defaults to 1.0.
     */
    public readonly transparencyThreshold: number;
    public get transThreshold(): number { return this.transparencyThreshold; }

    /** The default display settings. */
    public static defaults = new Settings({ });

    /** Create a DisplaySettings from its JSON representation. */
    public static fromJSON(json?: SettingsProps): Settings {
      if (undefined === json)
        return this.defaults;
      else if (json instanceof Settings)
        return json;
      else
        return new Settings(json);
    }

    public toJSON(): SettingsProps {
      return {
        visible: this.visible.toJSON(),
        hidden: this.hidden.toJSON(),
        transThreshold: this.transThreshold,
      };
    }

    private constructor(json: SettingsProps) {
      this.visible = Style.fromJSON(json.visible);
      this.hidden = Style.fromJSON(json.hidden);
      this.transparencyThreshold = JsonUtils.asDouble(json.transThreshold, 1.0);
    }
  }
}

export namespace Gradient {
  /** Flags applied to a [[Gradient.Symb]]. */
  export const enum Flags {
    /** No flags. */
    None = 0,
    /** Reverse the order of the gradient keys. */
    Invert = 1,
    /** Draw an outline around the surface to which the gradient is applied. */
    Outline = 2,
  }

  /** Enumerates the modes by which a [[Gradient.Symb]]'s keys are applied to create an image. */
  export const enum Mode {
    None = 0,
    Linear = 1,
    Curved = 2,
    Cylindrical = 3,
    Spherical = 4,
    Hemispherical = 5,
    /** @hidden */
    Thematic = 6,
  }

  /** @hidden */
  export const enum ThematicMode {
    Smooth = 0,
    Stepped = 1,
    SteppedWithDelimiter = 2,
    IsoLines = 3,
  }

  /** @hidden */
  export const enum ThematicColorScheme {
    BlueRed = 0,
    RedBlue = 1,
    Monochrome = 2,
    Topographic = 3,
    SeaMountain = 4,
    Custom = 5,
  }

  /** @hidden */
  export interface ThematicSettingsProps {
    mode: ThematicMode;
    stepCount: number;
    marginColor: ColorDefProps;
    colorScheme: number;
    rangeLow: number;
    rangeHigh: number;
  }

  /** @hidden Gradient settings specific to thematic mesh display */
  export class ThematicSettings {
    public mode: ThematicMode = ThematicMode.Smooth;
    public stepCount: number = 10;
    public marginColor: ColorDef = ColorDef.from(0x3f, 0x3f, 0x3f);
    public colorScheme: number = ThematicColorScheme.BlueRed;
    public rangeLow: number = 1.0E200;
    public rangeHigh: number = -1.0E200;
    public get range() { return (this.rangeLow > this.rangeHigh) ? Range1d.createNull() : Range1d.createXX(this.rangeLow, this.rangeHigh); }
    public set range(range: Range1d) { this.rangeLow = range.low; this.rangeHigh = range.high; }
    public static defaults = new ThematicSettings();
    public static get margin(): number { return .001; }    // A fixed portion of the gradient for out of range values.
    public static get contentRange(): number { return 1.0 - 2.0 * ThematicSettings.margin; }
    public static get contentMax(): number { return 1.0 - ThematicSettings.margin; }

    public static fromJSON(json: ThematicSettingsProps) {
      const result = new ThematicSettings();
      result.mode = json.mode;
      result.stepCount = json.stepCount;
      result.marginColor = new ColorDef(json.marginColor);
      result.colorScheme = json.colorScheme;
      result.rangeLow = json.rangeLow;
      result.rangeHigh = json.rangeHigh;
      return result;
    }
  }

  /** Gradient fraction value to [[ColorDef]] pair */
  export interface KeyColorProps {
    /** Fraction from 0.0 to 1.0 to denote position along gradient */
    value: number;
    /** Color value for given fraction */
    color: ColorDefProps;
  }

  /** Gradient fraction value to [[ColorDef]] pair
   * @see [[Gradient.KeyColorProps]]
   */
  export class KeyColor implements KeyColorProps {
    public value: number;
    public color: ColorDef;
    public constructor(json: KeyColorProps) {
      this.value = json.value;
      this.color = new ColorDef(json.color);
    }
  }

  /** Multi-color area fill defined by a range of colors that vary by position */
  export interface SymbProps {
    /** Gradient type, must be set to something other than [[Gradient.Mode.None]] to display fill */
    mode: Mode;
    /** Gradient flags to enable outline display and invert color fractions, Flags.None if undefined */
    flags?: Flags;
    /** Gradient rotation angle, 0.0 if undefined */
    angle?: AngleProps;
    /** Gradient tint value from 0.0 to 1.0, only used when [[Gradient.KeyColorProps]] size is 1, 0.0 if undefined */
    tint?: number;
    /** Gradient shift value from 0.0 to 1.0, 0.0 if undefined */
    shift?: number;
    /** Gradient fraction value/color pairs, 1 minimum (uses tint for 2nd color), 8 maximum */
    keys: KeyColorProps[];
    /** @hidden Settings applicable to meshes and Gradient.Mode.Thematic only */
    thematicSettings?: ThematicSettingsProps;
  }

  /** Multi-color area fill defined by a range of colors that vary by position.
   * Gradient fill can be applied to planar regions.
   * @see [[Gradient.SymbProps]]
   */
  export class Symb implements SymbProps {
    public mode = Mode.None;
    public flags: Flags = Flags.None;
    public angle?: Angle;
    public tint?: number;
    public shift: number = 0;
    public thematicSettings?: ThematicSettings;
    public keys: KeyColor[] = [];

    /** create a GradientSymb from a json object. */
    public static fromJSON(json?: SymbProps) {
      const result = new Symb();
      if (!json)
        return result;
      result.mode = json.mode;
      result.flags = (json.flags === undefined) ? Flags.None : json.flags;
      result.angle = json.angle ? Angle.fromJSON(json.angle) : undefined;
      result.tint = json.tint;
      result.shift = json.shift ? json.shift : 0;
      json.keys.forEach((key) => result.keys.push(new KeyColor(key)));
      result.thematicSettings = (json.thematicSettings === undefined) ? undefined : ThematicSettings.fromJSON(json.thematicSettings);

      return result;
    }

    /** @hidden */
    public static createThematic(settings: ThematicSettings) {
      const result = new Symb();
      result.mode = Mode.Thematic;
      result.thematicSettings = settings;

      if (settings.colorScheme < ThematicColorScheme.Custom) {
        const fixedSchemeKeys = [[[0.0, 0, 255, 0], [0.25, 0, 255, 255], [0.5, 0, 0, 255], [0.75, 255, 0, 255], [1.0, 255, 0, 0]],  // Blue Red.
        [[0.0, 255, 0, 0], [0.25, 255, 0, 255], [0.5, 0, 0, 255], [0.75, 0, 255, 255], [1.0, 0, 255, 0]], // Red blue.
        [[0.0, 0, 0, 0], [1.0, 255, 255, 255]], // Monochrome.
        [[0.0, 152, 148, 188], [0.5, 204, 160, 204], [1.0, 152, 72, 128]], // Based off of the topographic gradients in Point Clouds.
        [[0.0, 0, 255, 0], [0.2, 72, 96, 160], [0.4, 152, 96, 160], [0.6, 128, 32, 104], [0.7, 148, 180, 128], [1.0, 240, 240, 240]]]; // Based off of the sea-mountain gradient in Point Clouds.

        for (const keyValue of fixedSchemeKeys[settings.colorScheme])
          result.keys.push(new KeyColor({ value: keyValue[0], color: ColorDef.from(keyValue[1], keyValue[3], keyValue[2]) }));
      }
      return result;
    }
    public clone(): Symb {
      return Symb.fromJSON(this);
    }

    /** Returns true if this symbology is equal to another, false otherwise. */
    public equals(other: Symb): boolean {
      return Symb.compareSymb(this, other) === 0;
    }

    /** Compares two gradient symbologies. Used for ordering Gradient.Symb objects.
     * @param lhs First gradient to compare
     * @param rhs Second gradient to compare
     * @returns 0 if lhs is equivalent to rhs, a negative number if lhs compares less than rhs, or a positive number if lhs compares greater than rhs.
     */
    public static compareSymb(lhs: Gradient.Symb, rhs: Gradient.Symb): number {
      if (lhs === rhs)
        return 0; // Same pointer
      if (lhs.mode !== rhs.mode)
        return lhs.mode - rhs.mode;
      if (lhs.flags !== rhs.flags)
        if (lhs.flags === undefined)
          return -1;
        else if (rhs.flags === undefined)
          return 1;
        else
          return lhs.flags - rhs.flags;
      if (lhs.tint !== rhs.tint)
        if (lhs.tint === undefined)
          return -1;
        else if (rhs.tint === undefined)
          return 1;
        else
          return lhs.tint - rhs.tint;
      if (lhs.shift !== rhs.shift)
        if (lhs.shift === undefined)
          return -1;
        else if (rhs.shift === undefined)
          return 1;
        else
          return lhs.shift - rhs.shift;
      if ((lhs.angle === undefined) !== (rhs.angle === undefined))
        if (lhs.angle === undefined)
          return -1;
        else
          return 1;
      if (lhs.angle && !lhs.angle.isAlmostEqualNoPeriodShift(rhs.angle!))
        return lhs.angle.radians - rhs.angle!.radians;
      if (lhs.keys.length !== rhs.keys.length)
        return lhs.keys.length - rhs.keys.length;
      for (let i = 0; i < lhs.keys.length; i++) {
        if (lhs.keys[i].value !== rhs.keys[i].value)
          return lhs.keys[i].value - rhs.keys[i].value;
        if (!lhs.keys[i].color.equals(rhs.keys[i].color))
          return lhs.keys[i].color.tbgr - rhs.keys[i].color.tbgr;
      }
      return 0;
    }

    /** Compare this symbology to another.
     * @see [[Gradient.Symb.compareSymb]]
     */
    public compare(other: Symb): number {
      return Gradient.Symb.compareSymb(this, other);
    }

    /**
     * Ensure the value given is within the range of 0 to 255,
     * and truncate the value to only the 8 least significant bits.
     */
    private roundToByte(num: number): number {
      return Math.min(num + .5, 255.0) & 0xFF;
    }

    /** Maps a value to an RGBA value adjusted from a color present in this symbology's array. */
    private mapColor(value: number) {
      if (value < 0)
        value = 0;
      else if (value > 1)
        value = 1;

      if ((this.flags & Flags.Invert) !== 0)
        value = 1 - value;

      let idx = 0;
      let d;
      let w0;
      let w1;
      if (this.keys.length <= 2) {
        w0 = 1.0 - value;
        w1 = value;
      } else {  // locate value in map, blend corresponding colors
        while (idx < (this.keys.length - 2) && value > this.keys[idx + 1].value)
          idx++;

        d = this.keys[idx + 1].value - this.keys[idx].value;
        w1 = d < 0.0001 ? 0.0 : (value - this.keys[idx].value) / d;
        w0 = 1.0 - w1;
      }

      const color0 = this.keys[idx].color;
      const color1 = this.keys[idx + 1].color;
      const colors0 = color0.colors;
      const colors1 = color1.colors;
      const red = w0 * colors0.r + w1 * colors1.r;
      const green = w0 * colors0.g + w1 * colors1.g;
      const blue = w0 * colors0.b + w1 * colors1.b;
      const transparency = w0 * colors0.t + w1 * colors1.t;

      return ColorDef.from(this.roundToByte(red), this.roundToByte(green), this.roundToByte(blue), this.roundToByte(transparency));
    }

    public get hasTranslucency(): boolean {
      for (const key of this.keys) {
        if (!key.color.isOpaque)
          return true;
      }

      return false;
    }

    /** Returns true if the [[Gradient.Flags.Outline]] flag is set. */
    public get isOutlined(): boolean { return 0 !== (this.flags & Flags.Outline); }

    /** Applies this gradient's settings to produce a bitmap image. */
    public getImage(width: number, height: number): ImageBuffer {
      if (this.mode === Mode.Thematic) {
        width = 1;
        height = 8192;    // Thematic image height
      }

      const hasAlpha = this.hasTranslucency;
      const thisAngle = (this.angle === undefined) ? 0 : this.angle.radians;
      const cosA = Math.cos(thisAngle);
      const sinA = Math.sin(thisAngle);
      const image = new Uint8Array(width * height * (hasAlpha ? 4 : 3));
      let currentIdx = image.length - 1;
      const shift = Math.min(1.0, Math.abs(this.shift));

      switch (this.mode) {
        case Mode.Linear:
        case Mode.Cylindrical: {
          const xs = 0.5 - 0.25 * shift * cosA;
          const ys = 0.5 - 0.25 * shift * sinA;
          let dMax;
          let dMin = dMax = 0.0;
          let d;
          for (let j = 0; j < 2; j++) {
            for (let i = 0; i < 2; i++) {
              d = (i - xs) * cosA + (j - ys) * sinA;
              if (d < dMin)
                dMin = d;
              if (d > dMax)
                dMax = d;
            }
          }
          for (let j = 0; j < height; j++) {
            const y = j / height - ys;
            for (let i = 0; i < width; i++) {
              const x = i / width - xs;
              d = x * cosA + y * sinA;
              let f;
              if (this.mode === Mode.Linear) {
                if (d > 0)
                  f = 0.5 + 0.5 * d / dMax;
                else
                  f = 0.5 - 0.5 * d / dMin;
              } else {
                if (d > 0)
                  f = Math.sin(Math.PI / 2 * (1.0 - d / dMax));
                else
                  f = Math.sin(Math.PI / 2 * (1.0 - d / dMin));
              }
              const color = this.mapColor(f);
              if (hasAlpha)
                image[currentIdx--] = color.getAlpha();

              image[currentIdx--] = color.colors.b;
              image[currentIdx--] = color.colors.g;
              image[currentIdx--] = color.colors.r;
            }
          }
          break;
        }
        case Mode.Curved: {
          const xs = 0.5 + 0.5 * sinA - 0.25 * shift * cosA;
          const ys = 0.5 - 0.5 * cosA - 0.25 * shift * sinA;
          for (let j = 0; j < height; j++) {
            const y = j / height - ys;
            for (let i = 0; i < width; i++) {
              const x = i / width - xs;
              const xr = 0.8 * (x * cosA + y * sinA);
              const yr = y * cosA - x * sinA;
              const f = Math.sin(Math.PI / 2 * (1 - Math.sqrt(xr * xr + yr * yr)));
              const color = this.mapColor(f);
              if (hasAlpha)
                image[currentIdx--] = color.getAlpha();

              image[currentIdx--] = color.colors.b;
              image[currentIdx--] = color.colors.g;
              image[currentIdx--] = color.colors.r;
            }
          }
          break;
        }
        case Mode.Spherical: {
          const r = 0.5 + 0.125 * Math.sin(2.0 * thisAngle);
          const xs = 0.5 * shift * (cosA + sinA) * r;
          const ys = 0.5 * shift * (sinA - cosA) * r;
          for (let j = 0; j < height; j++) {
            const y = ys + j / height - 0.5;
            for (let i = 0; i < width; i++) {
              const x = xs + i / width - 0.5;
              const f = Math.sin(Math.PI / 2 * (1.0 - Math.sqrt(x * x + y * y) / r));
              const color = this.mapColor(f);
              if (hasAlpha)
                image[currentIdx--] = color.getAlpha();

              image[currentIdx--] = color.colors.b;
              image[currentIdx--] = color.colors.g;
              image[currentIdx--] = color.colors.r;
            }
          }
          break;
        }
        case Mode.Hemispherical: {
          const xs = 0.5 + 0.5 * sinA - 0.5 * shift * cosA;
          const ys = 0.5 - 0.5 * cosA - 0.5 * shift * sinA;
          for (let j = 0; j < height; j++) {
            const y = j / height - ys;
            for (let i = 0; i < width; i++) {
              const x = i / width - xs;
              const f = Math.sin(Math.PI / 2 * (1.0 - Math.sqrt(x * x + y * y)));
              const color = this.mapColor(f);
              if (hasAlpha)
                image[currentIdx--] = color.getAlpha();

              image[currentIdx--] = color.colors.b;
              image[currentIdx--] = color.colors.g;
              image[currentIdx--] = color.colors.r;
            }
          }
          break;
        }
        case Mode.Thematic: {
          let settings = this.thematicSettings;
          if (settings === undefined) {
            settings = ThematicSettings.defaults;
          }

          // TBD - Stepped and isolines...
          for (let j = 0; j < height; j++) {
            let f = 1 - j / height;
            let color: ColorDef;

            if (f < ThematicSettings.margin || f > ThematicSettings.contentMax) {
              color = settings.marginColor;
            } else {
              f = (f - ThematicSettings.margin) / (ThematicSettings.contentRange);
              switch (settings.mode) {
                case ThematicMode.SteppedWithDelimiter:
                case ThematicMode.Stepped: {
                  if (settings.stepCount !== 0) {
                    const fStep = Math.floor(f * settings.stepCount + .99999) / settings.stepCount;
                    const delimitFraction = 1 / 1024;
                    if (settings.mode === ThematicMode.SteppedWithDelimiter && Math.abs(fStep - f) < delimitFraction)
                      color = new ColorDef(0xff000000);
                    else
                      color = this.mapColor(fStep);
                  }
                  break;
                }
                case ThematicMode.Smooth:
                  color = this.mapColor(f);
                  break;
              }
            }
            for (let i = 0; i < width; i++) {
              if (hasAlpha)
                image[currentIdx--] = color!.getAlpha();

              image[currentIdx--] = color!.colors.b;
              image[currentIdx--] = color!.colors.g;
              image[currentIdx--] = color!.colors.r;
            }
          }
        }
      }

      assert(-1 === currentIdx);
      const imageBuffer = ImageBuffer.create(image, hasAlpha ? ImageBufferFormat.Rgba : ImageBufferFormat.Rgb, width);
      assert(undefined !== imageBuffer);
      return imageBuffer!;
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

/** Describes how a view's background color affects the interior area of a closed region. */
export const enum BackgroundFill {
  /** single color fill uses the fill color and line color to draw either a solid or outline fill */
  None = 0,
  /** single color fill uses the view's background color to draw a solid fill */
  Solid = 1,
  /** single color fill uses the view's background color and line color to draw an outline fill */
  Outline = 2,
}

/** Categorizes a piece of geometry within a GeometryStream. Visibility of classes of geometry can be toggled
 * within a view using [[ViewFlags]].
 * @see [[GeometryStreamProps]].
 * @see [[Feature]].
 */
export const enum GeometryClass {
  /** Used to classify the "real" geometry within a model. Most geometry falls within this class. */
  Primary = 0,
  /** Used to classify geometry used as a drawing aid in constructing the Primary geometry. For example, grid lines. */
  Construction = 1,
  /** Used to classify annotations which dimension the Primary geometry. */
  Dimension = 2,
  /** Used to classify area pattern geometry. */
  Pattern = 3,
}

/** @hidden */
export class SceneLights {
  private _list: Light[] = [];
  public get isEmpty(): boolean { return this._list.length === 0; }
  constructor(public imageBased: { environmentalMap: RenderTexture, diffuseImage: RenderTexture, solar: ImageLight.Solar },
    public fstop: number = 0, // must be between -3 and +3
  ) { }
  public addLight(light: Light): void { if (light.isValid) this._list.push(light); }
}

/**
 * Geometry display properties used to override or augment the SubCategory Appearance.
 */
export class GeometryParams {
  public materialId?: Id64; // render material Id.
  public elmPriority?: number; // display priority (applies to 2d only)
  public weight?: number; // integer value from 0 to 32
  public lineColor?: ColorDef;
  public fillColor?: ColorDef; // fill color (applicable only if filled)
  public backgroundFill?: BackgroundFill; // support for fill using the view's background color, default BackgroundFill.None
  public fillDisplay?: FillDisplay; // whether or not the element should be displayed filled, default FillDisplay.Never
  public elmTransparency?: number; // line transparency, 0.0 for completely opaque, 1.0 for completely transparent
  public fillTransparency?: number;  // fill transparency, 0.0 for completely opaque, 1.0 for completely transparent
  public geometryClass?: GeometryClass; // geometry class, default GeometryClass.Primary
  public styleInfo?: LineStyle.Info; // line style id plus modifiers.
  public gradient?: Gradient.Symb; // gradient fill settings.
  public pattern?: AreaPattern.Params; // area pattern settings.

  constructor(public categoryId: Id64, public subCategoryId = new Id64()) { if (!subCategoryId.isValid) this.subCategoryId = IModel.getDefaultSubCategoryId(categoryId); }

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
    if (this.styleInfo && !this.styleInfo.equals(other.styleInfo!))
      return false;

    if (this.fillDisplay !== other.fillDisplay)
      return false;

    if (this.fillDisplay !== undefined && this.fillDisplay !== FillDisplay.Never) {
      if ((this.gradient === undefined) !== (other.gradient === undefined))
        return false;
      if (this.gradient && !this.gradient.equals(other.gradient!))
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
    if (this.pattern && !this.pattern.equals(other.pattern!))
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

  /** Get whether this GeometryParams contains information that needs to be transformed (ex. to apply local to world). */
  public get isTransformable() { return this.pattern || this.styleInfo; }

  /** Transform GeometryParams data like PatternParams and LineStyleInfo. */
  public applyTransform(transform: Transform) {
    if (this.pattern)
      this.pattern.applyTransform(transform);
    if (this.styleInfo && this.styleInfo.styleMod)
      this.styleInfo.styleMod.applyTransform(transform);
  }
}

/** Contains types related to display of hilited elements within a [[Viewport]]. */
export namespace Hilite {
  /**  Describes the width of the outline applied to hilited geometry. The outline is drawn around the union of all hilited geometry and is visible behind non-hilited geometry.
   * @see [[Hilite.Settings]]
   */
  export const enum Silhouette {
    /** No outline. */
    None,
    /** 1-pixel-wide outline. */
    Thin,
    /** 2-pixel-wide outline. */
    Thick,
  }

  /**
   * Describes how the hilite effect is applied to elements within a [[Viewport]].
   * The hilite effect is applied to elements contained in either the [[IModelConnection]]'s [[HilitedSet]] or its [[SelectionSet]].
   * It is designed to draw attention to those elements. The effect is produced as follows:
   *  1. All hilited elements are drawn as normal, except that their element color is mixed with the hilite color.
   *  2. The union of the regions of the screen corresponding to hilited elements is computed.
   *  3. A silhouette is drawn using the hilite color around the boundaries of the hilited region. This silhouette is visible behind other geometry.
   *  4. The hilite color is mixed with the color of each pixel within the hilited region. This enables surfaces of hilited geometry to be visible behind other geometry.
   *
   * The Settings allow an application to customize how this effect is applied.
   * @see [[Viewport.hilite]]
   */
  export class Settings {
    /** The color that is used to draw the outline and which is mixed with element color. */
    public readonly color: ColorDef;
    /** The ratio of hilite color to element color used when drawing unobscured portions of hilited geometry, in the range [0, 1].
     * A ratio of 0.0 uses only the element color. A ratio of 1.0 uses only the hilite color. A ratio of 0.5 mixes the hilite color and element color evenly.
     */
    public readonly visibleRatio: number;
    /** The ratio of hilite color to screen color used when drawing the hilited region overtop of the screen contents, in the range [0, 1]. */
    public readonly hiddenRatio: number;
    /** The type of outline to be drawn around the boundaries of the hilited region. */
    public silhouette: Silhouette;

    private static clamp(value: number) { return Math.min(1.0, Math.max(0.0, value)); }

    public constructor(color = ColorDef.from(0x23, 0xbb, 0xfc), visibleRatio = 0.25, hiddenRatio = 0.0, silhouette = Silhouette.Thin) {
      this.color = color;
      this.silhouette = silhouette;
      this.visibleRatio = Settings.clamp(visibleRatio);
      this.hiddenRatio = Settings.clamp(hiddenRatio);
    }
  }
}

/**
 * Describes a "feature" within a batched [[RenderGraphic]]. A batched [[RenderGraphic]] can
 * contain multiple features. Each feature is associated with a unique combination of
 * attributes (elementId, subcategory, geometry class). This allows geometry to be
 * more efficiently batched on the GPU, while enabling features to be re-symbolized
 * individually.
 *
 * As a simple example, a single mesh primitive may contain geometry for 3 elements,
 * all belonging to the same subcategory and geometry class. The mesh would therefore
 * contain 3 Features. Each vertex within the mesh would be associated with the
 * index of the Feature to which it belongs, where the index is determined by the
 * FeatureTable associated with the primitive.
 *
 * @see [[FeatureSymbology]] for mechanisms for controlling or overriding the symbology of individual features within a [[ViewState]].
 */
export class Feature implements Comparable<Feature> {
  public readonly elementId: string;
  public readonly subCategoryId: string;
  public readonly geometryClass: GeometryClass;

  public constructor(elementId: Id64String = Id64.invalidId, subCategoryId: Id64String = Id64.invalidId, geometryClass: GeometryClass = GeometryClass.Primary) {
    this.elementId = elementId.toString();
    this.subCategoryId = subCategoryId.toString();
    this.geometryClass = geometryClass;
  }

  public get isDefined(): boolean { return !Id64.isInvalidId(this.elementId) || !Id64.isInvalidId(this.subCategoryId) || this.geometryClass !== GeometryClass.Primary; }
  public get isUndefined(): boolean { return !this.isDefined; }

  public equals(other: Feature): boolean { return 0 === this.compare(other); }
  public compare(rhs: Feature): number {
    if (this === rhs)
      return 0;

    let cmp = compareNumbers(this.geometryClass, rhs.geometryClass);
    if (0 === cmp) {
      cmp = compareStrings(this.elementId, rhs.elementId);
      if (0 === cmp) {
        cmp = compareStrings(this.subCategoryId, rhs.subCategoryId);
      }
    }

    return cmp;
  }
}

/**
 * Describes the type of a 'batch' of graphics representing multiple [[Feature]]s.
 * The most commonly-encountered batches are Tiles, which can be of either Primary or
 * Classifier type.
 */
export const enum BatchType {
  /** This batch contains graphics derived from a model's visible geometry. */
  Primary,
  /**
   * This batch contains graphics which are used to classify a model's visible geometry.
   * The graphics themselves are not rendered to the screen; instead they are rendered to the stencil buffer
   * to resymbolize the primary geometry.
   */
  Classifier,
}

/**
 * Defines a look-up table for [[Feature]]s within a batched [[RenderGraphic]]. Consecutive 32-bit
 * indices are assigned to each unique Feature. Primitives within the [[RenderGraphic]] can
 * use per-vertex indices to specify the distribution of Features within the primitive.V
 * A FeatureTable can be shared amongst multiple primitives within a single [[RenderGraphic]], and
 * amongst multiple sub-Graphics of a [[RenderGraphic]].
 * @see [[FeatureSymbology]] for mechanisms for resymbolizing features within a [[ViewState]].
 */
export class FeatureTable extends IndexMap<Feature> {
  public readonly modelId: Id64;
  public readonly type: BatchType;

  /** Construct an empty FeatureTable. */
  public constructor(maxFeatures: number, modelId: Id64 = Id64.invalidId, type: BatchType = BatchType.Primary) {
    super(compare, maxFeatures);
    this.modelId = modelId;
    this.type = type;
  }

  /** Returns the maximum number of [[Feature]]s this FeatureTable can contain. */
  public get maxFeatures(): number { return this._maximumSize; }
  /** @hidden */
  public get anyDefined(): boolean { return this.length > 1 || (1 === this.length && this._array[0].value.isDefined); }
  /** Returns true if this FeatureTable contains exactly one [[Feature]]. */
  public get isUniform(): boolean { return 1 === this.length; }
  /** If this FeatureTable contains exactly one [[Feature]], returns that Feature; otherwise returns undefined. */
  public get uniform(): Feature | undefined { return 1 === this.length ? this._array[0].value : undefined; }
  /** Returns true if this FeatureTable is associated with [[BatchType.Classifier]] geometry. */
  public get isClassifier(): boolean { return BatchType.Classifier === this.type; }

  /** Returns the Feature corresponding to the specified index, or undefined if the index is not present. */
  public findFeature(index: number): Feature | undefined {
    for (const entry of this._array)
      if (entry.index === index)
        return entry.value;

    return undefined;
  }

  /** @hidden */
  public insertWithIndex(feature: Feature, index: number): void {
    const bound = this.lowerBound(feature);
    assert(!bound.equal);
    assert(!this.isFull);
    const entry = new IndexedValue<Feature>(feature, index);
    this._array.splice(bound.index, 0, entry);
  }

  /** @hidden */
  public getArray(): Array<IndexedValue<Feature>> { return this._array; }
}

/** Describes how to map a [[RenderTexture]] image onto a surface.
 * @see [[RenderMaterial]].
 */
export class TextureMapping {
  /** The texture to be mapped to the surface. */
  public readonly texture: RenderTexture;
  /** The parameters describing how the texture image is mapped to the surface. */
  public readonly params: TextureMapping.Params;

  public constructor(tx: RenderTexture, params: TextureMapping.Params) {
    this.texture = tx;
    this.params = params;
  }

  /** @hidden */
  public computeUVParams(visitor: PolyfaceVisitor, transformToImodel: Transform): Point2d[] | undefined {
    return this.params.computeUVParams(visitor as IndexedPolyfaceVisitor, transformToImodel);
  }
}

export namespace TextureMapping {
  /** Enumerates the possible texture mapping modes. */
  export const enum Mode {
    None = -1,
    Parametric = 0,
    ElevationDrape = 1,
    Planar = 2,
    /** @hidden */
    DirectionalDrape = 3,
    /** @hidden */
    Cubic = 4,
    /** @hidden */
    Spherical = 5,
    /** @hidden */
    Cylindrical = 6,
    /** @hidden */
    Solid = 7,
    /** @hidden Only valid for lights */
    FrontProject = 8,
  }

  /** A 2x3 matrix for mapping a texture image to a surface. */
  export class Trans2x3 {
    private _vals = new Array<[number, number, number]>(2);
    private _transform?: Transform;

    public constructor(t00: number = 1, t01: number = 0, t02: number = 0, t10: number = 0, t11: number = 1, t12: number = 0) {
      const vals = this._vals;
      vals[0] = [t00, t01, t02]; vals[1] = [t10, t11, t12];
    }

    public setTransform(): void {
      const transform = Transform.createIdentity(), vals = this._vals, matrix = transform.matrix;

      for (let i = 0, len = 2; i < 2; ++i)
        for (let j = 0; j < len; ++j)
          matrix.setAt(i, j, vals[i][j]);

      transform.origin.x = vals[0][2];
      transform.origin.y = vals[1][2];

      this._transform = transform;
    }

    public get transform(): Transform { if (undefined === this._transform) this.setTransform(); return this._transform!; }
  }

  /** Properties used to construct a [[TextureMapping.Params]]. */
  export interface ParamProps {
    /** The matrix used to map the image to a surface. */
    textureMat2x3?: TextureMapping.Trans2x3;
    /** The ratio in [0, 1] with which to mix the color sampled from the texture with the element's color.
     * A value of 0.0 uses only the element color. A value of 1.0 uses only the texture color.
     * @note Defaults to 1.0
     */
    textureWeight?: number;
    /** The mode by which to map the image to a surface.
     * @note Defaults to [[TextureMapping.Mode.Parametric]].
     */
    mapMode?: TextureMapping.Mode;
    /** @hidden */
    worldMapping?: boolean;
  }

  /** Parameters describing how a texture image is mapped to a surface. */
  export class Params {
    /** The matrix used to map the image to a surface. */
    public textureMatrix: TextureMapping.Trans2x3;
    /** The ratio in [0, 1] with which to mix the color sampled from the texture with the element's color.
     * A value of 0.0 uses only the element color. A value of 1.0 uses only the texture color.
     */
    public weight: number;
    /** The mode by which to map the image to a surface. */
    public mode: TextureMapping.Mode;
    /** @hidden */
    public worldMapping: boolean;

    constructor(props = {} as TextureMapping.ParamProps) {
      const { textureMat2x3 = new Trans2x3(), textureWeight = 1.0, mapMode = Mode.Parametric, worldMapping = false } = props;
      this.textureMatrix = textureMat2x3; this.weight = textureWeight; this.mode = mapMode; this.worldMapping = worldMapping;
    }

    /**
     * Generates UV parameters for textured surfaces. Returns undefined on failure.
     * @hidden
     */
    public computeUVParams(visitor: IndexedPolyfaceVisitor, transformToImodel: Transform): Point2d[] | undefined {
      switch (this.mode) {
        default:  // Fall through to parametric in default case
        case TextureMapping.Mode.Parametric: {
          return this.computeParametricUVParams(visitor, this.textureMatrix.transform, !this.worldMapping);
        }
        case TextureMapping.Mode.Planar: {
          const normalIndices = visitor.normalIndex;
          if (!normalIndices)
            return undefined;

          // Ignore planar mode unless master or sub units for scaleMode and facet is planar
          if (!this.worldMapping || (visitor.normalIndex !== undefined && (normalIndices[0] !== normalIndices[1] || normalIndices[0] !== normalIndices[2]))) {
            return this.computeParametricUVParams(visitor, this.textureMatrix.transform, !this.worldMapping);
          } else {
            return this.computePlanarUVParams(visitor, this.textureMatrix.transform);
          }
        }
        case TextureMapping.Mode.ElevationDrape: {
          return this.computeElevationDrapeUVParams(visitor, this.textureMatrix.transform, transformToImodel);
        }
      }
    }

    /** Computes UV parameters given a texture mapping mode of parametric. */
    private computeParametricUVParams(visitor: IndexedPolyfaceVisitor, uvTransform: Transform, isRelativeUnits: boolean): Point2d[] {
      const params: Point2d[] = [];
      for (let i = 0; i < visitor.numEdgesThisFacet; i++) {
        let param = Point2d.create();

        if (isRelativeUnits || !visitor.tryGetDistanceParameter(i, param)) {
          if (!visitor.tryGetNormalizedParameter(i, param)) {
            // If mesh does not have facetFaceData, we still want to use the texture coordinates if they are present
            param = visitor.getParam(i);
          }
        }

        params.push(uvTransform.multiplyPoint2d(param));
      }
      return params;
    }

    /** Computes UV parameters given a texture mapping mode of planar. The result is stored in the Point2d array given. */
    private computePlanarUVParams(visitor: IndexedPolyfaceVisitor, uvTransform: Transform): Point2d[] | undefined {
      const params: Point2d[] = [];
      const points = visitor.point;
      let normal: Vector3d;

      if (visitor.normal === undefined)
        normal = points.getPoint3dAt(0).crossProductToPoints(points.getPoint3dAt(1), points.getPoint3dAt(2));
      else
        normal = visitor.normal[0];

      if (!normal.normalize(normal))
        return undefined;

      // adjust U texture coordinate to be a continuous length starting at the
      // origin. V coordinate stays the same. This mode assumes Z is up vector

      // Flipping normal puts us in a planar coordinate system consistent with MicroStation's display system
      normal.scale(-1.0, normal);

      // pick the first vertex normal
      const sideVector = Vector3d.create(normal.y, -normal.x, 0.0);

      // if the magnitude of the normal is near zero, the real normal points
      // almost straighten up.. In this case, use Y as the up vector to match QV

      const magnitude = sideVector.magnitude();
      sideVector.normalize(sideVector); // won't remain undefined if failed due to following check..

      if (magnitude < 1e-3) {
        normal.set(0, 0, -1);
        sideVector.set(1, 0, 0);
      }

      const upVector = sideVector.crossProduct(normal).normalize();
      if (!upVector)
        return undefined;

      const numEdges = visitor.numEdgesThisFacet;
      for (let i = 0; i < numEdges; i++) {
        const vector = Vector3d.createFrom(points.getPoint3dAt(i));

        params.push(Point2d.create(vector.dotProduct(sideVector), vector.dotProduct(upVector)));
        uvTransform.multiplyPoint2d(params[i], params[i]);
      }
      return params;
    }

    /** Computes UV parameters given a texture mapping mode of elevation drape. The result is stored in the Point2d array given. */
    private computeElevationDrapeUVParams(visitor: IndexedPolyfaceVisitor, uvTransform: Transform, transformToIModel?: Transform): Point2d[] {
      const params: Point2d[] = [];
      const numEdges = visitor.numEdgesThisFacet;
      for (let i = 0; i < numEdges; i++) {
        const point = visitor.point.getPoint3dAt(i);

        if (transformToIModel !== undefined)
          transformToIModel.multiplyPoint3d(point, point);

        params.push(Point2d.createFrom(point));
        uvTransform.multiplyPoint2d(params[i], params[i]);
      }
      return params;
    }
  }
}
