/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Rendering */

import { ClipVector, Transform } from "@bentley/geometry-core";
import { assert, Id64, IDisposable } from "@bentley/bentleyjs-core";
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

/**
 * A renderer-specific object that can be placed into a display list.
 */
export abstract class RenderGraphic implements IDisposable {
  public abstract dispose(): void;
}

export type GraphicList = RenderGraphic[];

/** A graphic used for decorations, optionally with symbology overrides. */
export class Decoration {
  public readonly graphic: RenderGraphic;
  public readonly overrides?: FeatureSymbology.Appearance;

  public constructor(graphic: RenderGraphic, overrides?: FeatureSymbology.Appearance) {
    this.graphic = graphic;
    this.overrides = overrides;
  }
}

export class DecorationList extends Array<Decoration> {
  public add(graphic: RenderGraphic, ovrs?: FeatureSymbology.Appearance) { this.push(new Decoration(graphic, ovrs)); }
}

/**
 * A set of GraphicLists of various types of RenderGraphics that are "decorated" into the Render::Target,
 * in addition to the Scene.
 */
export class Decorations implements IDisposable {
  public viewBackground?: RenderGraphic; // drawn first, view units, with no zbuffer, smooth shading, default lighting. e.g., a skybox
  public normal?: GraphicList;       // drawn with zbuffer, with scene lighting
  public world?: DecorationList;        // drawn with zbuffer, with default lighting, smooth shading
  public worldOverlay?: DecorationList; // drawn in overlay mode, world units
  public viewOverlay?: DecorationList;  // drawn in overlay mode, view units

  public reset(): void {
    this.viewBackground = undefined;
    this.normal = undefined;
    this.world = this.worldOverlay = this.viewOverlay = undefined;
  }

  /** Dispose of all of the contained RenderGraphics and WebGL resources corresponding to these decorations. */
  public dispose(): void {
    if (this.viewBackground)
      this.viewBackground.dispose();
    if (this.normal)
      for (const graphic of this.normal)
        graphic.dispose();
    if (this.world)
      for (const decoration of this.world)
        decoration.graphic.dispose();
    if (this.worldOverlay)
      for (const decoration of this.worldOverlay)
        decoration.graphic.dispose();
    if (this.viewOverlay)
      for (const decoration of this.viewOverlay)
        decoration.graphic.dispose();
  }
}

export class GraphicBranch {
  public readonly entries: RenderGraphic[] = [];
  private _viewFlagOverrides = new ViewFlag.Overrides();
  public symbologyOverrides?: FeatureSymbology.Overrides;

  public constructor() { }

  public add(graphic: RenderGraphic): void { this.entries.push(graphic); }
  public addRange(graphics: RenderGraphic[]): void { graphics.forEach(this.add); }

  public getViewFlags(flags: ViewFlags, out?: ViewFlags): ViewFlags { return this._viewFlagOverrides.apply(flags.clone(out)); }
  public setViewFlags(flags: ViewFlags): void { this._viewFlagOverrides.overrideAll(flags); }
  public setViewFlagOverrides(ovr: ViewFlag.Overrides): void { this._viewFlagOverrides.copyFrom(ovr); }

  public clear() { this.entries.length = 0; }
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
export abstract class RenderTarget implements IDisposable {
  public static get frustumDepth2d(): number { return 1.0; } // one meter

  public abstract get renderSystem(): RenderSystem;
  public abstract get cameraFrustumNearScaleLimit(): number;
  public abstract get viewRect(): ViewRect;
  public abstract get wantInvertBlackBackground(): boolean;

  public createGraphic(params: GraphicBuilderCreateParams) { return this.renderSystem.createGraphic(params); }

  public dispose() { }
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
export abstract class RenderSystem {
  protected _nowPainting?: RenderTarget;
  public readonly canvas: HTMLCanvasElement;
  public get isPainting(): boolean { return !!this._nowPainting; }
  public checkPainting(target?: RenderTarget): boolean { return target === this._nowPainting; }
  public startPainting(target?: RenderTarget): void { assert(!this.isPainting); this._nowPainting = target; }
  public nowPainting() { this._nowPainting = undefined; }

  public isValid(): boolean { return this.canvas !== undefined; }
  public constructor(canvas: HTMLCanvasElement) { this.canvas = canvas; }

  /** Create a render target which will render to the supplied canvas element. */
  public abstract createTarget(canvas: HTMLCanvasElement): RenderTarget;

  /** Create an offscreen render target. */
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

  /** Create a triangle mesh primitive */
  public createTriMesh(_args: MeshArgs): RenderGraphic | undefined { return undefined; }

  /** Create an indexed polyline primitive */
  public createIndexedPolylines(_args: PolylineArgs): RenderGraphic | undefined { return undefined; }

  // /** Create a point cloud primitive */
  // public abstract createPointCloud(args: PointCloudArgs, imodel: IModel): Graphic;

  // /** Create polygons on a range for a sheet tile */
  // public abstract createSheetTilePolys(corners: GraphicBuilderTileCorners, clip: ClipVector, rangeOut: Range3d): PolyfaceHeader[];

  // /** Create a sheet tile primitive from polys */
  // public abstract createSheetTile(tile: Texture, corners: GraphicBuilderTileCorners, imodel: IModel, params: GraphicParams): Graphic[];

  // /** Create a tile primitive */
  // public abstract createTile(tile: Texture, corners: GraphicBuilderTileCorners, imodel: IModel, params: GraphicParams): Graphic;

  /** Create a Graphic consisting of a list of Graphics */
  public abstract createGraphicList(primitives: RenderGraphic[]): RenderGraphic;

  /** Create a Graphic consisting of a list of Graphics, with optional transform, clip, and view flag overrides applied to the list */
  public abstract createBranch(branch: GraphicBranch, transform: Transform, clips?: ClipVector): RenderGraphic;

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
