/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
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
  Feature,
  FeatureTable,
  BatchType,
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
import { Plane3dByOriginAndUnitNormal } from "@bentley/geometry-core";
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

/** Abstract representation of an object which can be rendered by a RenderSystem */
export abstract class RenderGraphic implements IDisposable {
  public abstract dispose(): void;
}

/** Describes the type of a RenderClipVolume. */
export const enum ClippingType {
  /** No clip volume. */
  None,
  /** A 2d mask which excludes geometry obscured by the mask. */
  Mask,
  /** A 3d set of convex clipping planes which excludes geometry outside of the planes. */
  Planes,
}

/** Interface adopted by a type which can apply a clipping volume to a Target. */
export abstract class RenderClipVolume implements IDisposable {
  /** Returns the type of this clipping volume. */
  public abstract get type(): ClippingType;

  public abstract dispose(): void;
}

/** An array of RenderGraphics */
export type GraphicList = RenderGraphic[];

/** A [Decoration]($docs/learning/frontend/ViewDecorations#canvas-decorations))] that is drawn onto the
 * [2d canvas](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D) on top of a ScreenViewport.
 * CanvasDecorations may be pickable by implementing [[pick]].
 */
export interface CanvasDecoration {
  /**
   * Required method to draw this decoration into the supplied [CanvasRenderingContext2D](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D). This method is called every time a frame is rendered.
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
  /**
   * Optional method to be called when the mouse wheel is rolled with the pointer over this decoration.
   * @return true to indicate that the event has been handled and should not be propagated to default handler
   */
  onWheel?(ev: BeWheelEvent): boolean;
  /** Cursor to use when mouse is inside this decoration. Default is "pointer". */
  decorationCursor?: string;
}

/** An array of CanvasDecorations */
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

/**
 * A node in a scene graph. The branch itself is not renderable. Instead it contains a list of RenderGraphics,
 * and a transform, view flag overrides, symbology overrides, and clip volume which are to be applied when rendering them.
 * Branches can be nested to build an arbitrarily-complex scene graph.
 */
export class GraphicBranch implements IDisposable {
  /** The child nodes of this branch */
  public readonly entries: RenderGraphic[] = [];
  /** If true, when the branch is disposed of, the RenderGraphics in its entries array will also be disposed */
  public readonly ownsEntries: boolean;
  private _viewFlagOverrides = new ViewFlag.Overrides();
  /** Optional symbology overrides to be applied to all graphics in this branch */
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
 * An immutable, packed representation of a [[FeatureTable]]. The features are packed into a single array of 32-bit integer values,
 * wherein each feature occupies 3 32-bit integers.
 */
export class PackedFeatureTable {
  private readonly _data: Uint32Array;
  public readonly modelId: Id64;
  public readonly maxFeatures: number;
  public readonly numFeatures: number;
  public readonly anyDefined: boolean;
  public readonly type: BatchType;

  /** Construct a PackedFeatureTable from the packed binary data. Typically the data originates from a [[Tile]] serialized in iMdl format. */
  public constructor(data: Uint32Array, modelId: Id64, numFeatures: number, maxFeatures: number, type: BatchType) {
    this._data = data;
    this.modelId = modelId;
    this.maxFeatures = maxFeatures;
    this.numFeatures = numFeatures;
    this.type = type;

    switch (this.numFeatures) {
      case 0:
        this.anyDefined = false;
        break;
      case 1:
        this.anyDefined = this.getFeature(0).isDefined;
        break;
      default:
        this.anyDefined = true;
        break;
    }

    assert(this._data.length >= this._subCategoriesOffset);
    assert(this.maxFeatures >= this.numFeatures);
  }

