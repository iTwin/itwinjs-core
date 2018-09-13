/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Rendering */

import { ClipVector, Transform, Point2d, Range3d, Point3d, IndexedPolyface, XAndY } from "@bentley/geometry-core";
import { assert, Id64, Id64String, IDisposable, dispose, disposeArray, base64StringToUint8Array } from "@bentley/bentleyjs-core";
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
  isValidImageSourceFormat,
} from "@bentley/imodeljs-common";
import { Viewport, ViewRect, ViewFrustum } from "../Viewport";
import { GraphicBuilder, GraphicType } from "./GraphicBuilder";
import { IModelConnection } from "../IModelConnection";
import { FeatureSymbology } from "./FeatureSymbology";
import { PolylineArgs, MeshArgs } from "./primitives/mesh/MeshPrimitives";
import { PointCloudArgs } from "./primitives/PointCloudPrimitive";
import { PointStringParams, MeshParams, PolylineParams } from "./primitives/VertexTable";
import { ImageUtil } from "../ImageUtil";
import { IModelApp } from "../IModelApp";
import { SkyBox } from "../DisplayStyleState";
import { Plane3dByOriginAndUnitNormal } from "@bentley/geometry-core/lib/AnalyticGeometry";
import { BeButtonEvent, BeWheelEvent } from "../tools/Tool";

/* A RenderPlan holds a Frustum and the render settings for displaying a RenderScene into a RenderTarget. */
export class RenderPlan {
  public readonly is3d: boolean;
  public readonly viewFlags: ViewFlags;
  public readonly viewFrustum: ViewFrustum;
  public readonly terrainFrustum: ViewFrustum | undefined;
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

  public selectTerrainFrustum() { if (undefined !== this.terrainFrustum) this._curFrustum = this.terrainFrustum; }
  public selectViewFrustum() { this._curFrustum = this.viewFrustum; }

  private constructor(is3d: boolean, viewFlags: ViewFlags, bgColor: ColorDef, monoColor: ColorDef, hiliteSettings: Hilite.Settings, aaLines: AntiAliasPref, aaText: AntiAliasPref, viewFrustum: ViewFrustum, terrainFrustum: ViewFrustum | undefined, activeVolume?: RenderClipVolume, hline?: HiddenLine.Params, lights?: SceneLights) {
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
    const terrainFrustum = (undefined === vp.backgroundMapPlane) ? undefined : ViewFrustum.createFromViewportAndPlane(vp, vp.backgroundMapPlane as Plane3dByOriginAndUnitNormal);

    const rp = new RenderPlan(view.is3d(), style.viewFlags, view.backgroundColor, style.monochromeColor, vp.hilite, vp.wantAntiAliasLines, vp.wantAntiAliasText, vp.viewFrustum, terrainFrustum!, activeVolume, hline, lights);

    return rp;
  }
}

/** A renderer-specific object that can be placed into a display list. Must have a `dispose` method. */
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

/** A Decoration that is drawn onto the 2d canvas on top of a ScreenViewport. CanvasDecorations may be pickable by implementing [[pick]]. */
export interface CanvasDecoration {
  [propName: string]: any;

  /**
   * Method to draw this decoration into the supplied CanvasRenderingContext2D. This method is called every time a frame is rendered.
   * @param ctx The CanvasRenderingContext2D for the [[ScreenViewport]] being rendered.
   * @note Before this this function is called, the state of the CanvasRenderingContext2D is [saved](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/save),
   * and it is [restored](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/restore) when this method returns. Therefore,
   * it is *not* necessary for implementers to save/restore themselves.
   */
  drawDecoration(ctx: CanvasRenderingContext2D): void;
  /**
   * Optional view coordinates position of this overlay decoration. If present, [ctx.translate](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/translate) is called
   * with this point before [[drawDecoration]] is called.
   */
  position?: XAndY;
  /** Optional method to provide feedback when mouse events occur on this decoration.
   * @param pt The position of the mouse in the ScreenViewport
   * @return true if the mouse is inside this decoration.
   * @note If this method is not present, no mouse events are directed to this decoration.
   */
  pick?(pt: XAndY): boolean;
  /** Optional method to be called whenever this decorator is picked and the mouse first enters this decoration. */
  onMouseEnter?(ev: BeButtonEvent): void;
  /** Optional method to be called whenever when the mouse leaves this decoration. */
  onMouseLeave?(): void;
  /** Optional method to be called whenever when the mouse moves inside this decoration. */
  onMouseMove?(ev: BeButtonEvent): void;
  /**
   * Optional method to be called whenever this decorator is picked and a mouse button is pressed or released inside this decoration.
   * @return true if the event was handled by this decoration and should *not* be forwarded to the active tool.
   * @note This method is called for both mouse up and down events. If it returns `true` for a down event, it should also return `true` for the
   * corresponding up event.
   */
  onMouseButton?(ev: BeButtonEvent): boolean;
  onWheel?(ev: BeWheelEvent): boolean;
}

