/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Rendering */

import { assert, base64StringToUint8Array, dispose, disposeArray, Id64, Id64String, IDisposable } from "@bentley/bentleyjs-core";
import { ClipVector, IndexedPolyface, Plane3dByOriginAndUnitNormal, Point2d, Point3d, Range3d, Transform, XAndY } from "@bentley/geometry-core";
import {
  AntiAliasPref, BatchType, ColorDef, ElementAlignedBox3d, Feature, FeatureTable, Frustum, Gradient,
  HiddenLine, Hilite, ImageBuffer, ImageSource, ImageSourceFormat, isValidImageSourceFormat, QParams3d,
  QPoint3dList, RenderMaterial, RenderTexture, SceneLights, ViewFlag, ViewFlags,
} from "@bentley/imodeljs-common";
import { SkyBox } from "../DisplayStyleState";
import { ImageUtil } from "../ImageUtil";
import { IModelApp } from "../IModelApp";
import { IModelConnection } from "../IModelConnection";
import { BeButtonEvent, BeWheelEvent } from "../tools/Tool";
import { ViewFrustum, Viewport, ViewRect } from "../Viewport";
import { FeatureSymbology } from "./FeatureSymbology";
import { GraphicBuilder, GraphicType } from "./GraphicBuilder";
import { MeshArgs, PolylineArgs } from "./primitives/mesh/MeshPrimitives";
import { PointCloudArgs } from "./primitives/PointCloudPrimitive";
import { MeshParams, PointStringParams, PolylineParams } from "./primitives/VertexTable";

