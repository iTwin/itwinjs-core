/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Rendering */

import { ClipVector, Transform } from "@bentley/geometry-core";
import { assert, Id64, Disposable, dispose } from "@bentley/bentleyjs-core";
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
  ImageSource,
  FeatureTable,
  Gradient,
  ElementAlignedBox3d,
} from "@bentley/imodeljs-common";
import { Viewport, ViewRect } from "../Viewport";
import { GraphicBuilder, GraphicBuilderCreateParams } from "./GraphicBuilder";
import { IModelConnection } from "../IModelConnection";
import { FeatureSymbology } from "./FeatureSymbology";
import { PolylineArgs, MeshArgs } from "./primitives/mesh/MeshPrimitives";

/**
 * A RenderPlan holds a Frustum and the render settings for displaying a Render::Scene into a Render::Target.
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
export abstract class RenderGraphic extends Disposable {
  public readonly iModel: IModelConnection;
  protected _isDisposed: boolean = true;  // we have a disposed graphic up until we add/create any non-disposed WebGL items

  constructor(iModel: IModelConnection) {
    super();
    this.iModel = iModel;
  }

  public get isDisposed(): boolean { return this._isDisposed; }
  protected abstract doDispose(): void;
}

export type GraphicList = RenderGraphic[];

/** A graphic used for decorations, optionally with symbology overrides. */
export class Decoration extends Disposable {
  public readonly graphic: RenderGraphic;
  public readonly overrides?: FeatureSymbology.Appearance;
  private _isDisposed: boolean;

  public get isDisposed(): boolean { return this._isDisposed; }

  public constructor(graphic: RenderGraphic, overrides?: FeatureSymbology.Appearance) {
    super();
    this.graphic = graphic;
    this.overrides = overrides;
    this._isDisposed = false; // assume given graphics are non-disposed
  }

  protected doDispose() {
    this.graphic.dispose();
    this._isDisposed = true;
  }
}

export class DecorationList extends Disposable {
  public readonly list: Decoration[];
  private _isDisposed: boolean = false;   // assume non-disposed to start, in case initializing a DecorationList with starting Decorations

  public constructor() { super(); this.list = []; }

  public get isDisposed(): boolean { return this._isDisposed; }

  // Note: This does not delete any decorations, but rather frees the contained WebGL resources
  protected doDispose() {
    for (const decoration of this.list)
      decoration.dispose();
    this._isDisposed = true;
  }

  public add(graphic: RenderGraphic, ovrs?: FeatureSymbology.Appearance) {
    this.list.push(new Decoration(graphic, ovrs));
    this._isDisposed = false; // assume added graphic is not disposed
  }
}

/**
 * A set of GraphicLists of various types of RenderGraphics that are "decorated" into the Render::Target,
 * in addition to the Scene.
 */
export class Decorations extends Disposable {
  private _viewBackground?: RenderGraphic; // drawn first, view units, with no zbuffer, smooth shading, default lighting. e.g., a skybox
  private _normal?: GraphicList;       // drawn with zbuffer, with scene lighting
  private _world?: DecorationList;        // drawn with zbuffer, with default lighting, smooth shading
  private _worldOverlay?: DecorationList; // drawn in overlay mode, world units
  private _viewOverlay?: DecorationList;  // drawn in overlay mode, view units

  // Getters & Setters - dispose of members before resetting
  public get viewBackground(): RenderGraphic | undefined { return this._viewBackground; }
  public set viewBackground(viewBackground: RenderGraphic | undefined) { dispose(this._viewBackground); this._viewBackground = viewBackground; }
  public get normal(): GraphicList | undefined { return this._normal; }
  public set normal(normal: GraphicList | undefined) {
    if (this._normal)
      for (const graphic of this._normal)
        graphic.dispose();
    this._normal = normal;
  }
  public get world(): DecorationList | undefined { return this._world; }
  public set world(world: DecorationList | undefined) { dispose(this._world); this._world = world; }
  public get worldOverlay(): DecorationList | undefined { return this._worldOverlay; }
  public set worldOverlay(worldOverlay: DecorationList | undefined) { dispose(this._worldOverlay); this._worldOverlay = worldOverlay; }
  public get viewOverlay(): DecorationList | undefined { return this._viewOverlay; }
  public set viewOverlay(viewOverlay: DecorationList | undefined) { dispose(this._viewOverlay); this._viewOverlay = viewOverlay; }