export type CanvasDecorationList = CanvasDecoration[];

/**
 * Various of lists of RenderGraphics that are "decorated" into the RenderTarget, in addition to the Scene.
 */
export class Decorations implements IDisposable {
  private _skyBox?: RenderGraphic;
  private _viewBackground?: RenderGraphic; // drawn first, view units, with no zbuffer, smooth shading, default lighting. e.g., a skybox
  private _normal?: GraphicList;       // drawn with zbuffer, with scene lighting
  private _world?: GraphicList;        // drawn with zbuffer, with default lighting, smooth shading
  private _worldOverlay?: GraphicList; // drawn in overlay mode, world units
  private _viewOverlay?: GraphicList;  // drawn in overlay mode, view units
  public canvasDecorations?: CanvasDecorationList;

  public get skyBox(): RenderGraphic | undefined { return this._skyBox; }
  public set skyBox(skyBox: RenderGraphic | undefined) { dispose(this._skyBox); this._skyBox = skyBox; }
  public get viewBackground(): RenderGraphic | undefined { return this._viewBackground; }
  public set viewBackground(viewBackground: RenderGraphic | undefined) { dispose(this._viewBackground); this._viewBackground = viewBackground; }
  public get normal(): GraphicList | undefined { return this._normal; }
  public set normal(normal: GraphicList | undefined) { disposeArray(this._normal); this._normal = normal; }
  public get world(): GraphicList | undefined { return this._world; }
  public set world(world: GraphicList | undefined) { disposeArray(this._world); this._world = world; }
  public get worldOverlay(): GraphicList | undefined { return this._worldOverlay; }
  public set worldOverlay(worldOverlay: GraphicList | undefined) { disposeArray(this._worldOverlay); this._worldOverlay = worldOverlay; }
  public get viewOverlay(): GraphicList | undefined { return this._viewOverlay; }
  public set viewOverlay(viewOverlay: GraphicList | undefined) { disposeArray(this._viewOverlay); this._viewOverlay = viewOverlay; }

  public dispose() {
    this.skyBox = undefined;
    this.viewBackground = undefined;
    this.world = undefined;
    this.worldOverlay = undefined;
    this.viewOverlay = undefined;
    this.normal = undefined;
  }
}

export class GraphicBranch implements IDisposable {
  public readonly entries: RenderGraphic[] = [];
  public readonly ownsEntries: boolean;
  private _viewFlagOverrides = new ViewFlag.Overrides();
  public symbologyOverrides?: FeatureSymbology.Overrides;

  public constructor(ownsEntries: boolean = false) { this.ownsEntries = ownsEntries; }

  public add(graphic: RenderGraphic): void { this.entries.push(graphic); }
  public getViewFlags(flags: ViewFlags, out?: ViewFlags): ViewFlags { return this._viewFlagOverrides.apply(flags.clone(out)); }
  public setViewFlags(flags: ViewFlags): void { this._viewFlagOverrides.overrideAll(flags); }
  public setViewFlagOverrides(ovr: ViewFlag.Overrides): void { this._viewFlagOverrides.copyFrom(ovr); }
  public dispose() { this.clear(); }
  public get isEmpty(): boolean { return 0 === this.entries.length; }

  public clear(): void {
    if (this.ownsEntries)
      disposeArray(this.entries);
    else
      this.entries.length = 0;
  }
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
  public pickOverlayDecoration(_pt: XAndY): CanvasDecoration | undefined { return undefined; }

  public static get frustumDepth2d(): number { return 1.0; } // one meter
  public static get maxDisplayPriority(): number { return (1 << 23) - 32; }
  public static get minDisplayPriority(): number { return -this.maxDisplayPriority; }

  /** Returns a transform mapping an object's display priority to a depth from 0 to frustumDepth2d. */
  public static depthFromDisplayPriority(priority: number): number {
    return (priority - this.minDisplayPriority) / (this.maxDisplayPriority - this.minDisplayPriority) * this.frustumDepth2d;
  }

  public abstract get renderSystem(): RenderSystem;
  public abstract get cameraFrustumNearScaleLimit(): number;
  public abstract get viewRect(): ViewRect;
  public abstract get wantInvertBlackBackground(): boolean;

  public createGraphicBuilder(type: GraphicType, viewport: Viewport, placement: Transform = Transform.identity, pickableId?: Id64String) { return this.renderSystem.createGraphicBuilder(placement, type, viewport, pickableId); }

  public abstract dispose(): void;
  public abstract reset(): void;
  public abstract changeScene(scene: GraphicList, activeVolume?: RenderClipVolume): void;
  public abstract changeTerrain(_scene: GraphicList): void;
  public abstract changeDynamics(dynamics?: GraphicList): void;
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

export interface TextureImage {
  image: HTMLImageElement | undefined;
  format: ImageSourceFormat | undefined;
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

