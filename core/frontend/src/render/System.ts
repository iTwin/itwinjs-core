/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Rendering */

import { ClipVector, Transform, Point2d, Range3d, Point3d } from "@bentley/geometry-core";
import { assert, Id64, IDisposable, dispose } from "@bentley/bentleyjs-core";
import {
  AntiAliasPref,
  SceneLights,
  ViewFlags,
  ViewFlag,
  Frustum,
  Hilite,
  HiddenLine,
  ColorDef,
  RenderMaterial,
  ImageBuffer,
  RenderTexture,
  FeatureTable,
  Gradient,
  ElementAlignedBox3d,
  QParams3d,
  QPoint3dList,
  ImageSource,
  ImageSourceFormat,
} from "@bentley/imodeljs-common";
import { Viewport, ViewRect } from "../Viewport";
import { GraphicBuilder, GraphicBuilderCreateParams } from "./GraphicBuilder";
import { IModelConnection } from "../IModelConnection";
import { FeatureSymbology } from "./FeatureSymbology";
import { PolylineArgs, MeshArgs } from "./primitives/mesh/MeshPrimitives";
import { PointCloudArgs } from "./primitives/PointCloudPrimitive";
import { ImageUtil } from "../ImageUtil";
import { IModelApp } from "../IModelApp";

/**
 * A RenderPlan holds a Frustum and the render settings for displaying a RenderScene into a RenderTarget.
 */
export class RenderPlan {
  public readonly is3d: boolean;
  public readonly viewFlags: ViewFlags;
  public readonly frustum: Frustum;
  public readonly fraction: number;
  public readonly bgColor: ColorDef;
  public readonly monoColor: ColorDef;
  public readonly hiliteSettings: Hilite.Settings;
  public readonly aaLines: AntiAliasPref;
  public readonly aaText: AntiAliasPref;
  public readonly activeVolume?: ClipVector;
  public readonly hline?: HiddenLine.Params;
  public readonly lights?: SceneLights;

  public constructor(vp: Viewport) {
    const view = vp.view;
    const style = view.displayStyle;

    this.is3d = view.is3d();
    this.viewFlags = style.viewFlags;
    this.frustum = vp.getFrustum()!;
    this.fraction = vp.frustFraction;
    this.bgColor = view.backgroundColor;
    this.monoColor = style.getMonochromeColor();
    this.hiliteSettings = vp.hilite;
    this.aaLines = vp.wantAntiAliasLines;
    this.aaText = vp.wantAntiAliasText;
    this.activeVolume = view.getViewClip();
    this.hline = style.is3d() ? style.getHiddenLineParams() : undefined;
    this.lights = undefined; // view.is3d() ? view.getLights() : undefined
  }
}

/** A renderer-specific object that can be placed into a display list. */
export abstract class RenderGraphic implements IDisposable {
  public abstract dispose(): void;
}

/** Interface adopted by a type which can apply a clipping volume to a Target. */
export abstract class RenderClipVolume implements IDisposable {
  public abstract dispose(): void;
}

export type GraphicList = RenderGraphic[];

/** A graphic used for decorations, optionally with symbology overrides. */
export class Decoration implements IDisposable {
  public readonly graphic: RenderGraphic;
  public readonly overrides?: FeatureSymbology.Appearance;

  public constructor(graphic: RenderGraphic, overrides?: FeatureSymbology.Appearance) {
    this.graphic = graphic;
    this.overrides = overrides;
  }

  public dispose() {
    dispose(this.graphic);
  }
}

export class DecorationList implements IDisposable {
  public readonly list: Decoration[];

  public constructor() { this.list = []; }

  public dispose() {
    for (const decoration of this.list)
      dispose(decoration);
    this.list.length = 0;
  }

  public add(graphic: RenderGraphic, ovrs?: FeatureSymbology.Appearance) {
    this.list.push(new Decoration(graphic, ovrs));
  }
}

/**
 * A set of GraphicLists of various types of RenderGraphics that are "decorated" into the RenderTarget,
 * in addition to the Scene.
 */
export class Decorations implements IDisposable {
  private _skyBox?: RenderGraphic;
  private _viewBackground?: RenderGraphic; // drawn first, view units, with no zbuffer, smooth shading, default lighting. e.g., a skybox
  private _normal?: GraphicList;       // drawn with zbuffer, with scene lighting
  private _world?: DecorationList;        // drawn with zbuffer, with default lighting, smooth shading
  private _worldOverlay?: DecorationList; // drawn in overlay mode, world units
  private _viewOverlay?: DecorationList;  // drawn in overlay mode, view units