  // Decorations does not track whether or not it has been disposed... catch this within the member methods
  protected doDispose() {
    dispose(this._viewBackground);
    dispose(this._world);
    dispose(this._worldOverlay);
    dispose(this._viewOverlay);
    if (this._normal)
      for (const graphic of this._normal)
        graphic.dispose();
    this._viewBackground = this._normal = this._world = this._worldOverlay = this._viewOverlay = undefined;
  }

  // Only way to check if disposed is to test if all members are undefined
  public get isDisposed(): boolean {
    return this._viewBackground === undefined
      && this._normal === undefined
      && this._world === undefined
      && this._worldOverlay === undefined
      && this._viewOverlay === undefined;
  }
}

export class GraphicBranch extends Disposable {
  public readonly entries: RenderGraphic[] = [];
  private _viewFlagOverrides = new ViewFlag.Overrides();
  public symbologyOverrides?: FeatureSymbology.Overrides;
  private _isDisposed: boolean;

  public constructor() { super(); this._isDisposed = true; }

  public get isDisposed(): boolean { return this._isDisposed; }

  protected doDispose() {
    for (const graphic of this.entries)
      graphic.dispose();
    this._isDisposed = true;
  }

  public add(graphic: RenderGraphic): void {
    this.entries.push(graphic);
    this._isDisposed = false;
  }
  public addRange(graphics: RenderGraphic[]): void {
    graphics.forEach(this.add);
    this._isDisposed = false;
  }

  public getViewFlags(flags: ViewFlags, out?: ViewFlags): ViewFlags { return this._viewFlagOverrides.apply(flags.clone(out)); }
  public setViewFlags(flags: ViewFlags): void { this._viewFlagOverrides.overrideAll(flags); }
  public setViewFlagOverrides(ovr: ViewFlag.Overrides): void { this._viewFlagOverrides.copyFrom(ovr); }