  public get isValid(): boolean { return this.canvas !== undefined; }
  public constructor(canvas: HTMLCanvasElement) { this.canvas = canvas; }

  public abstract dispose(): void;

  public get maxTextureSize(): number { return 0; }

  /** Create a render target which will render to the supplied canvas element. */
  public abstract createTarget(canvas: HTMLCanvasElement): RenderTarget;

  /** Create an offscreen render target. */
  public abstract createOffscreenTarget(rect: ViewRect): RenderTarget;

  /** Find a previously-created Material by key. Returns null if no such material exists. */
  public findMaterial(_key: string, _imodel: IModelConnection): RenderMaterial | undefined { return undefined; }

  /** Create a RenderMaterial from parameters */
  public createMaterial(_params: RenderMaterial.Params, _imodel: IModelConnection): RenderMaterial | undefined { return undefined; }

  /** Create a GraphicBuilder from parameters */
  public abstract createGraphicBuilder(placement: Transform, type: GraphicType, viewport: Viewport, pickableId?: Id64String): GraphicBuilder;

  // /** Create a Viewlet from parameters */
  // public abstract createViewlet(branch: GraphicBranch, plan: Plan, position: ViewletPosition): Graphic;

  /** Create a triangle mesh primitive */
  public createTriMesh(args: MeshArgs): RenderGraphic | undefined {
    const params = MeshParams.create(args);
    return this.createMesh(params);
  }

  /** Create an indexed polyline primitive */
  public createIndexedPolylines(args: PolylineArgs): RenderGraphic | undefined {
    if (args.flags.isDisjoint) {
      const pointStringParams = PointStringParams.create(args);
      return undefined !== pointStringParams ? this.createPointString(pointStringParams) : undefined;
    } else {
      const polylineParams = PolylineParams.create(args);
      return undefined !== polylineParams ? this.createPolyline(polylineParams) : undefined;
    }
  }

  /** Create a mesh primitive */
  public createMesh(_params: MeshParams): RenderGraphic | undefined { return undefined; }

  /** Create a polyline primitive */
  public createPolyline(_params: PolylineParams): RenderGraphic | undefined { return undefined; }

  /** Create a point string primitive */
  public createPointString(_params: PointStringParams): RenderGraphic | undefined { return undefined; }

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

  /** Create a Graphic for a sky box which encompasses the entire scene, rotating with the camera.  See SkyBox.CreateParams. */
  public createSkyBox(_params: SkyBox.CreateParams): RenderGraphic | undefined { return undefined; }

  /** Create a RenderGraphic consisting of a list of Graphics */
  public abstract createGraphicList(primitives: RenderGraphic[]): RenderGraphic;

  /** Create a RenderGraphic consisting of a list of Graphics, with optional transform, clip, and view flag overrides applied to the list */
  public abstract createBranch(branch: GraphicBranch, transform: Transform, clips?: RenderClipVolume): RenderGraphic;

  // /** Return the maximum number of Features allowed within a Batch. */
  // public abstract getMaxFeaturesPerBatch(): number;

  /** Create a RenderGraphic consisting of batched Features. */
  public abstract createBatch(graphic: RenderGraphic, features: FeatureTable, range: ElementAlignedBox3d): RenderGraphic;

  /** Locate a previously-created Texture given its key. */
  public findTexture(_key: string, _imodel: IModelConnection): RenderTexture | undefined { return undefined; }

  /** Find or create a texture from a texture element. */
  public async loadTexture(id: Id64String, iModel: IModelConnection): Promise<RenderTexture | undefined> {
    let texture = this.findTexture(id.toString(), iModel);
    if (undefined === texture) {
      const image = await this.loadTextureImage(id, iModel);
      if (undefined !== image) {
        // This will return a pre-existing RenderTexture if somebody else loaded it while we were awaiting the image.
        texture = this.createTextureFromImage(image.image!, ImageSourceFormat.Png === image.format!, iModel, new RenderTexture.Params(id.toString()));
      }
    }

    return texture;
  }

  public async loadTextureImage(id: Id64String, iModel: IModelConnection): Promise<TextureImage | undefined> {
    // ###TODO: We need a way in our callbacks to determine if the iModel has been closed...
    const elemProps = await iModel.elements.getProps(id);
    if (1 !== elemProps.length)
      return undefined;

    const textureProps = elemProps[0];
    if (undefined === textureProps.data || "string" !== typeof (textureProps.data) || undefined === textureProps.format || "number" !== typeof (textureProps.format))
      return undefined;

    const format = textureProps.format as ImageSourceFormat;
    if (!isValidImageSourceFormat(format))
      return undefined;

    const imageSource = new ImageSource(base64StringToUint8Array(textureProps.data as string), format);
    const imagePromise = ImageUtil.extractImage(imageSource);
    return imagePromise.then((image: HTMLImageElement) => ({ image, format }));
  }

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