  // Getters & Setters - dispose of members before resetting
  public get skyBox(): RenderGraphic | undefined { return this._skyBox; }
  public set skyBox(skyBox: RenderGraphic | undefined) {
    dispose(this._skyBox);
    this._skyBox = skyBox;
  }
  public get viewBackground(): RenderGraphic | undefined { return this._viewBackground; }
  public set viewBackground(viewBackground: RenderGraphic | undefined) {
    dispose(this._viewBackground);  // no effect if already disposed
    this._viewBackground = viewBackground;
  }
  public get normal(): GraphicList | undefined { return this._normal; }
  public set normal(normal: GraphicList | undefined) {
    if (this._normal)
      for (const graphic of this._normal)
        dispose(graphic);
    this._normal = normal;
  }
  public get world(): DecorationList | undefined { return this._world; }
  public set world(world: DecorationList | undefined) {
    dispose(this._world); // no effect if already disposed
    this._world = world;
  }
  public get worldOverlay(): DecorationList | undefined { return this._worldOverlay; }
  public set worldOverlay(worldOverlay: DecorationList | undefined) {
    dispose(this._worldOverlay);  // no effect if already disposed
    this._worldOverlay = worldOverlay;
  }
  public get viewOverlay(): DecorationList | undefined { return this._viewOverlay; }
  public set viewOverlay(viewOverlay: DecorationList | undefined) {
    dispose(this._viewOverlay); // no effect if already disposed
    this._viewOverlay = viewOverlay;
  }

  public dispose() {
    this._skyBox = dispose(this._skyBox);
    this._viewBackground = dispose(this._viewBackground);
    this._world = dispose(this._world);
    this._worldOverlay = dispose(this._worldOverlay);
    this._viewOverlay = dispose(this._viewOverlay);
    if (this._normal)
      for (const graphic of this._normal)
        dispose(graphic);
    this._normal = undefined;
  }
}

export class GraphicBranch {
  public readonly entries: RenderGraphic[] = [];
  private _viewFlagOverrides = new ViewFlag.Overrides();
  public symbologyOverrides?: FeatureSymbology.Overrides;

  public constructor() { }

  public add(graphic: RenderGraphic): void {
    this.entries.push(graphic);
  }
  public addRange(graphics: RenderGraphic[]): void {
    graphics.forEach(this.add);
  }

  public getViewFlags(flags: ViewFlags, out?: ViewFlags): ViewFlags { return this._viewFlagOverrides.apply(flags.clone(out)); }
  public setViewFlags(flags: ViewFlags): void { this._viewFlagOverrides.overrideAll(flags); }
  public setViewFlagOverrides(ovr: ViewFlag.Overrides): void { this._viewFlagOverrides.copyFrom(ovr); }

  public clear() {
    this.entries.length = 0;
  }
  public get isEmpty(): boolean { return 0 === this.entries.length; }
}

/** Describes aspects of a pixel as read from a RenderTarget. */
export namespace Pixel {
  export class Data {
    public constructor(public readonly elementId?: Id64,
      public readonly distanceFraction: number = -1.0,
      public readonly type: GeometryType = GeometryType.Unknown,
      public readonly planarity: Planarity = Planarity.Unknown) { }
  }

  /** Describes the foremost type of geometry which produced the pixel. */
  export const enum GeometryType {
    Unknown, // Geometry was not selected, or type could not be determined
    None, // No geometry was rendered to this pixel
    Surface, // A surface
    Linear, // A polyline
    Edge, // The edge of a surface
    Silhouette, // A silhouette of a surface
  }

  /** Describes the planarity of the foremost geometry which produced the pixel. */
  export const enum Planarity {
    Unknown, // Geometry was not selected, or planarity could not be determined
    None, // No geometry was rendered to this pixel
    Planar, // Planar geometry
    NonPlanar, // Non-planar geometry
  }

  /**
   * Bit-mask by which callers of [[Viewport.readPixels]] specify which aspects are of interest.
   *
   * Aspects not specified will be omitted from the returned data.
   */
  export const enum Selector {
    None = 0,
    /** Select element Ids */
    ElementId = 1 << 0,
    /** Select distances from near plane */
    Distance = 1 << 1,
    /** Select geometry type and planarity */
    Geometry = 1 << 2,
    /** Select geometry type/planarity and distance from near plane */
    GeometryAndDistance = Geometry | Distance,
    /** Select all aspects */
    All = GeometryAndDistance | ElementId,
  }

  /** A rectangular array of pixels as read from a RenderTarget's frame buffer. */
  export interface Buffer {
    /** Retrieve the data associated with the pixel at (x,y) in view coordinates. */
    getPixel(x: number, y: number): Data;
  }
}