  public clear() {
    this.dispose();
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
   * Bit-mask by which callers of DgnViewport::ReadPixels() specify which aspects are of interest.
   * Aspects not specified will be omitted from the returned data.
   */
  export const enum Selector {
    None = 0,
    ElementId = 1 << 0, // Select element IDs
    Distance = 1 << 1, // Select distances from near plane
    Geometry = 1 << 2, // Select geometry type and planarity

    GeometryAndDistance = Geometry | Distance, // Select geometry type/planarity and distance from near plane
    All = GeometryAndDistance | ElementId, // Select all aspects
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
 * A RenderTarget holds a reference to a Render::Device, and a RenderSystem
 * Every DgnViewport holds a reference to a RenderTarget.
 */
export abstract class RenderTarget extends Disposable {
  protected _isDisposed: boolean = true;  // we have a disposed target up until we add/create any non-disposed WebGL items

  public static get frustumDepth2d(): number { return 1.0; } // one meter

  public abstract get renderSystem(): RenderSystem;
  public abstract get cameraFrustumNearScaleLimit(): number;
  public abstract get viewRect(): ViewRect;
  public abstract get wantInvertBlackBackground(): boolean;

  public createGraphic(params: GraphicBuilderCreateParams) { return this.renderSystem.createGraphic(params); }

  protected abstract doDispose(): void;
  public get isDisposed(): boolean { return this._isDisposed; }
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

/**
 * A RenderSystem is the renderer-specific factory for creating Render::Graphics, Render::Textures, and Render::Materials.
 * @note The methods of this class may be called from any thread.
 */
export abstract class RenderSystem extends Disposable {
  protected _nowPainting?: RenderTarget;
  public readonly canvas: HTMLCanvasElement;
  public get isPainting(): boolean { return !!this._nowPainting; }
  public checkPainting(target?: RenderTarget): boolean { return target === this._nowPainting; }
  public startPainting(target?: RenderTarget): void { assert(!this.isPainting); this._nowPainting = target; }
  public nowPainting() { this._nowPainting = undefined; }
  protected _isDisposed: boolean = true; // is disposed until subclass creates WebGL resources

  public get isDisposed(): boolean { return this._isDisposed; }
  public isValid(): boolean { return this.canvas !== undefined; }
  public constructor(canvas: HTMLCanvasElement) { super(); this.canvas = canvas; }

  protected abstract doDispose(): void;

  /** Create a render target which will render to the supplied canvas element. */
  public abstract createTarget(canvas: HTMLCanvasElement): RenderTarget;

  // /** Create an offscreen render target. */
  public abstract createOffscreenTarget(rect: ViewRect): RenderTarget;

  /** Find a previously-created Material by key. Returns null if no such material exists. */
  public findMaterial(_key: string, _imodel: IModelConnection): RenderMaterial | undefined { return undefined; }

  /** Create a Material from parameters */
  public createMaterial(_params: RenderMaterial.Params, _imodel: IModelConnection): RenderMaterial | undefined { return undefined; }

  /** Create a GraphicBuilder from parameters */
  public abstract createGraphic(params: GraphicBuilderCreateParams): GraphicBuilder;

  // /** Create a Sprite from parameters */
  // public abstract createSprite(sprite: ISprite, location: Point3d, transparency: number, imodel: IModel): Graphic;

  // /** Create a Viewlet from parameters */
  // public abstract createViewlet(branch: GraphicBranch, plan: Plan, position: ViewletPosition): Graphic;

  // /** Create a triangle mesh primitive */
  public createTriMesh(_args: MeshArgs, _imodel: IModelConnection): RenderGraphic | undefined { return undefined; }

  // /** Create an indexed polyline primitive */
  public createIndexedPolylines(_args: PolylineArgs, _imodel: IModelConnection): RenderGraphic | undefined { return undefined; }

  // /** Create a point cloud primitive */
  // public abstract createPointCloud(args: PointCloudArgs, imodel: IModel): Graphic;

  // /** Create polygons on a range for a sheet tile */
  // public abstract createSheetTilePolys(corners: GraphicBuilderTileCorners, clip: ClipVector, rangeOut: Range3d): PolyfaceHeader[];

  // /** Create a sheet tile primitive from polys */
  // public abstract createSheetTile(tile: Texture, corners: GraphicBuilderTileCorners, imodel: IModel, params: GraphicParams): Graphic[];

  // /** Create a tile primitive */
  // public abstract createTile(tile: Texture, corners: GraphicBuilderTileCorners, imodel: IModel, params: GraphicParams): Graphic;

  /** Create a Graphic consisting of a list of Graphics */
  public abstract createGraphicList(primitives: RenderGraphic[], imodel: IModelConnection): RenderGraphic;

  /** Create a Graphic consisting of a list of Graphics, with optional transform, clip, and view flag overrides applied to the list */
  public abstract createBranch(branch: GraphicBranch, imodel: IModelConnection, transform: Transform, clips?: ClipVector): RenderGraphic;

  // /** Return the maximum number of Features allowed within a Batch. */
  // public abstract getMaxFeaturesPerBatch(): number;

  /** Create a Graphic consisting of batched Features. */
  public abstract createBatch(graphic: RenderGraphic, features: FeatureTable, range: ElementAlignedBox3d): RenderGraphic;

  /** Get or create a Texture from a RenderTexture element. Note that there is a cache of textures stored on an IModel, so this may return a pointer to a previously-created texture. */
  public findTexture(_key: string, _imodel: IModelConnection): RenderTexture | undefined { return undefined; }

  /** Create a new Texture from gradient symbology. */
  public getGradientTexture(_symb: Gradient.Symb, _imodel: IModelConnection): RenderTexture | undefined { return undefined; }

  /** Create a new Texture from an ImageBuffer. */
  public createTextureFromImageBuffer(_image: ImageBuffer, _imodel: IModelConnection, _params: RenderTexture.Params): RenderTexture | undefined { return undefined; }

  /** Create a new Texture from an ImageSource. */
  public createTextureFromImageSource(_source: ImageSource, _width: number, _height: number, _imodel: IModelConnection, _params: RenderTexture.Params): RenderTexture | undefined { return undefined; }

  // /** Create a Texture from a graphic. */
  // public abstract createGeometryTexture(graphic: Graphic, range: Range2d, useGeometryColors: boolean, forAreaPattern: boolean): Texture;

  // /** Create a Light from Light::Parameters */
  // public abstract createLight(params: LightingParameters, direction: Vector3d, location: Point3d): Light;

  /**
   * Perform some small unit of work (or do nothing) during an idle frame.
   * An idle frame is classified one tick of the render loop during which no viewports are open and the render queue is empty.
   */
  public idle(): void { }

  public onInitialized(): void { }
  public onShutDown(): void { }
}