  /** Create a packed feature table from a [[FeatureTable]]. */
  public static pack(featureTable: FeatureTable): PackedFeatureTable {
    // We must determine how many subcategories we have ahead of time in order to compute the size of the Uint32Array, as
    // the array cannot be resized after it is created.
    // We are not too worried about this as FeatureTables created on the front-end will contain few if any features; those obtained from the
    // back-end arrive within tiles already in the packed format.
    const subcategories = new Map<string, number>();
    for (const iv of featureTable.getArray()) {
      const found = subcategories.get(iv.value.subCategoryId.toString());
      if (undefined === found)
        subcategories.set(iv.value.subCategoryId, subcategories.size);
    }

    // We need 3 32-bit integers per feature, plus 2 32-bit integers per subcategory.
    const subCategoriesOffset = 3 * featureTable.length;
    const nUint32s = subCategoriesOffset + 2 * subcategories.size;
    const uint32s = new Uint32Array(nUint32s);

    for (const iv of featureTable.getArray()) {
      const feature = iv.value;
      const index = iv.index * 3;

      let subCategoryIndex = subcategories.get(feature.subCategoryId)!;
      assert(undefined !== subCategoryIndex); // we inserted it above...
      subCategoryIndex |= (feature.geometryClass << 24);

      uint32s[index + 0] = Id64.getLowUint32(feature.elementId);
      uint32s[index + 1] = Id64.getHighUint32(feature.elementId);
      uint32s[index + 2] = subCategoryIndex;
    }

    subcategories.forEach((index: number, id: string, _map) => {
      const index32 = subCategoriesOffset + 2 * index;
      uint32s[index32 + 0] = Id64.getLowUint32(id);
      uint32s[index32 + 1] = Id64.getHighUint32(id);
    });

    return new PackedFeatureTable(uint32s, featureTable.modelId, featureTable.length, featureTable.maxFeatures, featureTable.type);
  }

  /** Retrieve the Feature associated with the specified index. */
  public getFeature(featureIndex: number): Feature {
    assert(featureIndex < this.numFeatures);

    const index32 = 3 * featureIndex;
    const elemId = this.readId(index32);

    const subCatIndexAndClass = this._data[index32 + 2];
    const geomClass = (subCatIndexAndClass >>> 24) & 0xff;

    const subCatIndex = (subCatIndexAndClass & 0x00ffffff) >>> 0;
    const subCatId = this.readId(subCatIndex * 2 + this._subCategoriesOffset);

    return new Feature(elemId, subCatId, geomClass);
  }

  /** Returns the Feature associated with the specified index, or undefined if the index is out of range. */
  public findFeature(featureIndex: number): Feature | undefined {
    return featureIndex < this.numFeatures ? this.getFeature(featureIndex) : undefined;
  }

  /** @hidden */
  public getElementIdParts(featureIndex: number): { low: number, high: number } {
    assert(featureIndex < this.numFeatures);
    const offset = 3 * featureIndex;
    return {
      low: this._data[offset],
      high: this._data[offset + 1],
    };
  }

  /** Returns the element ID of the Feature associated with the specified index, or undefined if the index is out of range. */
  public findElementId(featureIndex: number): Id64 | undefined {
    if (featureIndex >= this.numFeatures)
      return undefined;
    else
      return this.readId(3 * featureIndex);
  }

  /** Return true if this table contains exactly 1 feature. */
  public get isUniform(): boolean { return 1 === this.numFeatures; }

  /** If this table contains exactly 1 feature, return it. */
  public get uniform(): Feature | undefined { return this.isUniform ? this.getFeature(0) : undefined; }

  public get isClassifier(): boolean { return BatchType.Classifier === this.type; }

  /** Unpack the features into a [[FeatureTable]]. */
  public unpack(): FeatureTable {
    const table = new FeatureTable(this.maxFeatures, this.modelId);
    for (let i = 0; i < this.numFeatures; i++) {
      const feature = this.getFeature(i);
      table.insertWithIndex(feature, i);
    }

    return table;
  }

  private get _subCategoriesOffset(): number { return this.numFeatures * 3; }