/**
 * A RenderTarget holds the current scene, the current set of dynamic RenderGraphics, and the current decorators.
 * When frames are composed, all of those RenderGraphics are rendered, as appropriate.
 *
 * A RenderTarget holds a reference to a RenderSystem.
 *
 * Every Viewport holds a reference to a RenderTarget.
 */
export abstract class RenderTarget implements IDisposable {

  public static get frustumDepth2d(): number { return 1.0; } // one meter
  public static get maxDisplayPriority(): number { return (1 << 23) - 32; }
  public static get displayPriorityFactor(): number { return this.frustumDepth2d / (this.maxDisplayPriority + 1); }

  public static depthFromDisplayPriority(priority: number): number { return this.displayPriorityFactor * priority; }

  public abstract get renderSystem(): RenderSystem;
  public abstract get cameraFrustumNearScaleLimit(): number;
  public abstract get viewRect(): ViewRect;
  public abstract get wantInvertBlackBackground(): boolean;

  public createGraphic(params: GraphicBuilderCreateParams) { return this.renderSystem.createGraphic(params); }

  public abstract dispose(): void;
  public abstract reset(): void;
  public abstract changeScene(scene: GraphicList, activeVolume?: ClipVector): void;
  public abstract changeDynamics(dynamics?: DecorationList): void;
  public abstract changeDecorations(decorations: Decorations): void;
  public abstract changeRenderPlan(plan: RenderPlan): void;
  public abstract drawFrame(sceneMilSecElapsed?: number): void;
  public abstract overrideFeatureSymbology(ovr: FeatureSymbology.Overrides): void;
  public abstract setHiliteSet(hilited: Set<string>): void;
  public abstract setFlashed(elementId: Id64, intensity: number): void;
  public abstract setViewRect(rect: ViewRect, temporary: boolean): void;
  public abstract queueReset(): void;
  public abstract onResized(): void;
  public abstract updateViewRect(): boolean; // force a RenderTarget viewRect to resize if necessary since last draw
  public abstract readPixels(rect: ViewRect, selector: Pixel.Selector): Pixel.Buffer | undefined;

  // ###TODO public abstract readImage(rect: ViewRect, targetSize: Point2d): Image;
}

export class SkyBoxCreateParams {
  private _isGradient: boolean;

  public readonly front?: RenderTexture;
  public readonly back?: RenderTexture;
  public readonly top?: RenderTexture;
  public readonly bottom?: RenderTexture;
  public readonly left?: RenderTexture;
  public readonly right?: RenderTexture;

  public get isTexturedCube() { return !this._isGradient; }
  public get isGradient() { return this._isGradient; }

  private constructor(isGradient: boolean, front?: RenderTexture, back?: RenderTexture, top?: RenderTexture, bottom?: RenderTexture, left?: RenderTexture, right?: RenderTexture) {
    this._isGradient = isGradient;
    this.front = front;
    this.back = back;
    this.top = top;
    this.bottom = bottom;
    this.left = left;
    this.right = right;
  }

  public static createForTexturedCube(front: RenderTexture, back: RenderTexture, top: RenderTexture, bottom: RenderTexture, left: RenderTexture, right: RenderTexture) {
    return new SkyBoxCreateParams(false, front, back, top, bottom, left, right);
  }

  public static createForGradient() {
    // ###TODO
    return new SkyBoxCreateParams(true);
  }
}

/**
 * A RenderSystem is the renderer-specific factory for creating RenderGraphics, RenderTexture, and RenderMaterials.
 */
export abstract class RenderSystem implements IDisposable {
  protected _nowPainting?: RenderTarget;
  public readonly canvas: HTMLCanvasElement;
  public get isPainting(): boolean { return !!this._nowPainting; }
  public checkPainting(target?: RenderTarget): boolean { return target === this._nowPainting; }
  public startPainting(target?: RenderTarget): void { assert(!this.isPainting); this._nowPainting = target; }
  public nowPainting() { this._nowPainting = undefined; }

  public isValid(): boolean { return this.canvas !== undefined; }
  public constructor(canvas: HTMLCanvasElement) { this.canvas = canvas; }

  public abstract dispose(): void;

  /** Create a render target which will render to the supplied canvas element. */
  public abstract createTarget(canvas: HTMLCanvasElement): RenderTarget;

  /** Create an offscreen render target. */
  public abstract createOffscreenTarget(rect: ViewRect): RenderTarget;

  /** Find a previously-created Material by key. Returns null if no such material exists. */
  public findMaterial(_key: string, _imodel: IModelConnection): RenderMaterial | undefined { return undefined; }

