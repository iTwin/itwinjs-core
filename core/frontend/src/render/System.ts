/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { ClipVector, Transform } from "@bentley/geometry-core";
import { assert, Id64 } from "@bentley/bentleyjs-core";
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
} from "@bentley/imodeljs-common";
import { Viewport, ViewRect } from "../Viewport";
import { GraphicBuilder, GraphicBuilderCreateParams } from "./GraphicBuilder";
import { IModelConnection } from "../IModelConnection";
import { HilitedSet } from "../SelectionSet";
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
export abstract class RenderGraphic {
  public readonly iModel: IModelConnection;

  constructor(iModel: IModelConnection) { this.iModel = iModel; }
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
export class Decorations {
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
}

export class GraphicBranch {
  public readonly entries: RenderGraphic[] = [];
  private _viewFlagOverrides = new ViewFlag.Overrides();
  public symbologyOverrides?: FeatureSymbology.Overrides;

  public constructor() { }

  public add(graphic: RenderGraphic): void { this.entries.push(graphic); }
  public addRange(graphics: RenderGraphic[]): void { graphics.forEach(this.add); }

  public getViewFlags(flags: ViewFlags, out?: ViewFlags): ViewFlags { return this._viewFlagOverrides.apply(flags.clone(out)); }
  public set viewFlagOverrides(ovr: ViewFlag.Overrides) { this._viewFlagOverrides.copyFrom(ovr); }

  public clear() { this.entries.length = 0; }
  public get isEmpty(): boolean { return 0 === this.entries.length; }
}

/**
 * A RenderTarget holds the current scene, the current set of dynamic RenderGraphics, and the current decorators.
 * When frames are composed, all of those RenderGraphics are rendered, as appropriate.
 * A RenderTarget holds a reference to a Render::Device, and a Render::System
 * Every DgnViewport holds a reference to a RenderTarget.
 */
export abstract class RenderTarget {
  public static get frustumDepth2d(): number { return 1.0; } // one meter

  public abstract get renderSystem(): RenderSystem;
  public abstract get cameraFrustumNearScaleLimit(): number;
  public abstract get viewRect(): ViewRect;
  public abstract get wantInvertBlackBackground(): boolean;

  public createGraphic(params: GraphicBuilderCreateParams) { return this.renderSystem.createGraphic(params); }

  public abstract onDestroy(): void;
  public abstract reset(): void;
  public abstract changeScene(scene: GraphicList, activeVolume?: ClipVector): void;
  public abstract changeDynamics(dynamics?: DecorationList): void;
  public abstract changeDecorations(decorations: Decorations): void;
  public abstract changeRenderPlan(plan: RenderPlan): void;
  public abstract drawFrame(): void;
  public abstract overrideFeatureSymbology(ovr: FeatureSymbology.Overrides): void;
  public abstract setHiliteSet(hilited: HilitedSet): void;
  public abstract setFlashed(elementId: Id64, intensity: number): void;
  public abstract setViewRect(rect: ViewRect, temporary: boolean): void;
  public abstract queueReset(): void;
  public abstract onResized(): void;
  public abstract updateViewRect(): boolean; // force a RenderTarget viewRect to resize if necessary since last draw

  // ###TODO public abstract readImage(rect: ViewRect, targetSize: Point2d): Image;
  // ###TODO public abstract setMinimumFrameRate(minimumFrameRate: number): number;
  // ###TODO public abstract readPixels(rect: ViewRect, selector: PixelDataSelector): PixelDataBuffer;
}

/**
 * A RenderSystem is the renderer-specific factory for creating Render::Graphics, Render::Textures, and Render::Materials.
 * @note The methods of this class may be called from any thread.
 */
export abstract class RenderSystem {
  protected _nowPainting?: RenderTarget;
  public get isPainting(): boolean { return !!this._nowPainting; }
  public checkPainting(target?: RenderTarget): boolean { return target === this._nowPainting; }
  public startPainting(target?: RenderTarget): void { assert(!this.isPainting); this._nowPainting = target; }
  public nowPainting() { this._nowPainting = undefined; }

  /** Create a render target which will render to the supplied canvas element. */
  public abstract createTarget(canvas: HTMLCanvasElement): RenderTarget;

  // /** Create an offscreen render target. */
  public abstract createOffscreenTarget(rect: ViewRect): RenderTarget;

  /** Find a previously-created Material by key. Returns null if no such material exists. */
  public abstract findMaterial(key: string, imodel: IModelConnection): RenderMaterial | undefined;

  // /**
  //  * Get or create a material from a material element, by id
  //  * The default implementation uses _FindMaterial() and calls _CreateMaterial() if not found.
  //  */
  // public abstract getMaterial(id: Id64, imodel: IModel): Material;

  /** Create a Material from parameters */
  public abstract createMaterial(params: RenderMaterial.Params, imodel: IModelConnection): RenderMaterial | undefined;

  /** Create a GraphicBuilder from parameters */
  public abstract createGraphic(params: GraphicBuilderCreateParams): GraphicBuilder;

  // /** Create a Sprite from parameters */
  // public abstract createSprite(sprite: ISprite, location: Point3d, transparency: number, imodel: IModel): Graphic;

  // /** Create a Viewlet from parameters */
  // public abstract createViewlet(branch: GraphicBranch, plan: Plan, position: ViewletPosition): Graphic;

  // /** Create a triangle mesh primitive */
  public abstract createTriMesh(args: MeshArgs, imodel: IModelConnection): RenderGraphic | undefined;

  // /** Create an indexed polyline primitive */
  public abstract createIndexedPolylines(args: PolylineArgs, imodel: IModelConnection): RenderGraphic | undefined;

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

  // /** Create a Graphic consisting of batched Features. */
  // public abstract createBatch(graphic: Graphic, features: FeatureTable): Graphic;

  // /**
  //  * Get or create a Texture from a DgnTexture element. Note that there is a cache of textures stored on a DgnDb, so this may return a pointer to a previously-created texture.
  //  * The default implementation uses _FindTexture() and calls _CreateTexture() if not found.
  //  * @param key the Id64 of the texture element
  //  * @param imodel the IModel for textureId
  //  */
  // public abstract findTexture(key: Id64, imodel: IModel): Texture;

  // /** Get or create a Texture from a GradientSymb. Note that there is a cache of textures stored on a DgnDb, so this may return a pointer to a previously-created texture. */
  // public abstract getTexture(id: Id64, imodel: IModel): Texture;

  // /** Create a Material from parameters */
  // public abstract getGradientTexture(gradient: GradientSymb, imodel: IModel): Texture;

  // /** Create a new Texture from an Image. */
  // public abstract createTexture(image: Image, imodel: IModel, params: TextureCreateParams): Texture;

  // /** Create a new Texture from an ImageSource. */
  // public abstract createTextureFromImageSrc(source: ImageSource, bottomUp: ImageBottomUp, imodel: IModel, params: TextureCreateParams): Texture;

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