  private readId(offset32: number): Id64 {
    return Id64.fromUint32Pair(this._data[offset32], this._data[offset32 + 1]);
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

  public abstract get animationFraction(): number;
  public abstract set animationFraction(fraction: number);

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
  public abstract onResized(): void;
  public abstract updateViewRect(): boolean; // force a RenderTarget viewRect to resize if necessary since last draw
  public abstract readPixels(rect: ViewRect, selector: Pixel.Selector): Pixel.Buffer | undefined;
  public abstract readImage(rect: ViewRect, targetSize: Point2d): ImageBuffer | undefined;
}

/** Describes a texture loaded from an HTMLImageElement */
export interface TextureImage {
  /** The HTMLImageElement containing the texture's image data */
  image: HTMLImageElement | undefined;
  /** The format of the texture's image data */
  format: ImageSourceFormat | undefined;
}

/**
 * A RenderSystem is the renderer-specific factory for creating rendering-related resources like RenderGraphics, RenderTexture, and RenderMaterials.
 */
export abstract class RenderSystem implements IDisposable {
  /** @hidden */
  public abstract get isValid(): boolean;

  /** @hidden */
  public abstract dispose(): void;

  /** @hidden */
  public get maxTextureSize(): number { return 0; }

  /** @hidden */
  public abstract createTarget(canvas: HTMLCanvasElement): RenderTarget;
  /** @hidden */
  public abstract createOffscreenTarget(rect: ViewRect): RenderTarget;

  /** Find a previously-created Material by key. Returns null if no such material exists. */
  public findMaterial(_key: string, _imodel: IModelConnection): RenderMaterial | undefined { return undefined; }

  /** Create a RenderMaterial from parameters */
  public createMaterial(_params: RenderMaterial.Params, _imodel: IModelConnection): RenderMaterial | undefined { return undefined; }

  /** Create a GraphicBuilder from parameters */
  public abstract createGraphicBuilder(placement: Transform, type: GraphicType, viewport: Viewport, pickableId?: Id64String): GraphicBuilder;

  /** @hidden */
  public createTriMesh(args: MeshArgs): RenderGraphic | undefined {
    const params = MeshParams.create(args);
    return this.createMesh(params);
  }

  /** @hidden */
  public createIndexedPolylines(args: PolylineArgs): RenderGraphic | undefined {
    if (args.flags.isDisjoint) {
      const pointStringParams = PointStringParams.create(args);
      return undefined !== pointStringParams ? this.createPointString(pointStringParams) : undefined;
    } else {
      const polylineParams = PolylineParams.create(args);
      return undefined !== polylineParams ? this.createPolyline(polylineParams) : undefined;
    }
  }

  /** @hidden */
  public createMesh(_params: MeshParams): RenderGraphic | undefined { return undefined; }
  /** @hidden */
  public createPolyline(_params: PolylineParams): RenderGraphic | undefined { return undefined; }
  /** @hidden */
  public createPointString(_params: PointStringParams): RenderGraphic | undefined { return undefined; }
  /** @hidden */
  public createPointCloud(_args: PointCloudArgs, _imodel: IModelConnection): RenderGraphic | undefined { return undefined; }
  /** @hidden */
  public createSheetTilePolyfaces(_corners: Point3d[], _clip?: ClipVector): IndexedPolyface[] { return []; }
  /** @hidden */
  public createSheetTile(_tile: RenderTexture, _polyfaces: IndexedPolyface[], _tileColor: ColorDef): GraphicList { return []; }

  /** Attempt to create a clipping volume for the given iModel using a clip vector. */
  public getClipVolume(_clipVector: ClipVector, _imodel: IModelConnection): RenderClipVolume | undefined { return undefined; }

  /** @hidden */
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

  /** Create a RenderGraphic consisting of batched Features. */
  public abstract createBatch(graphic: RenderGraphic, features: PackedFeatureTable, range: ElementAlignedBox3d): RenderGraphic;

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

  /** Load a texture image given the ID of a texture element */
  public async loadTextureImage(id: Id64String, iModel: IModelConnection): Promise<TextureImage | undefined> {
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

  /** @hidden */
  public onInitialized(): void { }
}