  /** Create a RenderMaterial from parameters */
  public createMaterial(_params: RenderMaterial.Params, _imodel: IModelConnection): RenderMaterial | undefined { return undefined; }

  /** Create a GraphicBuilder from parameters */
  public abstract createGraphic(params: GraphicBuilderCreateParams): GraphicBuilder;

  // /** Create a Viewlet from parameters */
  // public abstract createViewlet(branch: GraphicBranch, plan: Plan, position: ViewletPosition): Graphic;

  /** Create a triangle mesh primitive */
  public createTriMesh(_args: MeshArgs): RenderGraphic | undefined { return undefined; }

  /** Create an indexed polyline primitive */
  public createIndexedPolylines(_args: PolylineArgs): RenderGraphic | undefined { return undefined; }

  // /** Create a point cloud primitive */
  public createPointCloud(_args: PointCloudArgs, _imodel: IModelConnection): RenderGraphic | undefined { return undefined; }

  /** Attempt to create a clipping volume for the given iModel using a clip vector. */
  public getClipVolume(_clipVector: ClipVector, _imodel: IModelConnection): RenderClipVolume | undefined { return undefined; }

  /** Create a tile primitive */
  public createTile(tileTexture: RenderTexture, corners: Point3d[]): RenderGraphic | undefined {
    const rasterTile = new MeshArgs();

    // corners
    // [0] [1]
    // [2] [3]
    rasterTile.points = new QPoint3dList(QParams3d.fromRange(Range3d.create(...corners)));
    for (let i = 0; i < 4; ++i)
      rasterTile.points.add(corners[i]);

    rasterTile.vertIndices = [0, 1, 2, 2, 1, 3];
    rasterTile.textureUv = [
      new Point2d(0.0, 0.0),
      new Point2d(1.0, 0.0),
      new Point2d(0.0, 1.0),
      new Point2d(1.0, 1.0),
    ];

    rasterTile.texture = tileTexture;
    rasterTile.isPlanar = true;
    return this.createTriMesh(rasterTile);
  }

  /** Create a Graphic for a sky box which encompasses the entire scene, rotating with the camera.  See SkyBoxCreateParams. */
  public createSkyBox(_params: SkyBoxCreateParams): RenderGraphic | undefined { return undefined; }

  /** Create a RenderGraphic consisting of a list of Graphics */
  public abstract createGraphicList(primitives: RenderGraphic[]): RenderGraphic;

  /** Create a RenderGraphic consisting of a list of Graphics, with optional transform, clip, and view flag overrides applied to the list */
  public abstract createBranch(branch: GraphicBranch, transform: Transform, clips?: RenderClipVolume): RenderGraphic;

  // /** Return the maximum number of Features allowed within a Batch. */
  // public abstract getMaxFeaturesPerBatch(): number;

  /** Create a RenderGraphic consisting of batched Features. */
  public abstract createBatch(graphic: RenderGraphic, features: FeatureTable, range: ElementAlignedBox3d): RenderGraphic;

  /** Get or create a Texture from a RenderTexture element. Note that there is a cache of textures stored on an IModel, so this may return a pointer to a previously-created texture. */
  public findTexture(_key: string, _imodel: IModelConnection): RenderTexture | undefined { return undefined; }

  /** Create a new Texture from gradient symbology. */
  public getGradientTexture(_symb: Gradient.Symb, _imodel: IModelConnection): RenderTexture | undefined { return undefined; }

  /** Create a new Texture from an ImageBuffer. */
  public createTextureFromImageBuffer(_image: ImageBuffer, _imodel: IModelConnection, _params: RenderTexture.Params): RenderTexture | undefined { return undefined; }

  /** Create a new Texture from an HTML image. Typically the image was extracted from a binary representation of a jpeg or png via ImageUtil.extractImage() */
  public createTextureFromImage(_image: HTMLImageElement, _hasAlpha: boolean, _imodel: IModelConnection | undefined, _params: RenderTexture.Params): RenderTexture | undefined { return undefined; }

  /** Create a new Texture from an ImageSource. */
  public async createTextureFromImageSource(source: ImageSource, imodel: IModelConnection | undefined, params: RenderTexture.Params): Promise<RenderTexture | undefined> {
    return ImageUtil.extractImage(source).then((image) => IModelApp.hasRenderSystem ? this.createTextureFromImage(image, ImageSourceFormat.Png === source.format, imodel, params) : undefined);
  }

  // /** Create a Light from Light.Parameters */
  // public abstract createLight(params: LightingParameters, direction: Vector3d, location: Point3d): Light;

  public onInitialized(): void { }
}
