/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Rendering */

import { ClipVector, Transform, Point2d, Range3d, Point3d, IndexedPolyface } from "@bentley/geometry-core";
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
  Feature,
  Gradient,
  ElementAlignedBox3d,
  QParams3d,
  QPoint3dList,
  ImageSource,
  ImageSourceFormat,
} from "@bentley/imodeljs-common";
import { Viewport, ViewRect, ViewFrustum } from "../Viewport";
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
  public readonly viewFrustum: ViewFrustum;
  public readonly terrainFrustum: ViewFrustum;
  public readonly bgColor: ColorDef;
  public readonly monoColor: ColorDef;
  public readonly hiliteSettings: Hilite.Settings;
  public readonly aaLines: AntiAliasPref;
  public readonly aaText: AntiAliasPref;
  public readonly activeVolume?: RenderClipVolume;
  public readonly hline?: HiddenLine.Params;
  public readonly lights?: SceneLights;
  private _curFrustum: ViewFrustum;

  public get frustum(): Frustum { return this._curFrustum.getFrustum(); }
  public get fraction(): number { return this._curFrustum.frustFraction; }

  public selectTerrainFrustum() { this._curFrustum = this.terrainFrustum; }
  public selectViewFrustum() { this._curFrustum = this.viewFrustum; }

  private constructor(is3d: boolean, viewFlags: ViewFlags, bgColor: ColorDef, monoColor: ColorDef, hiliteSettings: Hilite.Settings, aaLines: AntiAliasPref, aaText: AntiAliasPref, viewFrustum: ViewFrustum, terrainFrustum: ViewFrustum, activeVolume?: RenderClipVolume, hline?: HiddenLine.Params, lights?: SceneLights) {
    this.is3d = is3d;
    this.viewFlags = viewFlags;
    this.bgColor = bgColor;
    this.monoColor = monoColor;
    this.hiliteSettings = hiliteSettings;
    this.aaLines = aaLines;
    this.aaText = aaText;
    this.activeVolume = activeVolume;
    this.hline = hline;
    this.lights = lights;
    this._curFrustum = this.viewFrustum = viewFrustum;
    this.terrainFrustum = terrainFrustum;
  }

  public static createFromViewport(vp: Viewport): RenderPlan {
    const view = vp.view;
    const style = view.displayStyle;

    const hline = style.is3d() ? style.getHiddenLineParams() : undefined;
    const lights = undefined; // view.is3d() ? view.getLights() : undefined
    const clipVec = view.getViewClip();
    const activeVolume = clipVec !== undefined ? IModelApp.renderSystem.getClipVolume(clipVec, view.iModel) : undefined;

    const terrainFrustum = ViewFrustum.createFromWidenedViewport(vp);
    assert(terrainFrustum !== undefined);

    const rp = new RenderPlan(view.is3d(), style.viewFlags, view.backgroundColor, style.getMonochromeColor(), vp.hilite, vp.wantAntiAliasLines, vp.wantAntiAliasText, vp.viewFrustum, terrainFrustum!, activeVolume, hline, lights);

    return rp;
  }
}

/** A renderer-specific object that can be placed into a display list. */
export abstract class RenderGraphic implements IDisposable {
  public abstract dispose(): void;
}

/** A type of clip volume being used for clipping. */
export const enum ClippingType {
  None,
  Mask,
  Planes,
}

/** Interface adopted by a type which can apply a clipping volume to a Target. */
export abstract class RenderClipVolume implements IDisposable {
  /** Returns the type of this clipping volume. */
  public abstract get type(): ClippingType;

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
  public abstract changeScene(scene: GraphicList, activeVolume?: RenderClipVolume): void;
  public abstract changeTerrain(_scene: GraphicList): void;
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
  public abstract readImage(rect: ViewRect, targetSize: Point2d): ImageBuffer | undefined;
}

export enum SkyboxSphereType {
  Gradient2Color,
  Gradient4Color,
  Texture,
}

export class SkyBoxCreateParams {
  private _isSphere: boolean;

  public readonly texture?: RenderTexture;
  public readonly sphereType?: SkyboxSphereType;
  public readonly zOffset?: number;
  public readonly rotation?: number;
  public readonly zenithColor?: ColorDef;
  public readonly skyColor?: ColorDef;
  public readonly groundColor?: ColorDef;
  public readonly nadirColor?: ColorDef;
  public readonly skyExponent?: number;
  public readonly groundExponent?: number;