/* A RenderPlan holds a Frustum and the render settings for displaying a RenderScene into a RenderTarget.
 * @hidden
 */
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
  public readonly hline?: HiddenLine.Settings;
  public readonly lights?: SceneLights;
  private _curFrustum: ViewFrustum;

  public get frustum(): Frustum { return this._curFrustum.getFrustum(); }
  public get fraction(): number { return this._curFrustum.frustFraction; }

  public selectTerrainFrustum() { if (undefined !== this.terrainFrustum) this._curFrustum = this.terrainFrustum; }
  public selectViewFrustum() { this._curFrustum = this.viewFrustum; }

  private constructor(is3d: boolean, viewFlags: ViewFlags, bgColor: ColorDef, monoColor: ColorDef, hiliteSettings: Hilite.Settings, aaLines: AntiAliasPref, aaText: AntiAliasPref, viewFrustum: ViewFrustum, terrainFrustum: ViewFrustum | undefined, activeVolume?: RenderClipVolume, hline?: HiddenLine.Settings, lights?: SceneLights) {
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

/** Abstract representation of an object which can be rendered by a [[RenderSystem]].
 * Two broad classes of graphics exist:
 *  - "Scene" graphics generated on the back-end to represent the contents of the models displayed in a [[Viewport]]; and
 *  - [[Decorations]] created on the front-end to be rendered along with the scene.
 * The latter are produced using a [[GraphicBuilder]].
 */
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

/** An opaque representation of a clip volume applied to geometry within a [[Viewport]]. */
export abstract class RenderClipVolume implements IDisposable {
  /** Returns the type of this clipping volume. */
  public abstract get type(): ClippingType;

  public abstract dispose(): void;
}

/** An array of [[RenderGraphic]]s. */
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

/** An array of [[CanvasDecoration]]s */
export type CanvasDecorationList = CanvasDecoration[];

/** A set of [[RenderGraphic]]s and [[CanvasDecoration]]s produced by [[Tool]]s and [[Decorator]]s, used to decorate the contents of a [[Viewport]].
 */
export class Decorations implements IDisposable {
  private _skyBox?: RenderGraphic;
  private _viewBackground?: RenderGraphic; // drawn first, view units, with no zbuffer, smooth shading, default lighting. e.g., a skybox
  private _normal?: GraphicList;       // drawn with zbuffer, with scene lighting
  private _world?: GraphicList;        // drawn with zbuffer, with default lighting, smooth shading
  private _worldOverlay?: GraphicList; // drawn in overlay mode, world units
  private _viewOverlay?: GraphicList;  // drawn in overlay mode, view units

  public canvasDecorations?: CanvasDecorationList;

  /** @hidden */
  public get skyBox(): RenderGraphic | undefined { return this._skyBox; }
  /** @hidden */
  public set skyBox(skyBox: RenderGraphic | undefined) { dispose(this._skyBox); this._skyBox = skyBox; }
  /** A view decoration drawn as the background of the view. @see [[GraphicType.ViewBackground]]. */
  public get viewBackground(): RenderGraphic | undefined { return this._viewBackground; }
  public set viewBackground(viewBackground: RenderGraphic | undefined) { dispose(this._viewBackground); this._viewBackground = viewBackground; }
  /** Decorations drawn as if they were part of the scene. @see [[GraphicType.Scene]]. */
  public get normal(): GraphicList | undefined { return this._normal; }
  public set normal(normal: GraphicList | undefined) { disposeArray(this._normal); this._normal = normal; }
  /** Decorations drawn as if they were part of the world, but ignoring the view's [[ViewFlags]]. @see [[GraphicType.World]]. */
  public get world(): GraphicList | undefined { return this._world; }
  public set world(world: GraphicList | undefined) { disposeArray(this._world); this._world = world; }
  /** Overlay decorations drawn in world coordinates. @see [[GraphicType.WorldOverlay]]. */
  public get worldOverlay(): GraphicList | undefined { return this._worldOverlay; }
  public set worldOverlay(worldOverlay: GraphicList | undefined) { disposeArray(this._worldOverlay); this._worldOverlay = worldOverlay; }
  /** Overlay decorations drawn in view coordinates. @see [[GraphicType.ViewOverlay]]. */
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
 * and a transform, symbology overrides, and clip volume which are to be applied when rendering them.
 * Branches can be nested to build an arbitrarily-complex scene graph.
 * @see [[RenderSystem.createBranch]]
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
  /** @hidden */
  public getViewFlags(flags: ViewFlags, out?: ViewFlags): ViewFlags { return this._viewFlagOverrides.apply(flags.clone(out)); }
  /** @hidden */
  public setViewFlags(flags: ViewFlags): void { this._viewFlagOverrides.overrideAll(flags); }
  /** @hidden */
  public setViewFlagOverrides(ovr: ViewFlag.Overrides): void { this._viewFlagOverrides.copyFrom(ovr); }

  public dispose() { this.clear(); }
  public get isEmpty(): boolean { return 0 === this.entries.length; }

  /** Empties the list of [[RenderGraphic]]s contained in this branch, and if the [[GraphicBranch.isOwned]] flag is set, also disposes of them. */
  public clear(): void {
    if (this.ownsEntries)
      disposeArray(this.entries);
    else
      this.entries.length = 0;
  }
}

/** Describes aspects of a pixel as read from a [[Viewport]].
 * @see [[Viewport.readPixels]]
 */
export namespace Pixel {
  /** Describes a single pixel within a [[Pixel.Buffer]]. */
  export class Data {
    public constructor(public readonly elementId?: Id64,
      public readonly distanceFraction: number = -1.0,
      public readonly type: GeometryType = GeometryType.Unknown,
      public readonly planarity: Planarity = Planarity.Unknown) { }
  }

  /** Describes the foremost type of geometry which produced the [[Pixel.Data]]. */
  export const enum GeometryType {
    /** [[Pixel.Selector.Geometry]] was not specified, or the type could not be determined. */
    Unknown, // Geometry was not selected, or type could not be determined
    /** No geometry was rendered to this pixel. */
    None,
    /** A surface produced this pixel. */
    Surface,
    /** A point primitive or polyline produced this pixel. */
    Linear,
    /** This pixel was produced by an edge of a surface. */
    Edge,
    /** This pixel was produced by a silhouette edge of a curved surface. */
    Silhouette,
  }

  /** Describes the planarity of the foremost geometry which produced the pixel. */
  export const enum Planarity {
    /** [[Pixel.Selector.Geometry]] was not specified, or the planarity could not be determined. */
    Unknown,
    /** No geometry was rendered to this pixel. */
    None,
    /** Planar geometry produced this pixel. */
    Planar,
    /** Non-planar geometry produced this pixel. */
    NonPlanar,
  }

  /**
   * Bit-mask by which callers of [[Viewport.readPixels]] specify which aspects are of interest.
   * Aspects not specified will be omitted from the returned data.
   */
  export const enum Selector {
    None = 0,
    /** Select the ID of the element which produced each pixel. */
    ElementId = 1 << 0,
    /** For each pixel, select the fraction of its distance between the near and far planes. */
    Distance = 1 << 1,
    /** Select the type and planarity of geometry which produced each pixel. */
    Geometry = 1 << 2,
    /** Select geometry type/planarity and distance fraction associated with each pixel. */
    GeometryAndDistance = Geometry | Distance,
    /** Select all aspects of each pixel. */
    All = GeometryAndDistance | ElementId,
  }

  /** A rectangular array of pixels as read from a [[Viewport]]'s frame buffer. Each pixel is represented as a [[Pixel.Data]] object.
   * @see [[Viewport.readPixels]].
   */
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

  /** Construct a PackedFeatureTable from the packed binary data.
   * This is used internally when deserializing Tiles in iMdl format.
   * @hidden
   */
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
    // We must determine how many subcategories we have ahead of time to compute the size of the Uint32Array, as
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

/** A RenderTarget connects a [[Viewport]] to a WebGLRenderingContext to enable the viewport's contents to be displayed on the screen.
 * Application code rarely interacts directly with a RenderTarget - instead, it interacts with a Viewport which forwards requests to the implementation
 * of the RenderTarget.
 */
export abstract class RenderTarget implements IDisposable {
  /** @hidden */
  public pickOverlayDecoration(_pt: XAndY): CanvasDecoration | undefined { return undefined; }

  /** @hidden */
  public static get frustumDepth2d(): number { return 1.0; } // one meter
  /** @hidden */
  public static get maxDisplayPriority(): number { return (1 << 23) - 32; }
  /** @hidden */
  public static get minDisplayPriority(): number { return -this.maxDisplayPriority; }

  /** Returns a transform mapping an object's display priority to a depth from 0 to frustumDepth2d.
   * @hidden
   */
  public static depthFromDisplayPriority(priority: number): number {
    return (priority - this.minDisplayPriority) / (this.maxDisplayPriority - this.minDisplayPriority) * this.frustumDepth2d;
  }

  /** @hidden */
  public abstract get renderSystem(): RenderSystem;
  /** @hidden */
  public abstract get cameraFrustumNearScaleLimit(): number;
  /** @hidden */
  public abstract get viewRect(): ViewRect;
  /** @hidden */
  public abstract get wantInvertBlackBackground(): boolean;

  /** @hidden */
  public abstract get animationFraction(): number;
  /** @hidden */
  public abstract set animationFraction(fraction: number);

  /** @hidden */
  public createGraphicBuilder(type: GraphicType, viewport: Viewport, placement: Transform = Transform.identity, pickableId?: Id64String) { return this.renderSystem.createGraphicBuilder(placement, type, viewport, pickableId); }

  public abstract dispose(): void;
  /** @hidden */
  public abstract reset(): void;
  /** @hidden */
  public abstract changeScene(scene: GraphicList, activeVolume?: RenderClipVolume): void;
  /** @hidden */
  public abstract changeTerrain(_scene: GraphicList): void;
  /** @hidden */
  public abstract changeDynamics(dynamics?: GraphicList): void;
  /** @hidden */
  public abstract changeDecorations(decorations: Decorations): void;
  /** @hidden */
  public abstract changeRenderPlan(plan: RenderPlan): void;
  /** @hidden */
  public abstract drawFrame(sceneMilSecElapsed?: number): void;
  /** @hidden */
  public abstract overrideFeatureSymbology(ovr: FeatureSymbology.Overrides): void;
  /** @hidden */
  public abstract setHiliteSet(hilited: Set<string>): void;
  /** @hidden */
  public abstract setFlashed(elementId: Id64, intensity: number): void;
  /** @hidden */
  public abstract setViewRect(rect: ViewRect, temporary: boolean): void;
  /** @hidden */
  public abstract onResized(): void;
  /** @hidden */
  public abstract updateViewRect(): boolean; // force a RenderTarget viewRect to resize if necessary since last draw
  /** @hidden */
  public abstract readPixels(rect: ViewRect, selector: Pixel.Selector): Pixel.Buffer | undefined;
  /** @hidden */
  public abstract readImage(rect: ViewRect, targetSize: Point2d): ImageBuffer | undefined;
}

/** Describes a texture loaded from an HTMLImageElement */
export interface TextureImage {
  /** The HTMLImageElement containing the texture's image data */
  image: HTMLImageElement | undefined;
  /** The format of the texture's image data */
  format: ImageSourceFormat | undefined;
}

/** A RenderSystem provides access to resources used by the internal WebGL-based rendering system.
 * @see [[IModelApp.renderSystem]].
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

  /** Find a previously-created [[RenderMaterial]] by its ID.
   * @param _key The unique ID of the material within the context of the IModelConnection. Typically an element ID.
   * @param _imodel The IModelConnection with which the material is associated.
   * @returns A previously-created material matching the specified ID, or undefined if no such material exists.
   */
  public findMaterial(_key: string, _imodel: IModelConnection): RenderMaterial | undefined { return undefined; }

  /** Create a [[RenderMaterial]] from parameters
   * If the parameters include a non-empty key, and no previously-created material already exists with that key, the newly-created material will be cached on the IModelConnection such
   * that it can later be retrieved by the same key using [[RenderSystem.findMaterial]].
   * @param _params A description of the material's properties.
   * @param _imodel The IModelConnection associated with the material.
   * @returns the newly-created material, or undefined if the material could not be created or if a material with the same key as that specified in the params already exists.
   */
  public createMaterial(_params: RenderMaterial.Params, _imodel: IModelConnection): RenderMaterial | undefined { return undefined; }

  /** Creates a [[GraphicBuilder]] for creating a [[RenderGraphic]].
   * @param placement The local-to-world transform in which the builder's geometry is to be defined.
   * @param type The type of builder to create.
   * @param viewport The viewport in which the resultant [[RenderGraphic]] will be rendered.
   * @param pickableId If the decoration is to be pickable, a unique identifier to associate with the resultant [[RenderGraphic]].
   * @returns A builder for creating a [[RenderGraphic]] of the specified type appropriate for rendering within the specified viewport.
   * @see [[IModelConnection.transientIds]] for obtaining an ID for a pickable decoration.
   * @see [[RenderContext.createGraphicBuilder]].
   * @see [[Decorators]]
   */
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

  /** @hidden */
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

  /** Create a Graphic for a sky box which encompasses the entire scene, rotating with the camera.  See SkyBox.CreateParams.
   * @hidden
   */
  public createSkyBox(_params: SkyBox.CreateParams): RenderGraphic | undefined { return undefined; }

  /** Create a RenderGraphic consisting of a list of Graphics to be drawn together. */
  public abstract createGraphicList(primitives: RenderGraphic[]): RenderGraphic;

  /** Create a RenderGraphic consisting of a list of Graphics, with optional transform, clip, and symbology overrides applied to the list */
  public abstract createBranch(branch: GraphicBranch, transform: Transform, clips?: RenderClipVolume): RenderGraphic;

  /** Create a RenderGraphic consisting of batched [[Feature]]s.
   * @hidden
   */
  public abstract createBatch(graphic: RenderGraphic, features: PackedFeatureTable, range: ElementAlignedBox3d): RenderGraphic;

  /** Find a previously-created [[RenderTexture]] by its ID.
   * @param _key The unique ID of the texture within the context of the IModelConnection. Typically an element ID.
   * @param _imodel The IModelConnection with which the texture is associated.
   * @returns A previously-created texture matching the specified ID, or undefined if no such texture exists.
   */
  public findTexture(_key: string, _imodel: IModelConnection): RenderTexture | undefined { return undefined; }

  /** Find or create a [[RenderTexture]] from a persistent texture element.
   * @param id The ID of the texture element.
   * @param iModel The IModel containing the texture element.
   * @returns A Promise resolving to the created RenderTexture or to undefined if the texture could not be created.
   * @note If the texture is successfully created, it will be cached on the IModelConnection such that it can later be retrieved by its ID using [[RenderSystem.findTexture]].
   * @see [[RenderSystem.loadTextureImage]].
   */
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

  /**
   * Load a texture image given the ID of a texture element.
   * @param id The ID of the texture element.
   * @param iModel The IModel containing the texture element.
   * @returns A Promise resolving to a TextureImage created from the texture element's data, or to undefined if the TextureImage could not be created.
   * @see [[RenderSystem.loadTexture]]
   */
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

  /** Obtain a texture created from a gradient.
   * @param _symb The description of the gradient.
   * @param _imodel The IModelConnection with which the texture is associated.
   * @returns A texture created from the gradient image, or undefined if the texture could not be created.
   * @note If a texture matching the specified gradient already exists, it will be returned.
   * Otherwise, the newly-created texture will be cached on the IModelConnection such that a subsequent call to getGradientTexture with an equivalent gradient will
   * return the previously-created texture.
   */
  public getGradientTexture(_symb: Gradient.Symb, _imodel: IModelConnection): RenderTexture | undefined { return undefined; }

  /** Create a new texture from an [[ImageBuffer]]. */
  public createTextureFromImageBuffer(_image: ImageBuffer, _imodel: IModelConnection, _params: RenderTexture.Params): RenderTexture | undefined { return undefined; }

  /** Create a new texture from an HTML image. Typically the image was extracted from a binary representation of a jpeg or png via [[ImageUtil.extractImage]] */
  public createTextureFromImage(_image: HTMLImageElement, _hasAlpha: boolean, _imodel: IModelConnection | undefined, _params: RenderTexture.Params): RenderTexture | undefined { return undefined; }

  /** Create a new texture from an [[ImageSource]]. */
  public async createTextureFromImageSource(source: ImageSource, imodel: IModelConnection | undefined, params: RenderTexture.Params): Promise<RenderTexture | undefined> {
    return ImageUtil.extractImage(source).then((image) => IModelApp.hasRenderSystem ? this.createTextureFromImage(image, ImageSourceFormat.Png === source.format, imodel, params) : undefined);
  }

  /** Create a new texture from a cube of HTML images.
   * @hidden
   */
  public createTextureFromCubeImages(_posX: HTMLImageElement, _negX: HTMLImageElement, _posY: HTMLImageElement, _negY: HTMLImageElement, _posZ: HTMLImageElement, _negZ: HTMLImageElement, _imodel: IModelConnection, _params: RenderTexture.Params): RenderTexture | undefined { return undefined; }

  /** @hidden */
  public onInitialized(): void { }
}