  public get isTexturedCube() { return !this._isSphere; }
  public get isSphere() { return this._isSphere; }

  private constructor(_isSphere: boolean, texture?: RenderTexture, sphereType?: SkyboxSphereType, zOffset?: number, rotation?: number, zenithColor?: ColorDef, nadirColor?: ColorDef, skyColor?: ColorDef, groundColor?: ColorDef, skyExponent?: number, groundExponent?: number) {
    this._isSphere = _isSphere;
    this.texture = texture;
    this.sphereType = sphereType;
    this.zOffset = zOffset;
    this.rotation = rotation;
    this.zenithColor = zenithColor;
    this.skyColor = skyColor;
    this.groundColor = groundColor;
    this.nadirColor = nadirColor;
    this.skyExponent = skyExponent;
    this.groundExponent = groundExponent;
  }

  public static createForTexturedCube(cube: RenderTexture) {
    return new SkyBoxCreateParams(false, cube);
  }

  public static createForGradientSphere(sphereType: SkyboxSphereType, zOffset: number, zenithColor: ColorDef, nadirColor: ColorDef,
    skyColor?: ColorDef, groundColor?: ColorDef, skyExponent?: number, groundExponent?: number) {
    // Check arguments.
    assert(SkyboxSphereType.Texture !== sphereType);
    if (SkyboxSphereType.Gradient4Color !== sphereType) {
      assert(undefined !== skyColor);
      assert(undefined !== groundColor);
      assert(undefined !== skyExponent);
      assert(undefined !== groundExponent);
    }
    return new SkyBoxCreateParams(true, undefined, sphereType, zOffset, 0, zenithColor, nadirColor, skyColor, groundColor, skyExponent, groundExponent);
  }

  public static createForTexturedSphere(texture: RenderTexture, zOffset: number, rotation: number) {
    return new SkyBoxCreateParams(true, texture, SkyboxSphereType.Texture, zOffset, rotation);
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

  /** Create a point cloud primitive */
  public createPointCloud(_args: PointCloudArgs, _imodel: IModelConnection): RenderGraphic | undefined { return undefined; }

  /** Create polygons on a range for a sheet tile. */
  public createSheetTilePolyfaces(_corners: Point3d[], _clip?: ClipVector): IndexedPolyface[] { return []; }

  /** Create a sheet tile primitive from polyfaces. */
  public createSheetTile(_tile: RenderTexture, _polyfaces: IndexedPolyface[], _tileColor: ColorDef): GraphicList { return []; }

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

  /**
   * Create a pickable decoration. A pickable decoration is a decoration graphic which can be located by tools.
   * @param graphic The graphics which will be rendered for the decoration. The graphic must be defined in world coordinates, so it cannot be a view overlay, but could be a world overlay.
   * @param id Uniquely identifies the decoration, obtained from IModelConnection.transientIds.
   * @param range Optionally describes the range of the graphic in world coordinates. Used for culling.
   * @returns A RenderGraphic suitable for adding to a DecorateContext.
   */
  public createPickableDecoration(graphic: RenderGraphic, id: Id64, range?: ElementAlignedBox3d): RenderGraphic {
    if (!id.isValid) {
      assert(false, "Pickable decoration requires an ID");
      return graphic;
    }

    const features = new FeatureTable(1);
    features.insert(new Feature(id));
    return this.createBatch(graphic, features, undefined !== range ? range : new ElementAlignedBox3d());
  }

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

  /** Create a new Texture from a cube of HTML images. Typically the images were extracted from a binary representation of a jpeg or png via ImageUtil.extractImage() */
  public createTextureFromCubeImages(_posX: HTMLImageElement, _negX: HTMLImageElement, _posY: HTMLImageElement, _negY: HTMLImageElement, _posZ: HTMLImageElement, _negZ: HTMLImageElement, _imodel: IModelConnection, _params: RenderTexture.Params): RenderTexture | undefined { return undefined; }

  // /** Create a Light from Light.Parameters */
  // public abstract createLight(params: LightingParameters, direction: Vector3d, location: Point3d): Light;

  public onInitialized(): void { }
}
