/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import {
  asInstanceOf, assert, BeDuration, BeEvent, BeTimePoint, Constructor, dispose, Id64, Id64Arg, Id64Set, Id64String, isInstanceOf,
  StopWatch,
} from "@itwin/core-bentley";
import {
  Angle, AngleSweep, Arc3d, Geometry, LowAndHighXY, LowAndHighXYZ, Map4d, Matrix3d, Plane3dByOriginAndUnitNormal, Point3d, Point4d, Range1d,
  Range3d, Ray3d, Transform, Vector3d, XAndY, XYAndZ, XYZ,
} from "@itwin/core-geometry";
import {
  AnalysisStyle, BackgroundMapProps, BackgroundMapProviderProps, BackgroundMapSettings, Camera, CartographicRange, ClipStyle, ColorDef, DisplayStyleSettingsProps,
  Easing, ElementProps, FeatureAppearance, Frustum, GlobeMode, GridOrientationType, Hilite, ImageBuffer,
  Interpolation, isPlacement2dProps, LightSettings, ModelMapLayerSettings, Npc, NpcCenter, Placement,
  Placement2d, Placement3d, PlacementProps, RenderSchedule, SolarShadowSettings, SubCategoryAppearance, SubCategoryOverride, ViewFlags,
} from "@itwin/core-common";
import { AuxCoordSystemState } from "./AuxCoordSys";
import { BackgroundMapGeometry } from "./BackgroundMapGeometry";
import { ChangeFlag, ChangeFlags, MutableChangeFlags } from "./ChangeFlags";
import { CoordSystem } from "./CoordSystem";
import { DecorationsCache } from "./DecorationsCache";
import { DisplayStyleState } from "./DisplayStyleState";
import { ElementPicker, LocateOptions } from "./ElementLocateManager";
import { FeatureOverrideProvider } from "./FeatureOverrideProvider";
import { FrustumAnimator } from "./FrustumAnimator";
import { GlobeAnimator } from "./GlobeAnimator";
import { HitDetail, SnapDetail } from "./HitDetail";
import { IModelApp } from "./IModelApp";
import { IModelConnection } from "./IModelConnection";
import { linePlaneIntersect } from "./LinePlaneIntersect";
import { ToolTipOptions } from "./NotificationManager";
import { PerModelCategoryVisibility } from "./PerModelCategoryVisibility";
import { Decorations } from "./render/Decorations";
import { FeatureSymbology } from "./render/FeatureSymbology";
import { FrameStats } from "./render/FrameStats";
import { FrameStatsCollector } from "./internal/render/FrameStatsCollector";
import { AnimationBranchStates } from "./internal/render/AnimationBranchState";
import { Pixel } from "./render/Pixel";
import { GraphicList } from "./render/RenderGraphic";
import { RenderMemory } from "./render/RenderMemory";
import { createRenderPlanFromViewport } from "./internal/render/RenderPlan";
import { RenderTarget } from "./render/RenderTarget";
import { StandardView, StandardViewId } from "./StandardView";
import { SubCategoriesCache } from "./SubCategoriesCache";
import {
  DisclosedTileTreeSet, MapCartoRectangle, MapFeatureInfo, MapFeatureInfoOptions, MapLayerFeatureInfo, MapLayerImageryProvider, MapLayerIndex, MapLayerInfoFromTileTree, MapTiledGraphicsProvider,
  MapTileTreeReference, MapTileTreeScaleRangeVisibility, TileBoundingBoxes, TiledGraphicsProvider, TileTreeLoadStatus, TileTreeReference, TileUser,
} from "./tile/internal";
import { EventController } from "./tools/EventController";
import { ToolSettings } from "./tools/ToolSettings";
import { Animator, MarginOptions, OnViewExtentsError, ViewAnimationOptions, ViewChangeOptions } from "./ViewAnimation";
import { DecorateContext, SceneContext } from "./ViewContext";
import { GlobalLocation, viewGlobalLocation, ViewGlobalLocationConstants } from "./ViewGlobalLocation";
import { ViewingSpace } from "./ViewingSpace";
import { ViewPose } from "./ViewPose";
import { ViewRect } from "./common/ViewRect";
import { ModelDisplayTransformProvider, ViewState } from "./ViewState";
import { ViewStatus } from "./ViewStatus";
import { QueryVisibleFeaturesCallback, QueryVisibleFeaturesOptions } from "./render/VisibleFeature";
import { queryVisibleFeatures } from "./internal/render/QueryVisibileFeatures";
import { FlashSettings } from "./FlashSettings";
import { GeometricModelState } from "./ModelState";
import { GraphicType } from "./common/render/GraphicType";
import { compareMapLayer } from "./internal/render/webgl/MapLayerParams";

// cSpell:Ignore rect's ovrs subcat subcats unmounting UI's

/** Interface for drawing [[Decorations]] into, or on top of, a [[ScreenViewport]].
 * @public
 */
export interface ViewportDecorator {
  /** Override to enable cached decorations for this decorator.
   * By default, a decorator is asked to recreate its decorations from scratch via its [[decorate]] method whenever the viewport's decorations are invalidated.
   * Decorations become invalidated for a variety of reasons, including when the scene changes and when the mouse moves.
   * Most decorators care only about when the scene changes, and may create decorations that are too expensive to recreate on every mouse motion.
   * If `useCachedDecorations` is true, then the viewport will cache the most-recently-created decorations for this decorator, and only invoke its [[decorate]] method if it has no cached decorations for it.
   * The cached decorations are discarded:
   *  - Whenever the scene changes; and
   *  - When the decorator explicitly requests it via [[Viewport.invalidateCachedDecorations]] or [[ViewManager.invalidateCachedDecorationsAllViews]].
   * The decorator should invoke the latter when the criteria governing its decorations change.
   */
  readonly useCachedDecorations?: true;

  /** Implement this method to add [[Decorations]] into the supplied DecorateContext.
   * @see [[useCachedDecorations]] to avoid unnecessarily recreating decorations.
   */
  decorate(context: DecorateContext): void;
}

/** Source of depth point returned by [[Viewport.pickDepthPoint]].
 * @public
 */
export enum DepthPointSource {
  /** Depth point from geometry within specified radius of pick point */
  Geometry, // eslint-disable-line @typescript-eslint/no-shadow
  /** Depth point from reality model within specified radius of pick point */
  Model,
  /** Depth point from ray projection to background map plane */
  BackgroundMap,
  /** Depth point from ray projection to ground plane */
  GroundPlane,
  /** Depth point from ray projection to grid plane */
  Grid,
  /** Depth point from ray projection to acs plane */
  ACS,
  /** Depth point from plane passing through view target point */
  TargetPoint,
  /** Depth point from map/terrain within specified radius of pick point */
  Map,
}

/** Options to control behavior of [[Viewport.pickDepthPoint]].
 * @public
 */
export interface DepthPointOptions {
  /** If true, geometry with the "non-locatable" flag set will not be selected. */
  excludeNonLocatable?: boolean;
  /** If true, geometry from pickable decorations will not be selected. */
  excludeDecorations?: boolean;
  /** If true, geometry from an IModelConnection other than the one associated with the Viewport will not be selected. */
  excludeExternalIModels?: boolean;
}

/** The minimum and maximum values for the z-depth of a rectangle of screen space.
 * Values are in [[CoordSystem.Npc]] so they will be between 0 and 1.0.
 * @public
 */
export interface DepthRangeNpc {
  /** The value closest to the back. */
  minimum: number;
  /** The value closest to the front. */
  maximum: number;
}

/** Options to allow changing the view rotation with zoomTo methods and ensure minimum bounding box dimensions for zoomToElements.
 * @public
 */
export interface ZoomToOptions {
  /** Set view rotation from standard view identifier. */
  standardViewId?: StandardViewId;
  /** Set view rotation relative to placement of first element or props entry. */
  placementRelativeId?: StandardViewId;
  /** Set view rotation from Matrix3d. */
  viewRotation?: Matrix3d;
  /** Ensure minimum element-aligned bounding box dimensions in meters (3d only). */
  minimumDimension?: number;
}

/** Options for changing the viewed Model of a 2d view via [[Viewport.changeViewedModel2d]]
 * @public
 */
export interface ChangeViewedModel2dOptions {
  /** If true, perform a "fit view" operation after changing to the new 2d model. */
  doFit?: boolean;
}

/** Describes an undo or redo event for a [[Viewport]].
 * @see [[Viewport.onViewUndoRedo]].
 * @public
 */
export enum ViewUndoEvent { Undo = 0, Redo = 1 }

/** @internal */
export const ELEMENT_MARKED_FOR_REMOVAL = Symbol.for("@bentley/imodeljs/Viewport/__element_marked_for_removal__");

declare global {
  interface Element {
    [ELEMENT_MARKED_FOR_REMOVAL]?: boolean;
  }
}

/** Payload for the [[Viewport.onFlashedIdChanged]] event indicating Ids of the currently- and/or previously-flashed objects.
 * @public
 */
export type OnFlashedIdChangedEventArgs = {
  readonly current: Id64String;
  readonly previous: Id64String;
} | {
  readonly current: Id64String;
  readonly previous: undefined;
} | {
  readonly previous: Id64String;
  readonly current: undefined;
};

/** Arguments to [[Viewport.getPixelDataWorldPoint]].
 * @public
 */
export interface GetPixelDataWorldPointArgs {
  /** The buffer containing the pixel data. @see [[Viewport.readPixels]]. */
  pixels: Pixel.Buffer;
  /** The x coordinate of the pixel of interest, in view coordinates. */
  x: number;
  /** The y coordinate of the pixel of interest, in view coordinates. */
  y: number;
  /** If true, then the world point of a pixel associated with a model will preserve any transforms applied to the model at display time,
   * such as those supplied by a [[ModelDisplayTransformProvider]] or [PlanProjectionSettings.elevation]($common).
   * Otherwise, the world point will be multiplied by the inverse of any such transforms to correlate it with the model's true coordinate space.
   */
  preserveModelDisplayTransforms?: boolean;
  /** If supplied, this point will be modified to store the returned point, instead of allocating a new point. */
  out?: Point3d;
}

/** Arguments supplied to [[Viewport.readImageBuffer]].
 * @public
 */
export interface ReadImageBufferArgs {
  /** The region of the viewport's [[ViewRect]] to capture. It must be fully contained within [[Viewport.viewRect]].
   * If unspecified, the entirety of the viewport's view rect is captured.
   */
  rect?: ViewRect;
  /** Optional dimensions to which to resize the captured image. If the aspect ratio of these dimensions does not match that of the captured image,
   * horizontal or vertical bars will be added to the resized image using the viewport's background color.
   * If unspecified, the image will not be resized.
   */
  size?: XAndY;
  /** The image captured by WebGL appears "upside-down" and must be flipped to appear right-side-up; if true, this flipping will not be performed.
   * This provides a performance optimization for uncommon cases in which an upside-down image is actually preferred.
   */
  upsideDown?: boolean;
}

/** MapLayer visibility based on its scale range definition.
 * @beta
 */
export interface MapLayerScaleRangeVisibility {
  /** True if map-layer is part of [[DisplayStyleState]]'s overlay map, otherwise map-layer is part of [[DisplayStyleState]]'s background map
  * @see [[DisplayStyleState.mapLayerAtIndex]].
  */
  isOverlay: boolean;

  /** Index of the map-layer in [[DisplayStyleState]]'s background/overlay map
   * @see [[DisplayStyleState.mapLayerAtIndex]].
  */
  index: number;

  /** Scale range visibility value of the map-layer */
  visibility: MapTileTreeScaleRangeVisibility;
}

/** Arguments supplied to [[Viewport.readPixels]].
 * @public
 * @extensions
 */
export interface ReadPixelsArgs {
  /** The function that will be invoked to process the captured pixel data. */
  receiver: Pixel.Receiver;
  /** The region of the viewport's contents to read. If the area is empty or not contained within the [[Viewport.viewRect]],
   * no pixels will be read.
   * If omitted, the viewport's entire contents will be read.
   */
  rect?: ViewRect;
  /** Specifies which aspects of each pixel to read. By default, all aspects are read. */
  selector?: Pixel.Selector;
  /** If true, geometry with the "non-locatable" flag set will not be drawn, potentially revealing locatable geometry it would otherwise obscure. */
  excludeNonLocatable?: boolean;
  /** An optional set of Ids of elements that should not be drawn, potentially revealing other geometry they would otherwise obscure. */
  excludedElements?: Iterable<Id64String>;
}

/** Arguments supplied to [[Viewport.readImageToCanvas]].
 * @public
 */
export interface ReadImageToCanvasOptions {
  /** If true, canvas decorations will not be included in the saved image. */
  omitCanvasDecorations?: boolean;
}

/** A Viewport renders the contents of one or more [GeometricModel]($backend)s onto an `HTMLCanvasElement`.
 *
 * It holds a [[ViewState]] object that defines its viewing parameters; the ViewState in turn defines the [[DisplayStyleState]],
 * [[CategorySelectorState]], and - for [[SpatialViewState]]s - the [[ModelSelectorState]]. While a ViewState is being displayed by a Viewport,
 * it is considered to be "attached" to that viewport; it remains attached until the Viewport is disposed of or becomes attached to a different ViewState.
 * While the ViewState is attached to a Viewport, any changes made to the ViewState or its display style or category/model selectors will be automatically
 * reflected in the Viewport. A ViewState can be attached to no more than one Viewport at a time.
 *
 * As changes to ViewState are made, Viewports also hold a stack of *previous copies* of it, to allow
 * for undo/redo (i.e. *View Previous* and *View Next*) of viewing tools.
 *
 * Changes to a Viewport's state can be monitored by attaching an event listener to a variety of specific events. Most such events are
 * triggered only once per frame, just before the Viewport's contents are rendered. For example, if the following sequence of events occurs:
 *
 *   * First frame is rendered
 *   * ViewFlags are modified
 *   * ViewFlags are modified again
 *   * Second frame is rendered
 *
 * The [[Viewport.onDisplayStyleChanged]] event will be invoked exactly once, when the second frame is rendered.
 *
 * @see [[ScreenViewport]] for a viewport that can render onto the screen.
 * @see [[OffScreenViewport]] for a viewport that can render into an off-screen buffer.
 * @public
 * @extensions
 */
export abstract class Viewport implements Disposable, TileUser {
  /** Event called whenever this viewport is synchronized with its [[ViewState]].
   * @note This event is invoked *very* frequently. To avoid negatively impacting performance, consider using one of the more specific Viewport events;
   * otherwise, avoid performing excessive computations in response to this event.
   * @see [[onViewportChanged]] for receiving events at more regular intervals with more specific information about what changed.
   * @see [[onChangeView]] for an event raised specifically when a different [[ViewState]] becomes associated with the viewport.
   */
  public readonly onViewChanged = new BeEvent<(vp: Viewport) => void>();
  /** Event called after reversing the most recent change to the Viewport from the undo stack or reapplying the
   * most recently undone change to the Viewport from the redo stack.
   */
  public readonly onViewUndoRedo = new BeEvent<(vp: Viewport, event: ViewUndoEvent) => void>();
  /** Event called on the next frame after this viewport's set of always-drawn elements changes. */
  public readonly onAlwaysDrawnChanged = new BeEvent<(vp: Viewport) => void>();
  /** Event called on the next frame after this viewport's set of never-drawn elements changes. */
  public readonly onNeverDrawnChanged = new BeEvent<(vp: Viewport) => void>();
  /** Event called on the next frame after this viewport's [[DisplayStyleState]] or its members change.
   * Aspects of the display style include [ViewFlags]($common), [SubCategoryOverride]($common)s, and [[Environment]] settings.
   */
  public readonly onDisplayStyleChanged = new BeEvent<(vp: Viewport) => void>();
  /** Event called on the next frame after this viewport's set of displayed categories changes. */
  public readonly onViewedCategoriesChanged = new BeEvent<(vp: Viewport) => void>();
  /** Event called on the next frame after this viewport's set of [[PerModelCategoryVisibility.Overrides]] changes. */
  public readonly onViewedCategoriesPerModelChanged = new BeEvent<(vp: Viewport) => void>();
  /** Event called on the next frame after this viewport's set of displayed models changes. */
  public readonly onViewedModelsChanged = new BeEvent<(vp: Viewport) => void>();
  /** Event called on the next frame after this viewport's [[FeatureOverrideProvider]] changes,
   * or the internal state of the provider changes such that the overrides needed to be recomputed.
   */
  public readonly onFeatureOverrideProviderChanged = new BeEvent<(vp: Viewport) => void>();
  /** Event called on the next frame after this viewport's [[FeatureSymbology.Overrides]] change. */
  public readonly onFeatureOverridesChanged = new BeEvent<(vp: Viewport) => void>();
  /** Event called on the next frame after any of the viewport's [[ChangeFlags]] changes. */
  public readonly onViewportChanged = new BeEvent<(vp: Viewport, changed: ChangeFlags) => void>();
  /** Event invoked immediately when [[changeView]] is called to replace the current [[ViewState]] with a different one. */
  public readonly onChangeView = new BeEvent<(vp: Viewport, previousViewState: ViewState) => void>();
  /** Event invoked immediately when the viewport is disposed.
   * @see [[Viewport.dispose]].
   */
  public readonly onDisposed = new BeEvent<(vp: Viewport) => void>();
  /** Event invoked after [[renderFrame]] detects that the dimensions of the viewport's [[ViewRect]] have changed.
   */
  public readonly onResized = new BeEvent<(vp: Viewport) => void>();
  /** Event dispatched immediately after [[flashedId]] changes, supplying the Ids of the previously and/or currently-flashed objects.
   * @note Attempting to assign to [[flashedId]] from within the event callback will produce an exception.
   */
  public readonly onFlashedIdChanged = new BeEvent<(vp: Viewport, args: OnFlashedIdChangedEventArgs) => void>();

  /** Event indicating when a map-layer scale range visibility change for the current viewport scale.
 * @beta
 */
  public readonly onMapLayerScaleRangeVisibilityChanged = new BeEvent<(layerIndexes: MapLayerScaleRangeVisibility[]) => void>();
  /** Event invoked every time [[invalidateScene]] is called.
   * @note This event will be raised **very** frequently. Avoid doing significant work inside of your event listener.
   * @beta
   */
  public readonly onSceneInvalidated = new BeEvent<(vp: Viewport) => void>();
  /** @internal */
  protected _hasMissingTiles = false;

  /** This is initialized by a call to [[changeView]] sometime shortly after the constructor is invoked.
   * During that time it can be undefined. DO NOT assign directly to this member - use `setView()`.
   */
  private _view!: ViewState;
  /** A function executed by `setView()` when `this._view` changes. */
  private readonly _detachFromView: VoidFunction[] = [];
  private readonly _detachFromDisplayStyle: VoidFunction[] = [];

  private readonly _viewportId: number;
  private _doContinuousRendering = false;
  /** @internal */
  protected _inViewChangedEvent = false;
  /** If false, indicates that [[Decorations]] should be recreated when rendering the next frame.
   * @note prefer to invoke [[invalidateDecorations]] rather than directly assigning to this property.
   */
  protected _decorationsValid = false;
  /** @internal */
  protected _sceneValid = false;
  /** @internal */
  public get sceneValid() { return this._sceneValid; }
  /** @internal */
  protected _renderPlanValid = false;
  /** @internal */
  public get renderPlanValid() { return this._renderPlanValid; }
  /** @internal */
  public setRenderPlanValid() { this._renderPlanValid = true; }
  /** @internal */
  protected _controllerValid = false;
  /** @internal */
  public get controllerValid() { return this._controllerValid; }
  private _redrawPending = false;
  private _analysisFractionValid = false;
  /** @internal */
  public get analysisFractionValid() { return this._analysisFractionValid; }
  private _timePointValid = false;
  /** @internal */
  public get timePointValid() { return this._timePointValid; }

  /** Strictly for tests. @internal */
  public setAllValid(): void {
    this._sceneValid = this._decorationsValid = this._renderPlanValid = this._controllerValid = this._redrawPending
      = this._analysisFractionValid = this._timePointValid = true;
  }

  /** Mark the current set of decorations invalid, so that they will be recreated on the next render frame.
   * This can be useful, for example, if an external event causes one or more current decorations to become invalid and you wish to force
   * them to be recreated to show the changes.
   * @note On the next frame, the `decorate` method of all [[ViewManager.decorators]] will be called. There is no way (or need) to
   * invalidate individual decorations.
   */
  public invalidateDecorations(): void {
    this._decorationsValid = false;
    IModelApp.requestNextAnimation();
  }

  /** Mark the viewport's scene as having changed, so that the next call to [[renderFrame]] will recreate it.
   * This method is not typically invoked directly - the scene is automatically invalidated in response to events such as moving the viewing frustum,
   * changing the set of viewed models, new tiles being loaded, etc.
   */
  public invalidateScene(): void {
    this._sceneValid = false;
    this._timePointValid = false;
    this.onSceneInvalidated.raiseEvent(this);
    this.invalidateDecorations();
  }

  /** Mark the viewport's "render plan" as having changed, so that the next call to [[renderFrame]] will recreate it.
   * This method is not typically invoked directly - the render plan is automatically invalidated in response to events such as changing aspects
   * of the viewport's [[displayStyle]].
   */
  public invalidateRenderPlan(): void {
    this._renderPlanValid = false;
    this.invalidateScene();
  }

  /** Mark the viewport's [[ViewState]] as having changed, so that the next call to [[renderFrame]] will invoke [[setupFromView]] to synchronize with the view.
   * This method is not typically invoked directly - the controller is automatically invalidated in response to events such as a call to [[changeView]].
   * Additionally, refresh the Reality Tile Tree to reflect changes in the map layer.
   */
  public invalidateController(): void {
    this._controllerValid = this._analysisFractionValid = false;
    this.invalidateRenderPlan();
  }

  /** @internal */
  public setValidScene() {
    this._sceneValid = true;
  }

  /** Request that the Viewport redraw its contents on the next frame. This is useful when some state outside of the Viewport's control but affecting its display has changed.
   * For example, if the parameters affecting a screen-space effect applied to this Viewport are modified, the Viewport's contents should be redrawn to reflect the change.
   * @note This does not necessarily cause the viewport to recreate its scene, decorations, or anything else - it only guarantees that the contents will be repainted.
   */
  public requestRedraw(): void {
    this._redrawPending = true;
    IModelApp.requestNextAnimation();
  }

  private _animator?: Animator;
  /** @internal */
  protected _changeFlags = new MutableChangeFlags();
  private _selectionSetDirty = true;
  private readonly _perModelCategoryVisibility: PerModelCategoryVisibility.Overrides;
  private _tileSizeModifier?: number;

  /** @internal */
  public readonly subcategories = new SubCategoriesCache.Queue();

  /** Time the current flash started. */
  private _flashUpdateTime?: BeTimePoint;
  /** Current flash intensity from [0..this.flashSettings.maxIntensity] */
  private _flashIntensity = 0;
  /** Id of the currently flashed element. */
  private _flashedElem?: string;
  /** Id of last flashed element. */
  private _lastFlashedElem?: string;
  /** The Id of the most recently flashed element, if any. */
  public get lastFlashedElementId(): Id64String | undefined {
    return this._lastFlashedElem;
  }

  private _wantViewAttachments = true;
  /** For debug purposes, controls whether or not view attachments are displayed in sheet views.
   * @internal
   */
  public get wantViewAttachments() { return this._wantViewAttachments; }
  public set wantViewAttachments(want: boolean) {
    if (want !== this._wantViewAttachments) {
      this._wantViewAttachments = want;
      this.invalidateScene();
    }
  }

  private _wantViewAttachmentBoundaries = false;
  /** For debug purposes, controls whether or not the boundary of each view attachment is displayed in a sheet view.
   * @internal
   */
  public get wantViewAttachmentBoundaries() { return this._wantViewAttachmentBoundaries; }
  public set wantViewAttachmentBoundaries(want: boolean) {
    if (want !== this._wantViewAttachmentBoundaries) {
      this._wantViewAttachmentBoundaries = want;
      this.invalidateScene();
    }
  }

  private _wantViewAttachmentClipShapes = false;
  /** For debug purposes, controls whether or not graphics representing the clipping shapes of each view attachment are displayed in a sheet view.
   * @internal
   */
  public get wantViewAttachmentClipShapes() { return this._wantViewAttachmentClipShapes; }
  public set wantViewAttachmentClipShapes(want: boolean) {
    if (want !== this._wantViewAttachmentClipShapes) {
      this._wantViewAttachmentClipShapes = want;
      this.invalidateScene();
    }
  }

  /** Don't allow entries in the view undo buffer unless they're separated by more than this amount of time. */
  public static undoDelay = BeDuration.fromSeconds(.5);

  private _debugBoundingBoxes: TileBoundingBoxes = TileBoundingBoxes.None;
  private _freezeScene = false;
  private _viewingSpace!: ViewingSpace;
  private _target?: RenderTarget;
  private _fadeOutActive = false;
  private _neverDrawn?: Id64Set;
  private _alwaysDrawn?: Id64Set;
  private _alwaysDrawnExclusive: boolean = false;
  private readonly _featureOverrideProviders: FeatureOverrideProvider[] = [];
  private readonly _tiledGraphicsProviders = new Set<TiledGraphicsProvider>();
  private _mapTiledGraphicsProvider?: MapTiledGraphicsProvider;
  private _hilite = new Hilite.Settings();
  private _emphasis = new Hilite.Settings(ColorDef.black, 0, 0, Hilite.Silhouette.Thick);
  private _flash = new FlashSettings();

  /** See [DisplayStyle3dSettings.lights]($common) */
  public get lightSettings(): LightSettings | undefined {
    return this.displayStyle.is3d() ? this.displayStyle.settings.lights : undefined;
  }
  public setLightSettings(settings: LightSettings) {
    if (this.displayStyle.is3d())
      this.displayStyle.settings.lights = settings;
  }

  /** See [DisplayStyle3dSettings.solarShadows]($common) */
  public get solarShadowSettings(): SolarShadowSettings | undefined {
    return this.view.displayStyle.is3d() ? this.view.displayStyle.settings.solarShadows : undefined;
  }
  public setSolarShadowSettings(settings: SolarShadowSettings) {
    if (this.view.displayStyle.is3d())
      this.view.displayStyle.solarShadows = settings;
  }

  /** @public */
  public get viewingSpace(): ViewingSpace { return this._viewingSpace; }

  /** This viewport's rotation matrix. */
  public get rotation(): Matrix3d { return this._viewingSpace.rotation; }
  /** The vector between the opposite corners of this viewport's extents. */
  public get viewDelta(): Vector3d { return this._viewingSpace.viewDelta; }
  /** Provides conversions between world and view coordinates. */
  public get worldToViewMap(): Map4d { return this._viewingSpace.worldToViewMap; }
  /** Provides conversions between world and Npc (non-dimensional perspective) coordinates. */
  public get worldToNpcMap(): Map4d { return this._viewingSpace.worldToNpcMap; }
  /** @internal */
  public get frustFraction(): number { return this._viewingSpace.frustFraction; }

  /** See [DisplayStyleSettings.analysisFraction]($common). */
  public get analysisFraction(): number {
    return this.displayStyle.settings.analysisFraction;
  }
  public set analysisFraction(fraction: number) {
    this.displayStyle.settings.analysisFraction = fraction;
  }

  /** See [DisplayStyleSettings.timePoint]($common) */
  public get timePoint(): number | undefined {
    return this.displayStyle.settings.timePoint;
  }
  public set timePoint(time: number | undefined) {
    this.displayStyle.settings.timePoint = time;
  }

  /** @internal */
  protected readonly _viewRange: ViewRect = new ViewRect();

  /** Get the rectangle of this Viewport in [[CoordSystem.View]] coordinates.
   * @note Do not modify the ViewRect's properties.
   */
  public abstract get viewRect(): ViewRect;
  /** @internal */
  public get isAspectRatioLocked(): boolean { return false; }

  /** @internal */
  public get target(): RenderTarget {
    assert(undefined !== this._target, "Accessing RenderTarget of a disposed Viewport");
    return this._target;
  }

  /** Returns true if this Viewport's [[dispose]] method has been invoked. It is an error to attempt to interact with a disposed Viewport.
   * Typically a [[ScreenViewport]] becomes disposed as a result of a call to [[ViewManager.dropViewport]], often indirectly through the unmounting of a nine-zone UI's [[ViewportComponent]] when, e.g., switching front-stages.
   * @public
   */
  public get isDisposed(): boolean {
    return undefined === this._target;
  }

  /** The settings that control how elements are hilited in this Viewport. */
  public get hilite(): Hilite.Settings { return this._hilite; }
  public set hilite(hilite: Hilite.Settings) {
    this._hilite = hilite;
    this.invalidateRenderPlan();
  }

  /** The settings that control how emphasized elements are displayed in this Viewport. The default settings apply a thick black silhouette to the emphasized elements.
   * @see [FeatureAppearance.emphasized]($common).
   */
  public get emphasisSettings(): Hilite.Settings { return this._emphasis; }
  public set emphasisSettings(settings: Hilite.Settings) {
    this._emphasis = settings;
    this.invalidateRenderPlan();
  }

  /** The settings that control how elements are flashed in this viewport. */
  public get flashSettings(): FlashSettings {
    return this._flash;
  }
  public set flashSettings(settings: FlashSettings) {
    this._flash = settings;
    this.invalidateRenderPlan();
  }

  /** Determine whether the Grid display is currently enabled in this Viewport.
   * @return true if the grid display is on.
   */
  public get isGridOn(): boolean { return this.viewFlags.grid; }

  /** Flags controlling aspects of how the contents of this viewport are rendered.
   * @see [DisplayStyleSettings.viewFlags]($common).
   */
  public get viewFlags(): ViewFlags { return this.view.viewFlags; }
  public set viewFlags(viewFlags: ViewFlags) {
    this.view.displayStyle.viewFlags = viewFlags;
  }

  /** See [[ViewState.displayStyle]] */
  public get displayStyle(): DisplayStyleState { return this.view.displayStyle; }
  public set displayStyle(style: DisplayStyleState) {
    this.view.displayStyle = style;
  }

  /** Selectively override aspects of this viewport's display style.
   * @see [DisplayStyleSettings.applyOverrides]($common)
   */
  public overrideDisplayStyle(overrides: DisplayStyleSettingsProps): void {
    this.displayStyle.settings.applyOverrides(overrides);
  }

  /** See [DisplayStyleSettings.clipStyle]($common) */
  public get clipStyle(): ClipStyle { return this.displayStyle.settings.clipStyle; }
  public set clipStyle(style: ClipStyle) {
    this.displayStyle.settings.clipStyle = style;
  }

  /** Sets the number of [MSAA]($docs/learning/display/MSAA.md) samples for this viewport.
   * The number of samples is a power of two. Values of 1 or less indicates anti-aliasing should be disabled. Non-power-of-two values are rounded
   * down to the nearest power of two. The maximum number of samples supported depends upon the client's graphics hardware capabilities. Higher values produce
   * a higher-quality image but also may also reduce framerate.
   * @see [[ViewManager.setAntialiasingAllViews]] to adjust the number of samples for all viewports.
   */
  public get antialiasSamples(): number {
    return undefined !== this._target ? this._target.antialiasSamples : 1;
  }
  public set antialiasSamples(numSamples: number) {
    if (undefined !== this._target) {
      this._target.antialiasSamples = numSamples;
      this.invalidateRenderPlan();
    }
  }

  /** return true if viewing globe (globeMode is 3D and eye location is far above globe
   * @alpha
   */
  public get viewingGlobe() {
    const view = this.view;
    if (!view.is3d())
      return false;

    return this.displayStyle.globeMode === GlobeMode.Ellipsoid && view.isGlobalView;
  }

  /** Remove any [[SubCategoryOverride]] for the specified subcategory.
   * @param id The Id of the subcategory.
   * @see [[overrideSubCategory]]
   */
  public dropSubCategoryOverride(id: Id64String): void {
    this.view.displayStyle.dropSubCategoryOverride(id);
  }

  /** Override the symbology of geometry belonging to a specific subcategory when rendered within this viewport.
   * @param id The Id of the subcategory.
   * @param ovr The symbology overrides to apply to all geometry belonging to the specified subcategory.
   * @see [[dropSubCategoryOverride]]
   */
  public overrideSubCategory(id: Id64String, ovr: SubCategoryOverride): void {
    this.view.displayStyle.overrideSubCategory(id, ovr);
  }

  /** Query the symbology overrides applied to geometry belonging to a specific subcategory when rendered within this viewport.
   * @param id The Id of the subcategory.
   * @return The symbology overrides applied to all geometry belonging to the specified subcategory, or undefined if no such overrides exist.
   * @see [[overrideSubCategory]]
   */
  public getSubCategoryOverride(id: Id64String): SubCategoryOverride | undefined {
    return this.view.displayStyle.getSubCategoryOverride(id);
  }

  /** Query the symbology with which geometry belonging to a specific subcategory is rendered within this viewport.
   * Every [[SubCategory]] defines a base symbology independent of any [[Viewport]].
   * If a [[SubCategoryOverride]] has been applied to the subcategory within the context of this [[Viewport]], it will be applied to the subcategory's base symbology.
   * @param id The Id of the subcategory.
   * @return The symbology of the subcategory within this viewport, including any overrides.
   * @see [[overrideSubCategory]]
   */
  public getSubCategoryAppearance(id: Id64String): SubCategoryAppearance {
    const app = this.iModel.subcategories.getSubCategoryAppearance(id);
    if (undefined === app)
      return SubCategoryAppearance.defaults;

    const ovr = this.getSubCategoryOverride(id);
    return undefined !== ovr ? ovr.override(app) : app;
  }

  /** Determine whether geometry belonging to a specific SubCategory is visible in this viewport, assuming the containing Category is displayed.
   * @param id The Id of the subcategory
   * @returns true if the subcategory is visible in this viewport.
   * @note Because this function does not know the Id of the containing Category, it does not check if the Category is enabled for display. The caller should check that separately if he knows the Id of the Category.
   */
  public isSubCategoryVisible(id: Id64String): boolean { return this.view.isSubCategoryVisible(id); }

  /** Override the appearance of a model when rendered within this viewport.
   * @param id The Id of the model.
   * @param ovr The symbology overrides to apply to all geometry belonging to the specified subcategory.
   * @see [DisplayStyleSettings.overrideModelAppearance]($common)
   */
  public overrideModelAppearance(id: Id64String, ovr: FeatureAppearance): void {
    this.view.displayStyle.settings.overrideModelAppearance(id, ovr);
  }

  /** Remove any model appearance override for the specified model.
   * @param id The Id of the model.
   * @see [DisplayStyleSettings.dropModelAppearanceOverride]($common)
   */
  public dropModelAppearanceOverride(id: Id64String): void {
    this.view.displayStyle.settings.dropModelAppearanceOverride(id);
  }

  /** Some changes may or may not require us to invalidate the scene.
   * Specifically, when shadows are enabled or we are displaying view attachments, the following changes may affect the visibility or transparency of elements or features:
   * - Viewed categories and subcategories;
   * - Always/never drawn elements
   * - Symbology overrides.
   */
  private maybeInvalidateScene(): void {
    // When shadows are being displayed and the set of displayed categories changes, we must invalidate the scene so that shadows will be regenerated.
    // Same occurs when changing feature symbology overrides (e.g., always/never-drawn element sets, transparency override)
    if (!this._sceneValid)
      return;

    if (this.view.displayStyle.wantShadows || this.view.isSheetView())
      this.invalidateScene();
  }

  /** Enable or disable display of elements belonging to a set of categories specified by Id.
   * Visibility of individual subcategories belonging to a category can be controlled separately through the use of [[SubCategoryOverride]]s.
   * By default, enabling display of a category does not affect display of subcategories thereof which have been overridden to be invisible.
   * @param categories The Id(s) of the categories to which the change should be applied. No other categories will be affected.
   * @param display Whether or not elements on the specified categories should be displayed in the viewport.
   * @param enableAllSubCategories Specifies that when enabling display for a category, all of its subcategories should also be displayed even if they are overridden to be invisible.
   */
  public changeCategoryDisplay(categories: Id64Arg, display: boolean, enableAllSubCategories: boolean = false): void {
    if (!display) {
      this.view.categorySelector.dropCategories(categories);
      return;
    }

    this.view.categorySelector.addCategories(categories);
    const categoryIds = Id64.toIdSet(categories);

    this.updateSubCategories(categoryIds, enableAllSubCategories);
  }

  private updateSubCategories(categoryIds: Id64Arg, enableAllSubCategories: boolean): void {
    this.subcategories.push(this.iModel.subcategories, categoryIds, () => {
      if (enableAllSubCategories)
        this.enableAllSubCategories(categoryIds);

      this._changeFlags.setViewedCategories();
    });
  }

  private enableAllSubCategories(categoryIds: Id64Arg): void {
    if (this.displayStyle.enableAllLoadedSubCategories(categoryIds))
      this.maybeInvalidateScene();
  }

  /** @internal */
  public getSubCategories(categoryId: Id64String): Id64Set | undefined { return this.iModel.subcategories.getSubCategories(categoryId); }

  /** Change the visibility of geometry belonging to the specified subcategory when displayed in this viewport.
   * @param subCategoryId The Id of the subcategory
   * @param display: True to make geometry belonging to the subcategory visible within this viewport, false to make it invisible.
   */
  public changeSubCategoryDisplay(subCategoryId: Id64String, display: boolean): void {
    if (this.displayStyle.setSubCategoryVisible(subCategoryId, display))
      this.maybeInvalidateScene();
  }

  /** The settings controlling how a background map is displayed within a view.
   * @see [[ViewFlags.backgroundMap]] for toggling display of the map on or off.
   * @see [DisplayStyleSettings.backgroundMap]($common)
   */
  public get backgroundMapSettings(): BackgroundMapSettings { return this.displayStyle.backgroundMapSettings; }
  public set backgroundMapSettings(settings: BackgroundMapSettings) {
    this.displayStyle.backgroundMapSettings = settings;
  }

  /** See [[DisplayStyleState.changeBackgroundMapProps]] */
  public changeBackgroundMapProps(props: BackgroundMapProps): void {
    this.displayStyle.changeBackgroundMapProps(props);
  }

  /** See [[DisplayStyleState.changeBackgroundMapProvider]] */
  public changeBackgroundMapProvider(props: BackgroundMapProviderProps): void {
    this.displayStyle.changeBackgroundMapProvider(props);
  }

  /** A reference to the [[TileTree]] used to display the background map in this viewport, if the background map is being displayed. */
  public get backgroundMapTileTreeReference(): TileTreeReference | undefined {
    return this.backgroundMap;
  }

  /** @internal */
  public get backgroundMap(): MapTileTreeReference | undefined { return this._mapTiledGraphicsProvider?.backgroundMap; }

  /** @internal */
  public get overlayMap(): MapTileTreeReference | undefined { return this._mapTiledGraphicsProvider?.overlayMap; }

  /** @internal */
  public get backgroundDrapeMap(): MapTileTreeReference | undefined { return this._mapTiledGraphicsProvider?.backgroundDrapeMap; }

  /** Return the imagery provider for the provided map-layer index.
   * @param mapLayerIndex the [[MapLayerIndex]] of the map layer.
   * @beta
   */
  public getMapLayerImageryProvider(mapLayerIndex: MapLayerIndex): MapLayerImageryProvider | undefined { return this._mapTiledGraphicsProvider?.getMapLayerImageryProvider(mapLayerIndex); }

  /** Return the map-layer scale range visibility for the provided map-layer index.
   * @param mapLayerIndex the [[MapLayerIndex]] of the map layer.
   * @see [[DisplayStyleState.mapLayerAtIndex]].
   * @beta
   */
  public getMapLayerScaleRangeVisibility(mapLayerIndex: MapLayerIndex): MapTileTreeScaleRangeVisibility {
    const treeRef = (mapLayerIndex.isOverlay ? this._mapTiledGraphicsProvider?.overlayMap : this._mapTiledGraphicsProvider?.backgroundMap);
    if (treeRef) {
      return treeRef.getMapLayerScaleRangeVisibility(mapLayerIndex.index);

    }
    return MapTileTreeScaleRangeVisibility.Unknown;
  }

  /** Return a list of map-layers indexes matching a given  MapTile tree Id and a layer imagery tree id.
   * Note: A imagery tree can be shared for multiple map-layers.
   * @internal
   */
  public getMapLayerIndexesFromIds(mapTreeId: Id64String, layerTreeId: Id64String): MapLayerIndex[] {
    if (this._mapTiledGraphicsProvider)
      return this._mapTiledGraphicsProvider?.getMapLayerIndexesFromIds(mapTreeId, layerTreeId);

    return [];
  }

  /** Returns the cartographic range of a map layer.
   * @param mapLayerIndex the [[MapLayerIndex]] of the map layer.
   */
  public async getMapLayerRange(mapLayerIndex: MapLayerIndex): Promise<MapCartoRectangle | undefined> {
    const mapLayerSettings = this.view.displayStyle.mapLayerAtIndex(mapLayerIndex);
    if (undefined === mapLayerSettings)
      return undefined;

    if (mapLayerSettings instanceof ModelMapLayerSettings) {
      const ecefTransform = this.iModel.ecefLocation?.getTransform();
      if (!ecefTransform)
        return undefined;
      const model = this.iModel.models.getLoaded(mapLayerSettings.modelId);
      if (!model || !(model instanceof GeometricModelState))
        return undefined;

      const modelRange = await model.queryModelRange();
      const cartoRange = new CartographicRange(modelRange, ecefTransform).getLongitudeLatitudeBoundingBox();

      return MapCartoRectangle.fromRadians(cartoRange.low.x, cartoRange.low.y, cartoRange.high.x, cartoRange.high.y);
    }

    const imageryProvider = this.getMapLayerImageryProvider(mapLayerIndex);
    if (undefined === imageryProvider)
      return undefined;

    const tileTreeRef = mapLayerIndex.isOverlay ? this.overlayMap : this.backgroundMap;
    const imageryTreeRef = tileTreeRef?.getLayerImageryTreeRef(mapLayerIndex.index);

    if (imageryTreeRef?.treeOwner.loadStatus === TileTreeLoadStatus.Loaded) {
      return imageryProvider.cartoRange;
    } else {
      return undefined;
    }
  }

  /** Changes viewport to include range of a map layer.
   * @param mapLayerIndex the [[MapLayerIndex]] of the map layer.
   * @param vp the viewport.
   */
  public async viewMapLayerRange(mapLayerIndex: MapLayerIndex, vp: ScreenViewport): Promise<boolean> {
    const range = await this.getMapLayerRange(mapLayerIndex);
    if (!range)
      return false;

    if (range.xLength() > 1.5 * Angle.piRadians)
      viewGlobalLocation(vp, true, ViewGlobalLocationConstants.satelliteHeightAboveEarthInMeters, undefined, undefined);
    else
      viewGlobalLocation(vp, true, undefined, undefined, range.globalLocation);

    return true;
  }

  /** Fully reset a map-layer tile tree; by calling this, the map-layer will to go through initialize process again, and all previously fetched tile will be lost.
   * @beta
   */
  public resetMapLayer(mapLayerIndex: MapLayerIndex) { this._mapTiledGraphicsProvider?.resetMapLayer(mapLayerIndex); }

  /** Returns true if this Viewport is currently displaying the model with the specified Id. */
  public viewsModel(modelId: Id64String): boolean { return this.view.viewsModel(modelId); }

  /** Attempt to change the 2d Model this Viewport is displaying, if its ViewState is a ViewState2d.
   * @param baseModelId The Id of the new 2d Model to be displayed.
   * @param options options that determine how the new view is displayed
   * @note This function *only works* if the viewport is viewing a [[ViewState2d]], otherwise it does nothing. Also note that
   * the Model of baseModelId should be the same type (Drawing or Sheet) as the current view.
   * @note this method clones the current ViewState2d and sets its baseModelId to the supplied value. The DisplayStyle and CategorySelector remain unchanged.
   */
  public async changeViewedModel2d(baseModelId: Id64String, options?: ChangeViewedModel2dOptions & ViewChangeOptions & MarginOptions): Promise<void> {
    if (!this.view.is2d())
      return;

    // Clone the current ViewState, change its baseModelId, and ensure the new model is loaded.
    const newView = this.view.clone(); // start by cloning the current ViewState
    await newView.changeViewedModel(baseModelId);

    this.changeView(newView, options); // switch this viewport to use new ViewState2d

    if (options && options.doFit) { // optionally fit view to the extents of the new model
      const range = await this.iModel.models.queryExtents([baseModelId]);
      this.zoomToVolume(Range3d.fromJSON(range[0]?.extents), options);
    }
  }

  /** Attempt to replace the set of models currently viewed by this viewport, if it is displaying a SpatialView
   * @param modelIds The Ids of the models to be displayed.
   * @returns false if this Viewport is not viewing a [[SpatialViewState]]
   * @note This function *only works* if the viewport is viewing a [[SpatialViewState]], otherwise it does nothing.
   * @note This function *does not load* any models. If any of the supplied `modelIds` refers to a model that has not been loaded, no graphics will be loaded+displayed in the viewport for that model.
   * @see [[replaceViewedModels]] for a similar function that also ensures the requested models are loaded.
   */
  public changeViewedModels(modelIds: Id64Arg): boolean {
    if (!this.view.isSpatialView())
      return false;

    this.view.modelSelector.models.clear();
    this.view.modelSelector.addModels(modelIds);
    return true;
  }

  /** Attempt to replace the set of models currently viewed by this viewport, if it is displaying a SpatialView
   * @param modelIds The Ids of the models to be displayed.
   * @note This function *only works* if the viewport is viewing a [[SpatialViewState]], otherwise it does nothing.
   * @note If any of the requested models is not yet loaded this function will asynchronously load them before updating the set of displayed models.
   */
  public async replaceViewedModels(modelIds: Id64Arg): Promise<void> {
    if (this.view.isSpatialView()) {
      this.view.modelSelector.models.clear();
      return this.addViewedModels(modelIds);
    }
  }

  /** Add or remove a set of models from those models currently displayed in this viewport.
   * @param modelIds The Ids of the models to add or remove.
   * @param display Whether or not to display the specified models in the viewport.
   * @returns false if this Viewport is not viewing a [[SpatialViewState]]
   * @note This function *only works* if the viewport is viewing a [[SpatialViewState]], otherwise it does nothing.
   * @note This function *does not load* any models. If `display` is `true` and any of the supplied `models` refers to a model that has not been loaded, no graphics will be loaded+displayed in the viewport for that model.
   * @see [[addViewedModels]] for a similar function that also ensures the requested models are loaded.
   */
  public changeModelDisplay(models: Id64Arg, display: boolean): boolean {
    if (!this.view.isSpatialView())
      return false;

    if (display)
      this.view.modelSelector.addModels(models);
    else
      this.view.modelSelector.dropModels(models);

    return true;
  }

  /** Adds a set of models to the set of those currently displayed in this viewport.
   * @param modelIds The Ids of the models to add or remove.
   * @param display Whether or not to display the specified models in the viewport.
   * @note This function *only works* if the viewport is viewing a [[SpatialViewState]], otherwise it does nothing.
   * @note If any of the requested models is not yet loaded this function will asynchronously load them before updating the set of displayed models.
   */
  public async addViewedModels(models: Id64Arg): Promise<void> {
    // NB: We want the model selector to update immediately, to avoid callers repeatedly requesting we load+display the same models while we are already loading them.
    // This will also trigger scene invalidation and changed events.
    if (!this.changeModelDisplay(models, true))
      return; // means it's a 2d model - this function can do nothing useful in 2d.

    const unloaded = this.iModel.models.filterLoaded(models);
    if (undefined === unloaded)
      return;

    // Need to redraw once models are available. Don't want to trigger events again.
    await this.iModel.models.load(models);
    this.invalidateScene();
    assert(this.view.isSpatialView());
    this.view.markModelSelectorChanged();
  }

  /** Determines what type (if any) of debug graphics will be displayed to visualize [[Tile]] volumes. Chiefly for debugging.
   * @see [[TileBoundingBoxes]]
   */
  public get debugBoundingBoxes(): TileBoundingBoxes { return this._debugBoundingBoxes; }
  public set debugBoundingBoxes(boxes: TileBoundingBoxes) {
    if (boxes !== this.debugBoundingBoxes) {
      this._debugBoundingBoxes = boxes;
      this.invalidateScene();
    }
  }
  /** When true, the scene will never be recreated. Chiefly for debugging purposes.
   * @internal
   */
  public get freezeScene(): boolean { return this._freezeScene; }
  public set freezeScene(freeze: boolean) {
    if (freeze !== this._freezeScene) {
      this._freezeScene = freeze;
      if (!freeze)
        this.invalidateScene();
    }
  }

  /** The iModel of this Viewport */
  public get iModel(): IModelConnection { return this.view.iModel; }
  /** @internal */
  public get isPointAdjustmentRequired(): boolean { return this.view.is3d(); }
  /** @internal */
  public get isSnapAdjustmentRequired(): boolean { return IModelApp.toolAdmin.acsPlaneSnapLock && this.view.is3d(); }
  /** @internal */
  public get isContextRotationRequired(): boolean { return IModelApp.toolAdmin.acsContextLock; }

  /** Enables or disables "fade-out" mode. When this mode is enabled, transparent graphics are rendered with a flat alpha weight,
   * causing them to appear de-emphasized. This is typically used in contexts in which a handful of elements are to be emphasized in the view,
   * while the rest of the graphics are drawn transparently.
   */
  public get isFadeOutActive(): boolean { return this._fadeOutActive; }
  public set isFadeOutActive(active: boolean) {
    if (active !== this._fadeOutActive) {
      this._fadeOutActive = active;
      this.invalidateRenderPlan();
    }
  }

  /** Obtain a tooltip from the map layer or reality model, if any, identified by the specified [[HitDetail]].
 * @see [[ElementLocateManager]]
  */
  public async getToolTip(hit: HitDetail): Promise<HTMLElement | string> {
    const promises = new Array<Promise<string | HTMLElement | undefined>>();
    for (const ref of this.getTileTreeRefs()) {
      const promise = ref.getToolTipPromise(hit);
      if (promise) {
        promises.push(promise);
      }
    }

    const results = await Promise.all(promises);
    return results.find((result) => undefined !== result) ?? "";
  }

  /** Obtain feature information from a map layer model, if any, identified by the specified [[HitDetail]].
   * @see [[ElementLocateManager]]
   * @see [[MapFeatureInfo]]
   * @beta
   */
  public async getMapFeatureInfo(hit: HitDetail, options?: MapFeatureInfoOptions): Promise<MapFeatureInfo> {
    const promises = new Array<Promise<MapLayerFeatureInfo[] | undefined>>();

    // Execute 'getMapFeatureInfo' on every tree, and make sure to handle exception for each call,
    // so that we get still get results even though a tree has failed.
    for (const tree of this.mapTileTreeRefs) {
      promises.push(tree.getMapFeatureInfo(hit, options).catch(() => undefined));
    }

    const featureInfo: MapFeatureInfo = {};

    const worldPoint = hit.hitPoint.clone();
    const backgroundMapGeometry = hit.viewport.displayStyle.getBackgroundMapGeometry();
    if (undefined !== backgroundMapGeometry) {
      featureInfo.hitPoint = (await backgroundMapGeometry.dbToCartographicFromGcs([worldPoint]))[0];
    }

    const results = await Promise.all(promises);
    for (const result of results)
      if (result !== undefined) {

        if (featureInfo.layerInfos === undefined) {
          featureInfo.layerInfos = [];
        }

        featureInfo.layerInfos.push(...result);
      }
    return featureInfo;
  }

  /** If this event has one or more listeners, collection of timing statistics related to rendering frames is enabled. Frame statistics will be received by the listeners whenever a frame is finished rendering.
   * @note The timing data collected using this event only collects the amount of time spent on the CPU. Due to performance considerations, time spent on the GPU is not collected. Therefore, these statistics are not a direct mapping to user experience.
   * @note In order to avoid interfering with the rendering loop, take care to avoid performing any intensive tasks in your event listeners.
   * @see [[FrameStats]]
   * @alpha
   */
  public readonly onFrameStats = new BeEvent<(frameStats: Readonly<FrameStats>) => void>();

  private _frameStatsCollector = new FrameStatsCollector(this.onFrameStats);

  /** A function invoked once, after the constructor, to initialize the viewport's state.
   * Subclasses can use this perform additional initialization, as the viewport's constructor is not directly invokable.
   */
  protected initialize(): void {
  }

  /** @internal because subclasses must derive from ScreenViewport or OffScreenviewport. */
  protected constructor(target: RenderTarget) {
    this._target = target;
    target.assignFrameStatsCollector(this._frameStatsCollector);
    this._viewportId = TileUser.generateId();
    this._perModelCategoryVisibility = PerModelCategoryVisibility.createOverrides(this);
    IModelApp.tileAdmin.registerUser(this);
  }

  public [Symbol.dispose](): void {
    if (this.isDisposed)
      return;

    this._target = dispose(this._target);
    this.subcategories[Symbol.dispose]();
    IModelApp.tileAdmin.forgetUser(this);
    this.onDisposed.raiseEvent(this);
    this.detachFromView();
  }

  /** @deprecated in 5.0 - will not be removed until after 2026-06-13. Use [Symbol.dispose] instead. */
  public dispose() {
    this[Symbol.dispose]();
  }

  private setView(view: ViewState): void {
    if (view === this._view)
      return;

    if (this._mapTiledGraphicsProvider)
      this._mapTiledGraphicsProvider.setView(view);
    this.detachFromView();
    this._view = view;
    this.attachToView();
  }

  /** @internal Invoked when the viewport becomes associated with a new ViewState to register event listeners with the view
   * and allow the ViewState to set up internal state that is only relevant when associated with a Viewport.
   * Also invoked after changing OffScreenViewport.drawingToSheetTransform.
   * @internal
   */
  protected attachToView(): void {
    this.registerDisplayStyleListeners(this.view.displayStyle);
    this.registerViewListeners();
    this.view.attachToViewport(this);
    this._mapTiledGraphicsProvider = new MapTiledGraphicsProvider(this.viewportId, this.displayStyle);
  }

  private registerViewListeners(): void {
    const view = this.view;
    const removals = this._detachFromView;

    // When we detach from the view, also unregister display style listeners.
    removals.push(() => this.detachFromDisplayStyle());

    removals.push(view.onModelDisplayTransformProviderChanged.addListener(() => this.invalidateScene()));
    removals.push(view.details.onClipVectorChanged.addListener(() => this.invalidateRenderPlan()));

    removals.push(view.onViewedCategoriesChanged.addListener(() => {
      this._changeFlags.setViewedCategories();
      this.maybeInvalidateScene();
    }));

    removals.push(view.onDisplayStyleChanged.addListener((newStyle) => {
      this._changeFlags.setDisplayStyle();
      this.setFeatureOverrideProviderChanged();
      this.invalidateRenderPlan();

      this.detachFromDisplayStyle();
      this._mapTiledGraphicsProvider = new MapTiledGraphicsProvider(this.viewportId, newStyle);
      this.registerDisplayStyleListeners(newStyle);
    }));

    if (view.isSpatialView()) {
      removals.push(view.onViewedModelsChanged.addListener(() => {
        this._changeFlags.setViewedModels();
        this.invalidateScene();
      }));

      removals.push(view.details.onModelClipGroupsChanged.addListener(() => {
        this.invalidateScene();
      }));

      // If a map elevation request is required (only in cases where terrain is not geodetic)
      // then the completion of the request will require synching with the view so that the
      // frustum depth is recalculated correctly.  Register this for removal when the view is detached.
      removals.push(this.iModel.onMapElevationLoaded.addListener((_iModel: IModelConnection) => {
        this.synchWithView();
      }));
    }
  }

  private registerDisplayStyleListeners(style: DisplayStyleState): void {
    const settings = style.settings;
    const removals = this._detachFromDisplayStyle;

    const displayStyleChanged = () => {
      this.invalidateRenderPlan();
      this._changeFlags.setDisplayStyle();
    };

    const invalidateControllerAndDisplayStyleChanged = () => {
      this.invalidateController();
      this._changeFlags.setDisplayStyle();
    };

    const styleAndOverridesChanged = () => {
      displayStyleChanged();
      this.setFeatureOverrideProviderChanged();
    };

    removals.push(settings.onSubCategoryOverridesChanged.addListener(styleAndOverridesChanged));
    removals.push(settings.onModelAppearanceOverrideChanged.addListener(styleAndOverridesChanged));
    removals.push(settings.onBackgroundColorChanged.addListener(displayStyleChanged));
    removals.push(settings.onMonochromeColorChanged.addListener(displayStyleChanged));
    removals.push(settings.onMonochromeModeChanged.addListener(displayStyleChanged));
    removals.push(settings.onClipStyleChanged.addListener(styleAndOverridesChanged));
    removals.push(settings.onPlanarClipMaskChanged.addListener(displayStyleChanged));
    removals.push(settings.onWhiteOnWhiteReversalChanged.addListener(displayStyleChanged));
    removals.push(settings.contextRealityModels.onPlanarClipMaskChanged.addListener(displayStyleChanged));
    removals.push(settings.contextRealityModels.onAppearanceOverridesChanged.addListener(displayStyleChanged));
    removals.push(settings.contextRealityModels.onDisplaySettingsChanged.addListener(displayStyleChanged));
    removals.push(settings.contextRealityModels.onInvisibleChanged.addListener(invalidateControllerAndDisplayStyleChanged));
    removals.push(settings.onRealityModelDisplaySettingsChanged.addListener(displayStyleChanged));
    removals.push(settings.contextRealityModels.onChanged.addListener(displayStyleChanged));

    removals.push(style.onOSMBuildingDisplayChanged.addListener(() => {
      displayStyleChanged();
      this.synchWithView({ noSaveInUndo: true }); // May change frustum depth.
    }));

    const analysisChanged = () => {
      this._changeFlags.setDisplayStyle();
      this._analysisFractionValid = false;
      IModelApp.requestNextAnimation();
    };
    const analysisStyleChanged = () => {
      this.invalidateRenderPlan();
      analysisChanged();
    };
    removals.push(settings.onAnalysisFractionChanged.addListener(analysisChanged));
    removals.push(settings.onAnalysisStyleChanged.addListener(analysisStyleChanged));

    const scheduleChanged = () => {
      this._timePointValid = false;
      this._changeFlags.setDisplayStyle();
      this.setFeatureOverrideProviderChanged();
      IModelApp.requestNextAnimation();
    };

    const scriptChanged = () => {
      scheduleChanged();
      this.invalidateScene();
    };

    removals.push(settings.onTimePointChanged.addListener(scheduleChanged));
    removals.push(style.onScheduleScriptChanged.addListener(scriptChanged));


    const scheduleEditingChanged = async (
      changes: RenderSchedule.EditingChanges[]
    ) => {
      for (const ref of this.getTileTreeRefs()) {
        const tree = ref.treeOwner.tileTree;
        await tree?.onScheduleEditingChanged(changes);
      }
    };

    const scheduleEditingCommitted = () => {
      for (const ref of this.getTileTreeRefs()) {
        const tree = ref.treeOwner.tileTree;
        tree?.onScheduleEditingCommitted();
      }
    };

    removals.push(
      style.onScheduleEditingChanged.addListener((changes) => {
        void scheduleEditingChanged(changes);
      })
    );
    removals.push(style.onScheduleEditingCommitted.addListener(scheduleEditingCommitted));

    removals.push(settings.onViewFlagsChanged.addListener((vf) => {
      if (vf.backgroundMap !== this.viewFlags.backgroundMap)
        this.invalidateController();
      else
        this.invalidateRenderPlan();

      this._changeFlags.setDisplayStyle();
    }));

    // ###TODO detach/attach reality model
    // ###TODO reality model appearance overrides
    // ###TODO OSM Building display

    const mapChanged = () => {
      this.invalidateController();
      this._changeFlags.setDisplayStyle();
    };

    removals.push(settings.onBackgroundMapChanged.addListener(mapChanged));
    removals.push(settings.onMapImageryChanged.addListener(mapChanged));

    removals.push(settings.onExcludedElementsChanged.addListener(() => {
      this._changeFlags.setDisplayStyle();
      this.maybeInvalidateScene();
      this.setFeatureOverrideProviderChanged();
    }));

    if (settings.is3d()) {
      removals.push(settings.onLightsChanged.addListener(displayStyleChanged));
      removals.push(settings.onSolarShadowsChanged.addListener(displayStyleChanged));
      removals.push(settings.onThematicChanged.addListener(displayStyleChanged));
      removals.push(settings.onHiddenLineSettingsChanged.addListener(displayStyleChanged));
      removals.push(settings.onAmbientOcclusionSettingsChanged.addListener(displayStyleChanged));
      removals.push(settings.onEnvironmentChanged.addListener(displayStyleChanged));
      removals.push(settings.onPlanProjectionSettingsChanged.addListener(displayStyleChanged));
      removals.push(settings.onContoursChanged.addListener(displayStyleChanged));
    }
  }

  /** @internal Invoked when the viewport becomes associated with a new ViewState to unregister event listeners for
   * the previous ViewState and allow the previous ViewState to clean up any internal state that is only relevant while
   * associated with a Viewport.
   * Also invoked after changing OffScreenViewport.drawingToSheetTransform.
   * @internal
   */
  protected detachFromView(): void {
    this._detachFromView.forEach((f) => f());
    this._detachFromView.length = 0;

    if (this._view)
      this._view.detachFromViewport();

  }

  private detachFromDisplayStyle(): void {
    this._detachFromDisplayStyle.forEach((f) => f());
    this._detachFromDisplayStyle.length = 0;

    if (this._mapTiledGraphicsProvider) {
      this._mapTiledGraphicsProvider.detachFromDisplayStyle();
      this._mapTiledGraphicsProvider = undefined;
    }
  }

  /** Enables or disables continuous rendering. Ideally, during each render frame a Viewport will do as little work as possible.
   * To make that possible, the viewport keeps track of what has changed about its internal state from one frame to the next.
   * For example, if the view frustum has not changed since the previous frame, it is likely that the viewport does not need to be
   * re-rendered at all.
   *
   * In some circumstances, it is desirable to bypass the logic that limits the amount of work performed each frame. A primary example
   * is a viewport that has some animations applied to it, or when diagnostic information like frames-per-second is being monitored.
   *
   * @note An application which enables continuous rendering should disable it as soon as it is no longer needed.
   */
  public get continuousRendering(): boolean { return this._doContinuousRendering; }
  public set continuousRendering(contRend: boolean) {
    if (contRend !== this._doContinuousRendering) {
      this._doContinuousRendering = contRend;
      if (contRend)
        IModelApp.requestNextAnimation();
    }
  }

  /** A unique integer Id assigned to this Viewport upon construction.
   * It can be useful for comparing and sorting Viewport objects inside of collections like [SortedArray]($core-bentley).
   */
  public get viewportId(): number {
    return this._viewportId;
  }

  /** The ViewState for this Viewport */
  public get view(): ViewState {
    return this._view;
  }

  /** @internal */
  public get pixelsPerInch() {
    // ###TODO? This is apparently unobtainable information in a browser...
    return 96;
  }

  /** @internal */
  public get backgroundMapGeometry(): BackgroundMapGeometry | undefined { return this.view.displayStyle.getBackgroundMapGeometry(); }

  /** Ids of a set of elements which should not be rendered within this view.
   * @note Do not modify this set directly - use [[setNeverDrawn]] or [[clearNeverDrawn]] instead.
   * @note This set takes precedence over the [[alwaysDrawn]] set - if an element is present in both sets, it is never drawn.
   */
  public get neverDrawn(): Id64Set | undefined { return this._neverDrawn; }

  /** Ids of a set of elements which should always be rendered within this view, regardless of category and subcategory visibility.
   * If the [[isAlwaysDrawnExclusive]] flag is also set, *only* those elements in this set will be drawn.
   * @note Do not modify this set directly - use [[setAlwaysDrawn]] or [[clearAlwaysDrawn]] instead.
   * @note The [[neverDrawn]] set takes precedence - if an element is present in both sets, it is never drawn.
   */
  public get alwaysDrawn(): Id64Set | undefined { return this._alwaysDrawn; }

  /** Clear the set of always-drawn elements.
   * @see [[alwaysDrawn]]
   */
  public clearAlwaysDrawn(): void {
    if ((undefined !== this.alwaysDrawn && 0 < this.alwaysDrawn.size) || this._alwaysDrawnExclusive) {
      if (undefined !== this.alwaysDrawn)
        this.alwaysDrawn.clear();

      this._alwaysDrawnExclusive = false;
      this._changeFlags.setAlwaysDrawn();
      this.maybeInvalidateScene();
    }
  }

  /** Clear the set of never-drawn elements.
   * @see [[neverDrawn]]
   */
  public clearNeverDrawn(): void {
    if (undefined !== this.neverDrawn && 0 < this.neverDrawn.size) {
      this.neverDrawn.clear();
      this._changeFlags.setNeverDrawn();
      this.maybeInvalidateScene();
    }
  }

  /** Specify the Ids of a set of elements which should never be rendered within this view.
   * @see [[neverDrawn]].
   */
  public setNeverDrawn(ids: Id64Set): void {
    this._neverDrawn = ids;
    this._changeFlags.setNeverDrawn();
    this.maybeInvalidateScene();
  }

  /** Specify the Ids of a set of elements which should always be rendered within this view, regardless of category and subcategory visibility.
   * @param ids The Ids of the elements to always draw.
   * @param exclusive If true, *only* the specified elements will be drawn.
   * @see [[alwaysDrawn]]
   * @see [[isAlwaysDrawnExclusive]]
   */
  public setAlwaysDrawn(ids: Id64Set, exclusive: boolean = false): void {
    this._alwaysDrawn = ids;
    this._alwaysDrawnExclusive = exclusive;
    this._changeFlags.setAlwaysDrawn();
    this.maybeInvalidateScene();
  }

  /** Returns true if the set of elements in the [[alwaysDrawn]] set are the *only* elements rendered within this view. */
  public get isAlwaysDrawnExclusive(): boolean { return this._alwaysDrawnExclusive; }

  /** Allows visibility of categories within this viewport to be overridden on a per-model basis. */
  public get perModelCategoryVisibility(): PerModelCategoryVisibility.Overrides { return this._perModelCategoryVisibility; }

  /** Adds visibility overrides for any subcategories whose visibility differs from that defined by the view's
   * category selector in the context of specific models.
   * @internal
   */
  public addModelSubCategoryVisibilityOverrides(fs: FeatureSymbology.Overrides, ovrs: Id64.Uint32Map<Id64.Uint32Set>): void {
    this._perModelCategoryVisibility.addOverrides(fs, ovrs);
  }

  /** Add a [[FeatureOverrideProvider]] to customize the appearance of [[Feature]]s within the viewport.
   * The provider will be invoked whenever the overrides are determined to need updating.
   * The overrides can be explicitly marked as needing a refresh by calling [[Viewport.setFeatureOverrideProviderChanged]]. This is typically called when
   * the internal state of the provider changes such that the computed overrides must also change.
   * @note A Viewport can have any number of FeatureOverrideProviders. No attempt is made to resolve conflicts between two different providers overriding the same Feature.
   * @param provider The provider to register.
   * @returns true if the provider was registered, or false if the provider was already registered.
   * @see [[dropFeatureOverrideProvider]] to remove the provider.
   * @see [[findFeatureOverrideProvider]] to find an existing provider.
   * @see [[FeatureSymbology.Overrides]].
   */
  public addFeatureOverrideProvider(provider: FeatureOverrideProvider): boolean {
    if (this._featureOverrideProviders.includes(provider))
      return false;

    this._featureOverrideProviders.push(provider);
    this.setFeatureOverrideProviderChanged();
    return true;
  }

  /** Removes the specified FeatureOverrideProvider from the viewport.
   * @param provider The provider to drop.
   * @returns true if the provider was dropped, or false if it was not registered.
   * @see [[addFeatureOverrideProvider]].
   */
  public dropFeatureOverrideProvider(provider: FeatureOverrideProvider): boolean {
    const index = this._featureOverrideProviders.indexOf(provider);
    if (-1 === index)
      return false;

    this._featureOverrideProviders.splice(index, 1);
    this.setFeatureOverrideProviderChanged();
    return true;
  }

  /** Locate the first registered FeatureOverrideProvider matching the supplied criterion.
   * @param predicate A function that will be invoked for each provider currently registered with the viewport, returning true to accept the provider.
   * @returns The first registered provider that matches the predicate, or undefined if no providers match the predicate.
   * @see [[findFeatureOverrideProviderOfType]] to locate a provider of a specific class.
   * @see [[addFeatureOverrideProvider]] to register a provider.
   */
  public findFeatureOverrideProvider(predicate: (provider: FeatureOverrideProvider) => boolean): FeatureOverrideProvider | undefined {
    for (const provider of this._featureOverrideProviders)
      if (predicate(provider))
        return provider;

    return undefined;
  }

  /** The list of [[FeatureOverrideProvider]]s registered with this viewport.
   * @see [[addFeatureOverrideProvider]] to register a new provider.
   * @see [[dropFeatureOverrideProvider]] to unregister a provider.
   * @see [[findFeatureOverrideProvider]] or [[findFeatureOverrideProviderOfType]] to find a registered provider.
   */
  public get featureOverrideProviders(): Iterable<FeatureOverrideProvider> {
    return this._featureOverrideProviders;
  }

  /** Locate the first registered FeatureOverrideProvider of the specified class. For example, to locate a registered [[EmphasizeElements]] provider:
   * ```ts
   * const provider: EmphasizeElements = viewport.findFeatureOverrideProviderOfType<EmphasizeElements>(EmphasizeElements);
   * ```
   * @see [[findFeatureOverrideProvider]] to locate a registered provider matching any arbitrary criterion.
   */
  public findFeatureOverrideProviderOfType<T>(type: Constructor<T>): T | undefined {
    const provider = this.findFeatureOverrideProvider((x) => isInstanceOf<T>(x, type));
    return asInstanceOf<T>(provider, type);
  }

  /** @internal */
  public addFeatureOverrides(ovrs: FeatureSymbology.Overrides): void {
    for (const provider of this._featureOverrideProviders)
      provider.addFeatureOverrides(ovrs, this);
  }

  /** Notifies this viewport that the internal state of its [[FeatureOverrideProvider]] has changed such that its
   * [[FeatureSymbology.Overrides]] should be recomputed.
   */
  public setFeatureOverrideProviderChanged(): void {
    this._changeFlags.setFeatureOverrideProvider();
    this.maybeInvalidateScene();
  }

  /** Notifies this viewport that a change in application state requires its [[FeatureSymbology.Overrides]] to be recomputed.
   * @note The viewport monitors various events to automatically detect when the overrides should be recomputed. This method
   * is only needed for changes that are not observable by the viewport itself.
   */
  public invalidateSymbologyOverrides(): void {
    this.setFeatureOverrideProviderChanged();
  }

  /** The [[TiledGraphicsProvider]]s currently registered with this viewport.
   * @see [[addTiledGraphicsProvider]].
   */
  public get tiledGraphicsProviders(): Iterable<TiledGraphicsProvider> {
    return this._tiledGraphicsProviders;
  }

  /** @internal */
  protected * tiledGraphicsProviderRefs(): Iterable<TileTreeReference> {
    for (const provider of this.tiledGraphicsProviders) {
      yield * TiledGraphicsProvider.getTileTreeRefs(provider, this);
    }
  }

  /** Apply a function to every tile tree reference associated with the map layers displayed by this viewport.
   * @deprecated in 5.0 - will not be removed until after 2026-06-13. Use [[mapTileTreeRefs]] instead.
   */
  public forEachMapTreeRef(func: (ref: TileTreeReference) => void): void {
    if (this._mapTiledGraphicsProvider)
      this._mapTiledGraphicsProvider.forEachTileTreeRef(this, (ref) => func(ref));
  }

  /** Obtain an iterator over the tile tree references used to render map imagery in this viewport, if any. */
  public get mapTileTreeRefs(): Iterable<TileTreeReference> {
    return this._mapTiledGraphicsProvider?.getReferences(this) ?? [];
  };


  /** Apply a function to every [[TileTreeReference]] displayed by this viewport.
   * @deprecated in 5.0 - will not be removed until after 2026-06-13. Use [[getTileTreeRefs]] instead.
   */
  public forEachTileTreeRef(func: (ref: TileTreeReference) => void): void {
    for (const ref of this.getTileTreeRefs()) {
      func(ref);
    }
  }

  /** Iterate over every [[TileTreeReference]] displayed by this viewport. */
  public * getTileTreeRefs(): Iterable<TileTreeReference> {
    yield * this.view.getTileTreeRefs();
    yield * this.mapTileTreeRefs;
    yield * this.tiledGraphicsProviderRefs();
  }

  /**
   * Returns true if all [[TileTree]]s required by this viewport have been loaded.
   */
  public get areAllTileTreesLoaded(): boolean {
    if (!this.view.areAllTileTreesLoaded)
      return false;

    if (this._mapTiledGraphicsProvider && !TiledGraphicsProvider.isLoadingComplete(this._mapTiledGraphicsProvider, this))
      return false;

    for (const provider of this._tiledGraphicsProviders)
      if (!TiledGraphicsProvider.isLoadingComplete(provider, this))
        return false;

    return true;
  }

  /** Disclose *all* TileTrees currently in use by this Viewport. This set may include trees not reported by [[forEachTileTreeRef]] - e.g., those used by view attachments, map-draped terrain, etc.
   * @internal
   */
  public discloseTileTrees(trees: DisclosedTileTreeSet): void {
    for (const ref of this.tiledGraphicsProviderRefs()) {
      trees.disclose(ref);
    }

    for (const ref of this.mapTileTreeRefs) {
      trees.disclose(ref);
    }

    trees.disclose(this.view);
  }

  /** Register a provider of tile graphics to be drawn in this viewport.
   * @see [[dropTiledGraphicsProvider]]
   */
  public addTiledGraphicsProvider(provider: TiledGraphicsProvider): void {
    this._tiledGraphicsProviders.add(provider);
    this.invalidateScene();
  }

  /** Remove a previously-registered provider of tile graphics.
   * @see [[addTiledGraphicsProvider]]
   */
  public dropTiledGraphicsProvider(provider: TiledGraphicsProvider): void {
    this._tiledGraphicsProviders.delete(provider);
    this.invalidateScene();
  }

  /** Returns true if the specified provider has been registered with this viewport via [[addTiledGraphicsProvider]]. */
  public hasTiledGraphicsProvider(provider: TiledGraphicsProvider): boolean {
    return this._tiledGraphicsProviders.has(provider);
  }

  /** @internal */
  public mapLayerFromHit(hit: HitDetail): MapLayerInfoFromTileTree[] {
    return undefined === hit.modelId ? [] : this.mapLayerFromIds(hit.modelId, hit.sourceId);
  }

  /** @internal */
  public mapLayerFromIds(mapTreeId: Id64String, layerTreeId: Id64String): MapLayerInfoFromTileTree[] {
    return this._mapTiledGraphicsProvider === undefined ? [] : this._mapTiledGraphicsProvider.mapLayerFromIds(mapTreeId, layerTreeId);
  }

  /** @internal */
  public getTerrainHeightRange(): Range1d {
    const heightRange = Range1d.createNull();

    for (const ref of this.mapTileTreeRefs) {
      ref.getTerrainHeight(heightRange);
    }

    return heightRange;
  }

  /** @internal */
  public setViewedCategoriesPerModelChanged(): void {
    this._changeFlags.setViewedCategoriesPerModel();
  }

  /** @internal */
  public markSelectionSetDirty() { this._selectionSetDirty = true; }

  /** True if this is a 3d view with the camera turned on. */
  public get isCameraOn(): boolean {
    return this.view.is3d() && this.view.isCameraOn;
  }

  /** @internal */
  public changeDynamics(dynamics: GraphicList | undefined, overlay: GraphicList | undefined): void {
    this.target.changeDynamics(dynamics, overlay);
    this.invalidateDecorations();
  }

  private _assigningFlashedId = false;

  /** The Id of the currently-flashed object.
   * The "flashed" visual effect is typically applied to the object in the viewport currently under the mouse cursor, to indicate
   * it is ready to be interacted with by a tool. [[ToolAdmin]] is responsible for updating it when the mouse cursor moves.
   * The object is usually an [Element]($backend) but could also be a [Model]($backend) or pickable decoration produced by a [[Decorator]].
   * The setter ignores any string that is not a well-formed [Id64String]($core-bentley). Passing [Id64.invalid]($core-bentley) to the
   * setter is equivalent to passing `undefined` - both mean "nothing is flashed".
   * @throws Error if an attempt is made to change this property from within an [[onFlashedIdChanged]] event callback.
   * @see [[onFlashedIdChanged]] to be notified when the flashed object changes.
   * @see [[flashSettings]] to customize the visual effect.
   */
  public get flashedId(): Id64String | undefined {
    return this._flashedElem;
  }
  public set flashedId(id: Id64String | undefined) {
    if (this._assigningFlashedId)
      throw new Error("Cannot assign to Viewport.flashedId from within an onFlashedIdChanged event callback.");

    if (id === Id64.invalid)
      id = undefined;

    const previous = this._flashedElem;
    if (id === previous || (undefined !== id && !Id64.isId64(id)))
      return;

    this._lastFlashedElem = this._flashedElem;
    this._flashedElem = id;

    this._assigningFlashedId = true;
    try {
      // The comparison `id !== previous` above ensures the following assertion, but the compiler doesn't recognize it.
      assert(undefined !== id || undefined !== previous);
      this.onFlashedIdChanged.raiseEvent(this, { current: id!, previous });
    } finally {
      this._assigningFlashedId = false;
    }
  }

  public get auxCoordSystem(): AuxCoordSystemState { return this.view.auxiliaryCoordinateSystem; }
  public getAuxCoordRotation(result?: Matrix3d) { return this.auxCoordSystem.getRotation(result); }
  public getAuxCoordOrigin(result?: Point3d) { return this.auxCoordSystem.getOrigin(result); }

  /** The number of outstanding requests for tiles to be displayed in this viewport.
   * @see Viewport.numSelectedTiles
   */
  public get numRequestedTiles(): number { return IModelApp.tileAdmin.getNumRequestsForUser(this); }

  /** The number of tiles selected for display in the view as of the most recently-drawn frame.
   * The tiles selected may not meet the desired level-of-detail for the view, instead being temporarily drawn while
   * tiles of more appropriate level-of-detail are loaded asynchronously.
   * @see Viewport.numRequestedTiles
   * @see Viewport.numReadyTiles
   */
  public get numSelectedTiles(): number {
    const tiles = IModelApp.tileAdmin.getTilesForUser(this);
    return undefined !== tiles ? tiles.selected.size + tiles.external.selected : 0;
  }

  /** The number of tiles which were ready and met the desired level-of-detail for display in the view as of the most recently-drawn frame.
   * These tiles may *not* have been selected because some other (probably sibling) tiles were *not* ready for display.
   * This is a useful metric for determining how "complete" the view is - e.g., one indicator of progress toward view completion can be expressed as:
   * `  (numReadyTiles) / (numReadyTiles + numRequestedTiles)`
   * @see Viewport.numSelectedTiles
   * @see Viewport.numRequestedTiles
   */
  public get numReadyTiles(): number {
    const tiles = IModelApp.tileAdmin.getTilesForUser(this);
    return undefined !== tiles ? tiles.ready.size + tiles.external.ready : 0;
  }

  /** @internal */
  public toViewOrientation(from: XYZ, to?: XYZ) { this._viewingSpace.toViewOrientation(from, to); }
  /** @internal */
  public fromViewOrientation(from: XYZ, to?: XYZ) { this._viewingSpace.fromViewOrientation(from, to); }

  /** Change the ViewState of this Viewport
   * @param view a fully loaded (see discussion at [[ViewState.load]] ) ViewState
   * @param _opts options for how the view change operation should work
   */
  public changeView(view: ViewState, _opts?: ViewChangeOptions) {
    const prevView = this.view;

    this.updateChangeFlags(view);
    this.doSetupFromView(view);
    this.invalidateController();

    const isMapLayerChanged = undefined !== prevView && compareMapLayer(prevView, view);
    this.target.reset(isMapLayerChanged); // Handle Reality Map Tile Map Layer changes & update logic

    if (undefined !== prevView && prevView !== view) {
      this.onChangeView.raiseEvent(this, prevView);
      this._changeFlags.setViewState();
    }
  }

  /** Determine whether the supplied point is visible in the viewport rectangle.
   * @param point the point to test
   * @param coordSys the coordinate system of the specified point
   * @param borderPaddingFactor optional border for testing with inset view rectangle.
   */
  public isPointVisibleXY(point: Point3d, coordSys: CoordSystem = CoordSystem.World, borderPaddingFactor: number = 0.0): boolean {
    let testPtView = point;
    switch (coordSys) {
      case CoordSystem.Npc:
        testPtView = this.npcToView(point);
        break;
      case CoordSystem.World:
        testPtView = this.worldToView(point);
        break;
    }

    const frustum = this.getFrustum(CoordSystem.View);
    const screenRangeX = frustum.points[Npc._000].distance(frustum.points[Npc._100]);
    const screenRangeY = frustum.points[Npc._000].distance(frustum.points[Npc._010]);
    const xBorder = screenRangeX * borderPaddingFactor;
    const yBorder = screenRangeY * borderPaddingFactor;

    return (!(testPtView.x < xBorder || testPtView.x > (screenRangeX - xBorder) || testPtView.y < yBorder || testPtView.y > (screenRangeY - yBorder)));
  }

  /** Computes the range of npc depth values for a region of the screen
   * @param rect the rectangle to test. If undefined, test entire view
   * @param result optional DepthRangeNpc to store the result
   * @returns the minimum and maximum depth values within the region, or undefined.
   */
  public determineVisibleDepthRange(rect?: ViewRect, result?: DepthRangeNpc): DepthRangeNpc | undefined {
    if (result) { // Null result if given
      result.minimum = 1;
      result.maximum = 0;
    }

    // Default to a (0, 0, 0) to (1, 1, 1) range if no range was provided
    rect = (rect && rect.isValid) ? rect : this.viewRect;

    // Determine the screen rectangle in which to query visible depth min + max
    const readRect = rect.computeOverlap(this.viewRect);
    if (undefined === readRect)
      return undefined;

    let retVal: DepthRangeNpc | undefined;
    this.readPixels(readRect, Pixel.Selector.GeometryAndDistance, (pixels) => {
      if (!pixels)
        return;

      readRect.left = this.cssPixelsToDevicePixels(readRect.left);
      readRect.right = this.cssPixelsToDevicePixels(readRect.right);
      readRect.bottom = this.cssPixelsToDevicePixels(readRect.bottom);
      readRect.top = this.cssPixelsToDevicePixels(readRect.top);

      let maximum = 0;
      let minimum = 1;
      const frac = this._viewingSpace.frustFraction;
      for (let x = readRect.left; x < readRect.right; ++x) {
        for (let y = readRect.top; y < readRect.bottom; ++y) {
          let npcZ = pixels.getPixel(x, y).distanceFraction;
          if (npcZ <= 0.0)
            continue;

          if (frac < 1.0)
            npcZ *= frac / (1.0 + npcZ * (frac - 1.0));

          minimum = Math.min(minimum, npcZ);
          maximum = Math.max(maximum, npcZ);
        }
      }

      if (maximum <= 0)
        return;

      if (undefined === result) {
        result = { minimum, maximum };
      } else {
        result.minimum = minimum;
        result.maximum = maximum;
      }

      retVal = result;
    });

    return retVal;
  }

  /** Turn the camera off it is currently on.
   * @see [[turnCameraOn]] to turn the camera on.
   */
  public turnCameraOff(): void {
    if (this.view.is3d() && this.view.isCameraOn) {
      this.view.turnCameraOff();
      this.setupFromView();
    }
  }

  /** Turn the camera on if it is currently off. If the camera is already on, adjust it to use the supplied lens angle.
   * @param lensAngle The lens angle for the camera. If undefined, use view.camera.lens.
   * @note This method will fail if the ViewState is not 3d.
   * @see [[turnCameraOff]] to turn the camera off.
   */
  public turnCameraOn(lensAngle?: Angle): ViewStatus {
    const view = this.view;
    if (!view.is3d() || !view.supportsCamera())
      return ViewStatus.InvalidViewport;

    if (!lensAngle)
      lensAngle = view.camera.lens;

    Camera.validateLensAngle(lensAngle);

    let status;
    if (view.isCameraOn) {
      status = view.lookAt({ eyePoint: view.getEyePoint(), targetPoint: view.getTargetPoint(), upVector: view.getYVector(), lensAngle });
    } else {
      // We need to figure out a new camera target. To do that, we need to know where the geometry is in the view.
      // We use the depth of the center of the view for that.
      let depthRange = this.determineVisibleDepthRange();
      if (undefined === depthRange || Geometry.isAlmostEqualNumber(depthRange.minimum, depthRange.maximum))
        depthRange = { minimum: 0, maximum: 1 };

      const middle = depthRange.minimum + ((depthRange.maximum - depthRange.minimum) / 2.0);
      const corners = [
        new Point3d(0.0, 0.0, middle), // lower left, at target depth
        new Point3d(1.0, 1.0, middle), // upper right at target depth
        new Point3d(0.0, 0.0, depthRange.maximum), // lower left, at closest npc
        new Point3d(1.0, 1.0, depthRange.maximum), // upper right at closest
      ];

      this.npcToWorldArray(corners);

      const eyePoint = corners[2].interpolate(0.5, corners[3]); // middle of closest plane
      const targetPoint = corners[0].interpolate(0.5, corners[1]); // middle of halfway plane
      const backDistance = eyePoint.distance(targetPoint) * 2.0;
      const frontDistance = view.minimumFrontDistance();
      status = view.lookAt({ eyePoint, targetPoint, upVector: view.getYVector(), lensAngle, frontDistance, backDistance });
    }

    if (ViewStatus.Success === status)
      this.setupFromView();

    return status;
  }

  /** Orient this viewport to one of the [[StandardView]] rotations. */
  public setStandardRotation(id: StandardViewId): void {
    this.view.setStandardRotation(id);
    this.setupFromView();
  }

  private doSetupFromView(view: ViewState) {
    if (this._inViewChangedEvent)
      return ViewStatus.Success; // ignore echos

    if (!this.isAspectRatioLocked)
      view.fixAspectRatio(this.viewRect.aspect);

    this.setView(view);

    const viewSpace = ViewingSpace.createFromViewport(this);
    if (undefined === viewSpace)
      return ViewStatus.InvalidViewport;

    this._viewingSpace = viewSpace;

    this.invalidateRenderPlan();
    this._controllerValid = true;

    this._inViewChangedEvent = true;
    this.onViewChanged.raiseEvent(this);
    this._inViewChangedEvent = false;
    return ViewStatus.Success;
  }

  /** Establish the parameters of this Viewport from the current information in its ViewState */
  public setupFromView(pose?: ViewPose): ViewStatus {
    if (undefined !== pose)
      this.view.applyPose(pose);
    return this.doSetupFromView(this.view);
  }

  /** Call [[setupFromView]] on this Viewport and then apply optional behavior.
   * @param options _options for behavior of view change. If undefined, all options have their default values (see [[ViewChangeOptions]] for details.)
   */
  public synchWithView(_options?: ViewChangeOptions): void { this.setupFromView(); }

  /** Convert an array of points from CoordSystem.View to CoordSystem.Npc */
  public viewToNpcArray(pts: Point3d[]): void { this._viewingSpace.viewToNpcArray(pts); }
  /** Convert an array of points from CoordSystem.Npc to CoordSystem.View */
  public npcToViewArray(pts: Point3d[]): void { this._viewingSpace.npcToViewArray(pts); }
  /** Convert a point from CoordSystem.View to CoordSystem.Npc
   * @param pt the point to convert
   * @param out optional location for result. If undefined, a new Point3d is created.
   */
  public viewToNpc(pt: Point3d, out?: Point3d): Point3d { return this._viewingSpace.viewToNpc(pt, out); }
  /** Convert a point from CoordSystem.Npc to CoordSystem.View
   * @param pt the point to convert
   * @param out optional location for result. If undefined, a new Point3d is created.
   */
  public npcToView(pt: Point3d, out?: Point3d): Point3d { return this._viewingSpace.npcToView(pt, out); }
  /** Convert an array of points from CoordSystem.World to CoordSystem.Npc */
  public worldToNpcArray(pts: Point3d[]): void { this._viewingSpace.worldToNpcArray(pts); }
  /** Convert an array of points from CoordSystem.Npc to CoordSystem.World */
  public npcToWorldArray(pts: Point3d[]): void { this._viewingSpace.npcToWorldArray(pts); }
  /** Convert an array of points from CoordSystem.World to CoordSystem.View */
  public worldToViewArray(pts: Point3d[]): void { this._viewingSpace.worldToViewArray(pts); }
  /** Convert an array of points from CoordSystem.World to CoordSystem.View, as Point4ds */
  public worldToView4dArray(worldPts: Point3d[], viewPts: Point4d[]): void { this._viewingSpace.worldToView4dArray(worldPts, viewPts); }
  /** Convert an array of points from CoordSystem.View to CoordSystem.World */
  public viewToWorldArray(pts: Point3d[]) { this._viewingSpace.viewToWorldArray(pts); }
  /** Convert an array of points from CoordSystem.View as Point4ds to CoordSystem.World */
  public view4dToWorldArray(viewPts: Point4d[], worldPts: Point3d[]): void { this._viewingSpace.view4dToWorldArray(viewPts, worldPts); }
  /** Convert a point from CoordSystem.World to CoordSystem.Npc
   * @param pt the point to convert
   * @param out optional location for result. If undefined, a new Point3d is created.
   */
  public worldToNpc(pt: XYAndZ, out?: Point3d): Point3d { return this._viewingSpace.worldToNpc(pt, out); }
  /** Convert a point from CoordSystem.Npc to CoordSystem.World
   * @param pt the point to convert
   * @param out optional location for result. If undefined, a new Point3d is created.
   */
  public npcToWorld(pt: XYAndZ, out?: Point3d): Point3d { return this._viewingSpace.npcToWorld(pt, out); }
  /** Convert a point from CoordSystem.World to CoordSystem.View
   * @param pt the point to convert
   * @param out optional location for result. If undefined, a new Point3d is created.
   */
  public worldToView(input: XYAndZ, out?: Point3d): Point3d { return this._viewingSpace.worldToView(input, out); }
  /** Convert a point from CoordSystem.World to CoordSystem.View as Point4d
   * @param input the point to convert
   * @param out optional location for result. If undefined, a new Point4d is created.
   */
  public worldToView4d(input: XYAndZ, out?: Point4d): Point4d { return this._viewingSpace.worldToView4d(input, out); }
  /** Convert a point from CoordSystem.View to CoordSystem.World
   * @param pt the point to convert
   * @param out optional location for result. If undefined, a new Point3d is created.
   */
  public viewToWorld(input: XYAndZ, out?: Point3d): Point3d { return this._viewingSpace.viewToWorld(input, out); }
  /** Convert a point from CoordSystem.View as a Point4d to CoordSystem.View
   * @param input the point to convert
   * @param out optional location for result. If undefined, a new Point3d is created.
   */
  public view4dToWorld(input: Point4d, out?: Point3d): Point3d { return this._viewingSpace.view4dToWorld(input, out); }

  /** Converts inches to pixels based on screen DPI.
   * @Note this information may not be accurate in some browsers.
   * @param inches the number of inches to convert
   * @returns the corresponding number of pixels
   */
  public pixelsFromInches(inches: number): number { return inches * this.pixelsPerInch; }

  /** Get an 8-point Frustum corresponding to the 8 corners of the Viewport in the specified coordinate system.
   *
   * There are two sets of corners that may be of interest.
   * The "adjusted" box is the one that is computed by examining the "viewed extents" and moving
   * the front and back planes to enclose everything in the view.
   * The "unadjusted" box is the one that is stored in the ViewState.
   * @param sys Coordinate system for points
   * @param adjustedBox If true, retrieve the adjusted box. Otherwise retrieve the box that came from the view definition.
   * @param box optional Frustum for return value
   * @return the view frustum
   * @note The "adjusted" box may be either larger or smaller than the "unadjusted" box.
   */
  public getFrustum(sys: CoordSystem = CoordSystem.World, adjustedBox: boolean = true, box?: Frustum): Frustum { return this._viewingSpace.getFrustum(sys, adjustedBox, box); }

  /** Get a copy of the current (unadjusted) frustum of this viewport, in world coordinates. */
  public getWorldFrustum(box?: Frustum): Frustum { return this.getFrustum(CoordSystem.World, false, box); }

  /** Scroll the view by a given number of pixels.
   * @param screenDist distance to scroll, in pixels
   */
  public scroll(screenDist: XAndY, options?: ViewChangeOptions) {
    const view = this.view;
    if (!view)
      return;

    const distXYZ = new Point3d(screenDist.x, screenDist.y, 0);
    if (view.is3d() && view.isCameraOn) {
      const frust = this.getFrustum(CoordSystem.View, false);
      frust.translate(distXYZ);
      this.viewToWorldArray(frust.points);
      view.setupFromFrustum(frust);
      view.centerEyePoint();
    } else {
      const pts = [new Point3d(), distXYZ];
      this.viewToWorldArray(pts);
      const dist = pts[1].minus(pts[0]);
      view.setOrigin(view.getOrigin().plus(dist));
    }

    this.synchWithView(options);
  }

  /** Zoom the view by a scale factor, placing the new center at the given point (world coordinates).
   * @param newCenter The new center point of the view, in world coordinates. If undefined, use current center.
   * @param factor the zoom factor.
   * @param options options for behavior of view change
   */
  public zoom(newCenter: Point3d | undefined, factor: number, options?: ViewChangeOptions & MarginOptions & OnViewExtentsError): ViewStatus {
    const view = this.view;
    if (undefined === view)
      return ViewStatus.InvalidViewport;

    if (view.is3d() && view.isCameraOn) {
      const eyePoint = view.getEyePoint().clone();
      const targetPoint = view.getTargetPoint();

      if (newCenter) {
        const dir = eyePoint.vectorTo(targetPoint);
        newCenter.plusScaled(dir, -0.5, eyePoint);
        newCenter.plusScaled(dir, 0.5, targetPoint);
      }

      const transform = Transform.createFixedPointAndMatrix(targetPoint, Matrix3d.createScale(factor, factor, factor));
      const zDir = view.getZVector();

      transform.multiplyPoint3d(eyePoint, eyePoint);
      targetPoint.setFrom(eyePoint.plusScaled(zDir, zDir.dotProduct(eyePoint.vectorTo(targetPoint))));

      const status = view.lookAt({ eyePoint, targetPoint, upVector: view.getYVector(), lensAngle: view.camera.lens });
      if (ViewStatus.Success !== status)
        return status;
    } else {
      // for non-camera views, do the zooming by adjusting the origin and delta directly so there can be no
      // chance of the rotation changing due to numerical precision errors calculating it from the frustum corners.
      const delta = view.getExtents().scale(factor);

      const rot = view.getRotation();
      const center = rot.multiplyVector(newCenter ? newCenter : view.getCenter());

      // fix for min/max delta
      const stat = view.adjustViewDelta(delta, center, rot, this.viewRect.aspect, options);
      if (ViewStatus.Success !== stat)
        return stat;

      if (!view.allow3dManipulations())
        center.z = 0.0;

      view.setOrigin(rot.multiplyTransposeVector(delta.scale(.5).vectorTo(center)));
      view.setExtents(delta);
    }

    this.synchWithView(options);
    return ViewStatus.Success;
  }

  /** See [[zoomToPlacements]]. */
  public zoomToPlacementProps(placementProps: PlacementProps[], options?: ViewChangeOptions & MarginOptions & ZoomToOptions): void {
    const placements = placementProps.map((props) => isPlacement2dProps(props) ? Placement2d.fromJSON(props) : Placement3d.fromJSON(props));
    this.zoomToPlacements(placements, options);
  }

  /** Zoom the view in or out to a fit to the tightest volume enclosing a given set of placements, optionally also changing the view rotation.
   * @param placements The array of placements. The view will zoom to fit the union of the placements.
   * @param options Options controlling how the view change works and whether to change view rotation.
   * @note any invalid placements are ignored. If no valid placements are supplied, this function does nothing.
   * @see [[zoomToElements]] to zoom to a set of elements.
   * @see [[IModelConnection.Elements.getPlacements]] to obtain the placements for a set of elements.
   */
  public zoomToPlacements(placements: Placement[], options?: ViewChangeOptions & MarginOptions & ZoomToOptions): void {
    placements = placements.filter((x) => x.isValid);
    if (placements.length === 0)
      return;

    const view = this.view;
    if (undefined !== options) {
      if (undefined !== options.standardViewId) {
        view.setStandardRotation(options.standardViewId);
      } else if (undefined !== options.placementRelativeId) {
        const viewRotation = StandardView.getStandardRotation(options.placementRelativeId).clone();
        viewRotation.multiplyMatrixMatrixTranspose(placements[0].transform.matrix, viewRotation);
        view.setRotation(viewRotation);
      } else if (undefined !== options.viewRotation) {
        view.setRotation(options.viewRotation);
      }
    }

    const viewTransform = Transform.createOriginAndMatrix(undefined, view.getRotation());
    const frust = new Frustum();
    const viewRange = new Range3d();
    for (const placement of placements)
      viewRange.extendArray(placement.getWorldCorners(frust).points, viewTransform);

    const ignoreError: ViewChangeOptions & MarginOptions & OnViewExtentsError = {
      ...options,
      onExtentsError: () => ViewStatus.Success,
    };

    view.lookAtViewAlignedVolume(viewRange, this.viewRect.aspect, ignoreError);
    this.synchWithView(options);
  }

  /** Zoom the view to a show the tightest box around a given set of ElementProps. Optionally, change view rotation.
   * @param props element props. Will zoom to the union of the placements.
   * @param options options that control how the view change works and whether to change view rotation.
   * @note Do not query for ElementProps just to zoom to their placements - [[zoomToElements]] is much more efficient because it queries only for the placement properties.
   */
  public zoomToElementProps(elementProps: ElementProps[], options?: ViewChangeOptions & MarginOptions & ZoomToOptions): void {
    if (elementProps.length === 0)
      return;

    const placementProps: PlacementProps[] = [];
    for (const props of elementProps) {
      const placement = (props as any).placement;
      if (placement !== undefined && this.view.viewsModel(props.model))
        placementProps.push(placement);
    }

    this.zoomToPlacementProps(placementProps, options);
  }

  /** Zoom the view to a show the tightest box around a given set of elements. Optionally, change view rotation.
   * @param ids the element id(s) to include. Will zoom to the union of the placements.
   * @param options options that control how the view change works and whether to change view rotation.
   */
  public async zoomToElements(ids: Id64Arg, options?: ViewChangeOptions & MarginOptions & ZoomToOptions): Promise<void> {
    const placements = await this.iModel.elements.getPlacements(ids, { type: this.view.is3d() ? "3d" : "2d" });
    if (undefined !== options?.minimumDimension) {
      for (const placement of placements) {
        if (placement.isValid && placement instanceof Placement3d)
          placement.bbox.ensureMinLengths(options.minimumDimension);
      }
    }
    this.zoomToPlacements(placements, options);
  }

  /** Zoom the view to a volume of space in world coordinates.
   * @param volume The low and high corners, in world coordinates.
   * @param options options that control how the view change works
   */
  public zoomToVolume(volume: LowAndHighXYZ | LowAndHighXY, options?: ViewChangeOptions & MarginOptions) {
    this.view.lookAtVolume(volume, this.viewRect.aspect, options);
    this.synchWithView(options);
  }

  /** Shortcut to call view.setupFromFrustum and then [[setupFromView]]
   * @param inFrustum the new viewing frustum
   * @returns true if both steps were successful
   */
  public setupViewFromFrustum(inFrustum: Frustum): boolean {
    const validSize = this.view.setupFromFrustum(inFrustum);
    // note: always call setupFromView, even if setupFromFrustum failed
    return (ViewStatus.Success === this.setupFromView() && ViewStatus.Success === validSize);
  }

  /** Compute the range of all geometry to be displayed in this viewport. */
  public computeViewRange(): Range3d {
    const fitRange = this.view.computeFitRange();

    for (const ref of this.tiledGraphicsProviderRefs()) {
      ref.unionFitRange(fitRange);
    }

    return fitRange;
  }

  /** Set or clear the animator for this Viewport.
   * @param animator The new animator for this Viewport, or undefined to remove current animator.
   * @note current animator's `interrupt` method will be called (if it has not completed yet)
   * @public
   */
  public setAnimator(animator?: Animator) {
    this._animator?.interrupt();
    this._animator = animator;

    // Immediately invoke the animator to set up the initial frustum.
    // This is important for TwoWayViewportSync; otherwise, the synced viewport will have its frustum set to the final frustum,
    // producing a flicker to that frustum during the first frame of animation.
    this.animate();
  }

  /** Replace this viewport's [[ViewState]] **without** triggering events like [[onChangeView]].
   * This is chiefly useful when you are synchronizing the states of two or more viewports, as in [[TwoWayViewportSync]], to avoid triggering unwanted "echo"
   * events during synchronization.
   * In all other scenarios, [[changeView]] is the correct method to use.
   */
  public applyViewState(val: ViewState) {
    this.updateChangeFlags(val);
    this.setView(val);
    this._viewingSpace.view = val;
    this.synchWithView({ noSaveInUndo: true });
  }

  /** Invoked from finishUndoRedo, applyViewState, and changeView to potentially recompute change flags based on differences between current and new ViewState. */
  protected updateChangeFlags(newView: ViewState): void {
    // Before the first call to changeView, this.view is undefined because we have no frustum. Our API pretends it is never undefined.
    const oldView = undefined !== this.viewingSpace ? this.view : undefined;

    if (undefined === oldView || oldView === newView)
      return;

    const flags = this._changeFlags;
    if (!flags.displayStyle && !oldView.displayStyle.equalState(newView.displayStyle))
      flags.setDisplayStyle();

    if (!flags.viewedCategories && !oldView.categorySelector.equalState(newView.categorySelector))
      flags.setViewedCategories();

    if (!flags.neverDrawn) {
      if (oldView.displayStyle.settings.compressedExcludedElementIds !== newView.displayStyle.settings.compressedExcludedElementIds)
        flags.setNeverDrawn();
    }

    if (flags.viewedModels)
      return;

    if (oldView.is2d() && newView.is2d()) {
      if (oldView.baseModelId !== newView.baseModelId)
        flags.setViewedModels();
    } else if (oldView.isSpatialView() && newView.isSpatialView()) {
      if (!oldView.modelSelector.equalState(newView.modelSelector))
        flags.setViewedModels();
    } else {
      // switched between 2d and 3d view.
      flags.setViewedModels();
    }
  }

  private static roundGrid(num: number, units: number): number {
    const sign = ((num * units) < 0.0) ? -1.0 : 1.0;
    num = (num * sign) / units + 0.5;
    return units * sign * Math.floor(num);
  }

  private getGridOrientation(origin: Point3d, rMatrix: Matrix3d) {
    if (this.view.isSpatialView())
      origin.setFrom(this.iModel.globalOrigin);

    switch (this.view.getGridOrientation()) {
      case GridOrientationType.View: {
        const center = this.view.getCenter();
        this.toViewOrientation(center);
        this.toViewOrientation(origin);
        origin.z = center.z;
        this.fromViewOrientation(origin);
        break;
      }

      case GridOrientationType.WorldXY:
        break;

      case GridOrientationType.WorldYZ: {
        Matrix3d.createRows(rMatrix.getRow(1), rMatrix.getRow(2), rMatrix.getRow(0), rMatrix);
        break;
      }

      case GridOrientationType.WorldXZ: {
        Matrix3d.createRows(rMatrix.getRow(0), rMatrix.getRow(2), rMatrix.getRow(1), rMatrix);
        break;
      }
    }
  }

  private pointToStandardGrid(point: Point3d, rMatrix: Matrix3d, origin: Point3d): void {
    const planeNormal = rMatrix.getRow(2);

    let eyeVec: Vector3d;
    if (this.view.is3d() && this.view.isCameraOn)
      eyeVec = this.view.camera.eye.vectorTo(point);
    else
      eyeVec = this._viewingSpace.rotation.getRow(2);

    eyeVec.normalizeInPlace();
    linePlaneIntersect(point, point, eyeVec, origin, planeNormal, false);

    // // get origin and point in view coordinate system
    const pointView = point.clone();
    const originView = origin.clone();
    this.toViewOrientation(pointView);
    this.toViewOrientation(originView);

    // subtract off the origin
    pointView.y -= originView.y;
    pointView.x -= originView.x;

    // round off the remainder to the grid distances
    const gridSpacing = this.view.getGridSpacing();
    pointView.x = Viewport.roundGrid(pointView.x, gridSpacing.x);
    pointView.y = Viewport.roundGrid(pointView.y, gridSpacing.y);

    // add the origin back in
    pointView.x += originView.x;
    pointView.y += originView.y;

    // go back to root coordinate system
    this.fromViewOrientation(pointView);
    point.setFrom(pointView);
  }

  /** @internal */
  public pointToGrid(point: Point3d): void {
    if (GridOrientationType.AuxCoord === this.view.getGridOrientation()) {
      this.pointToStandardGrid(point, this.getAuxCoordRotation(), this.getAuxCoordOrigin());
      return;
    }

    const origin = new Point3d();
    const rMatrix = Matrix3d.createIdentity();
    this.getGridOrientation(origin, rMatrix);
    this.pointToStandardGrid(point, rMatrix, origin);
  }

  /** Get the width of a pixel (a unit vector in the x direction in view coordinates) at a given point in world coordinates, returning the result in meters (world units).
   *
   * This is most useful to determine how large something is in a view. In particular, in a perspective view
   * the result of this method will be a larger number for points closer to the back of the view Frustum (that is,
   * one pixel of the view represents more spatial area at the back of the Frustum than the front.)
   * @param point The point to test, in World coordinates. If undefined, the center of the view in NPC space is used.
   * @returns The width of a view pixel at the supplied world point, in meters.
   * @note A "pixel" refers to a logical (CSS) pixel, not a device pixel.
   */
  public getPixelSizeAtPoint(point?: Point3d): number {
    if (point === undefined)
      point = this.npcToWorld(NpcCenter); // if undefined, use center of view

    const worldPts: Point3d[] = [];
    const viewPts: Point4d[] = [];
    viewPts[0] = this.worldToView4d(point);
    viewPts[1] = viewPts[0].clone();
    viewPts[1].x += viewPts[1].w; // form a vector one pixel wide in x direction.
    this.view4dToWorldArray(viewPts, worldPts);

    return worldPts[0].distance(worldPts[1]);
  }

  private get _wantInvertBlackAndWhite(): boolean {
    const bgColor = this.view.backgroundColor.colors;
    return ((bgColor.r + bgColor.g + bgColor.b) > (255 * 3) / 2);
  }

  /** Get a color that will contrast to the current background color of this Viewport. Either Black or White depending on which will have the most contrast. */
  public getContrastToBackgroundColor(): ColorDef {
    return this._wantInvertBlackAndWhite ? ColorDef.black : ColorDef.white; // should we use black or white?
  }

  private processFlash(): boolean {
    let needsFlashUpdate = false;

    if (this.flashedId !== this._lastFlashedElem) {
      this._flashIntensity = 0.0;
      this._flashUpdateTime = BeTimePoint.now();
      this._lastFlashedElem = this.flashedId; // flashing has begun; this is now the previous flash
      needsFlashUpdate = this.flashedId === undefined; // notify render thread that flash has been turned off (signified by undefined elem)
    }

    if (this.flashedId !== undefined && this._flashIntensity < this.flashSettings.maxIntensity) {
      assert(undefined !== this._flashUpdateTime);

      const flashDuration = this.flashSettings.duration;
      const flashElapsed = BeTimePoint.now().milliseconds - this._flashUpdateTime.milliseconds;
      this._flashIntensity = Math.min(flashElapsed, flashDuration.milliseconds) / flashDuration.milliseconds;
      this._flashIntensity = Math.min(this._flashIntensity, this.flashSettings.maxIntensity);

      needsFlashUpdate = true;
    }

    return needsFlashUpdate;
  }

  /** Create a context appropriate for producing the scene to be rendered by this viewport, e.g., by [[createScene]]. */
  public createSceneContext(): SceneContext {
    return new SceneContext(this);
  }

  /** Populate the context with the scene to be rendered by this viewport.
   * @note This method is not typically invoked directly - [[renderFrame]] invokes it as needed to recreate the scene.
   */
  public createScene(context: SceneContext): void {
    this.view.createScene(context);
    if (this._mapTiledGraphicsProvider)
      TiledGraphicsProvider.addToScene(this._mapTiledGraphicsProvider, context);

    for (const provider of this._tiledGraphicsProviders)
      TiledGraphicsProvider.addToScene(provider, context);
  }

  /** Called when the visible contents of the viewport are redrawn.
   * @note Due to the frequency of this event, avoid performing expensive work inside event listeners.
   */
  public readonly onRender = new BeEvent<(vp: Viewport) => void>();

  /** @internal */
  protected validateRenderPlan() {
    this.target.changeRenderPlan(createRenderPlanFromViewport(this));
    this._renderPlanValid = true;
  }

  private animate(): void {
    if (this._animator?.animate())
      this._animator = undefined; // animation completed.
  }

  /** Renders the contents of this viewport. This method performs only as much work as necessary based on what has changed since
   * the last frame. If nothing has changed since the last frame, nothing is rendered.
   * @note This method should almost never be invoked directly - it is invoked on your behalf by [[ViewManager]]'s render loop.
   */
  public renderFrame(): void {
    this._frameStatsCollector.beginFrame();

    const changeFlags = this._changeFlags;
    if (changeFlags.hasChanges)
      this._changeFlags = new MutableChangeFlags(ChangeFlag.None);

    const view = this.view;
    const target = this.target;

    // Start timer for tile loading time
    const timer = new StopWatch(undefined, true);
    this._frameStatsCollector.beginTime("totalSceneTime");

    this._frameStatsCollector.beginTime("animationTime");
    // if any animation is active, perform it now
    this.animate();
    this._frameStatsCollector.endTime("animationTime");

    let isRedrawNeeded = this._redrawPending || this._doContinuousRendering;
    this._redrawPending = false;

    const resized = target.updateViewRect();
    if (resized) {
      target.onResized();
      this.invalidateController();
    }

    if (!this._controllerValid)
      this.setupFromView();

    if (this._selectionSetDirty) {
      target.setHiliteSet(view.iModel.hilited);
      this._selectionSetDirty = false;
      isRedrawNeeded = true;
    }

    let overridesNeeded = changeFlags.areFeatureOverridesDirty;

    if (!this._analysisFractionValid) {
      this._analysisFractionValid = isRedrawNeeded = true;
      target.analysisFraction = this.displayStyle.settings.analysisFraction;
    }

    if (!this._timePointValid) {
      isRedrawNeeded = true;
      const scheduleScript = view.displayStyle.scheduleScript;
      if (scheduleScript) {
        target.animationBranches = AnimationBranchStates.fromScript(scheduleScript, this.timePoint ?? scheduleScript.duration.low);
        if (scheduleScript.containsFeatureOverrides)
          overridesNeeded = true;

        if (scheduleScript.containsTransform && !this._freezeScene)
          this.invalidateScene();
      }

      this._timePointValid = true;
    }

    if (overridesNeeded) {
      const ovr = new FeatureSymbology.Overrides(this);
      target.overrideFeatureSymbology(ovr);
      isRedrawNeeded = true;
    }

    if (!this._sceneValid) {
      if (!this._freezeScene) {
        this._frameStatsCollector.beginTime("createChangeSceneTime");
        IModelApp.tileAdmin.clearTilesForUser(this);
        IModelApp.tileAdmin.clearUsageForUser(this);

        const context = this.createSceneContext();
        this.createScene(context);

        context.requestMissingTiles();
        this._hasMissingTiles = context.hasMissingTiles || context.missingTiles.size > 0;
        target.changeScene(context.scene);
        isRedrawNeeded = true;
        this._frameStatsCollector.endTime("createChangeSceneTime");
      }

      this._sceneValid = true;
    }

    if (!this._renderPlanValid) {
      this._frameStatsCollector.beginTime("validateRenderPlanTime");
      this.validateRenderPlan();
      this._frameStatsCollector.endTime("validateRenderPlanTime");
      isRedrawNeeded = true;
    }

    if (!this._decorationsValid) {
      this._frameStatsCollector.beginTime("decorationsTime");
      const decorations = new Decorations();
      this.addDecorations(decorations);
      target.changeDecorations(decorations);
      this._decorationsValid = true;
      isRedrawNeeded = true;
      this._frameStatsCollector.endTime("decorationsTime");
    }

    let requestNextAnimation = false;
    if (this.processFlash()) {
      target.setFlashed(undefined !== this.flashedId ? this.flashedId : Id64.invalid, this._flashIntensity);
      isRedrawNeeded = true;
      requestNextAnimation = undefined !== this.flashedId;
    }

    this._frameStatsCollector.beginTime("onBeforeRenderTime");
    target.onBeforeRender(this, (redraw: boolean) => {
      isRedrawNeeded = isRedrawNeeded || redraw;
    });
    this._frameStatsCollector.endTime("onBeforeRenderTime");

    this._frameStatsCollector.endTime("totalSceneTime");
    timer.stop();
    if (isRedrawNeeded) {
      target.drawFrame(timer.elapsed.milliseconds);
      this.onRender.raiseEvent(this);
    }
    this._frameStatsCollector.endFrame(isRedrawNeeded);

    // Dispatch change events after timer has stopped and update has finished.
    if (resized)
      this.onResized.raiseEvent(this);

    if (changeFlags.hasChanges) {
      this.onViewportChanged.raiseEvent(this, changeFlags);

      if (changeFlags.displayStyle)
        this.onDisplayStyleChanged.raiseEvent(this);

      if (changeFlags.viewedModels)
        this.onViewedModelsChanged.raiseEvent(this);

      if (changeFlags.areFeatureOverridesDirty) {
        this.onFeatureOverridesChanged.raiseEvent(this);

        if (changeFlags.alwaysDrawn)
          this.onAlwaysDrawnChanged.raiseEvent(this);

        if (changeFlags.neverDrawn)
          this.onNeverDrawnChanged.raiseEvent(this);

        if (changeFlags.viewedCategories)
          this.onViewedCategoriesChanged.raiseEvent(this);

        if (changeFlags.viewedCategoriesPerModel)
          this.onViewedCategoriesPerModelChanged.raiseEvent(this);

        if (changeFlags.featureOverrideProvider)
          this.onFeatureOverrideProviderChanged.raiseEvent(this);
      }
    }

    if (requestNextAnimation || undefined !== this._animator || this.continuousRendering)
      IModelApp.requestNextAnimation();
  }

  /** Populate a set of decoration graphics to be displayed in this viewport.
   * This base implementation produces no graphics.
   */
  protected addDecorations(_decorations: Decorations): void { }

  /** Capture selected data about each pixel within a rectangular region of this Viewport.
   * @param rect The area of the viewport's contents to read. The origin specifies the upper-left corner. Must lie entirely within the viewport's dimensions. This input viewport is specified using CSS pixels not device pixels.
   * @param selector Specifies which aspect(s) of data to read.
   * @param receiver A function accepting a [[Pixel.Buffer]] object from which the selected data can be retrieved, or receiving undefined if the viewport has been disposed, the rect is out of bounds, or some other error. The pixels received will be device pixels, not CSS pixels. See [[Viewport.devicePixelRatio]] and [[Viewport.cssPixelsToDevicePixels]].
   * @param excludeNonLocatable If true, geometry with the "non-locatable" flag set will not be drawn.
   * @note The [[Pixel.Buffer]] supplied to the `receiver` function becomes invalid once that function exits. Do not store a reference to it.
   */
  public readPixels(rect: ViewRect, selector: Pixel.Selector, receiver: Pixel.Receiver, excludeNonLocatable?: boolean): void;

  /** Capture selected data about each pixel within a rectangular region of this viewport.
   * @note The [[Pixel.Buffer]] supplied to [[ReadPixelsArgs.receiver]] becomes invalid once that function exits. Do not store a reference to it.
   */
  public readPixels(args: ReadPixelsArgs): void;

  /** @internal */
  public readPixels(arg0: ViewRect | ReadPixelsArgs, selector?: Pixel.Selector, receiver?: Pixel.Receiver, excludeNonLocatable?: boolean): void {
    if (arg0 instanceof ViewRect) {
      assert(undefined !== selector && undefined !== receiver);
      return this._readPixels(arg0, selector, receiver, excludeNonLocatable);
    }

    // { rect, receiver, selector, excludeNonLocatable, excludedElements } = arg0;
    // this._readPixels(rect ?? this.viewRect, receiver, selector ?? Pixel.Selector.All, excludeNonLocatable, excludedElements);
    this._readPixels(
      arg0.rect ?? this.viewRect,
      arg0.selector ?? Pixel.Selector.All,
      arg0.receiver,
      arg0.excludeNonLocatable,
      arg0.excludedElements,
    );
  }

  private _readPixels(rect: ViewRect, selector: Pixel.Selector, receiver: Pixel.Receiver, excludeNonLocatable?: boolean, excludedElements?: Iterable<Id64String>): void {
    if (this.isDisposed || rect.isNull || !rect.isContained(this.viewRect)) {
      receiver(undefined);
      return;
    }

    this.target.readPixels(rect, selector, receiver, excludeNonLocatable ?? false, excludedElements);
  }

  /** @internal */
  public isPixelSelectable(pixel: Pixel.Data) {
    if (undefined === pixel.modelId || undefined === pixel.elementId)
      return false;

    if (pixel.modelId === pixel.elementId)
      return false;    // Reality Models not selectable

    return (0 === this.mapLayerFromIds(pixel.modelId, pixel.elementId).length);  // Maps no selectable.
  }

  /** Capture the image currently rendered in this viewport, or a subset thereof.
   * @param args Describes the region to capture and optional resizing. By default the entire image is captured with no resizing.
   * @returns The image, or `undefined` if the specified capture rect is not fully contained in [[viewRect], a 2d context could not be obtained, or the resultant image consists entirely
   * of 100% transparent background pixels.
   */
  public readImageBuffer(args?: ReadImageBufferArgs): ImageBuffer | undefined {
    return this.target.readImageBuffer(args);
  }

  /** Reads the current image from this viewport into an HTMLCanvasElement with a Canvas2dRenderingContext such that additional 2d graphics can be drawn onto it.
  * When using this overload, the returned image will not include canvas decorations if only one viewport is active.
  * If multiple viewports are active, the returned image will always include canvas decorations.
  * @deprecated in 5.0 - will not be removed until after 2026-06-13. Use the overload accepting a ReadImageToCanvasOptions.
  */
  public readImageToCanvas(): HTMLCanvasElement;

  /** Reads the current image from this viewport into an HTMLCanvasElement with a Canvas2dRenderingContext such that additional 2d graphics can be drawn onto it.
  * This overload allows for specifying whether canvas decorations will be omitted from the returned image by passing in [[ReadImageToCanvasOptions]].
  * The canvas decorations will be consistently omitted or included regardless of the number of active viewports.
  * @param options Options for reading the image to the canvas.
  */
 // eslint-disable-next-line @typescript-eslint/unified-signatures
  public readImageToCanvas(options: ReadImageToCanvasOptions): HTMLCanvasElement;

  /** Reads the current image from this viewport into an HTMLCanvasElement with a Canvas2dRenderingContext such that additional 2d graphics can be drawn onto it.
  * @see [[readImageBuffer]] to obtain the image as an array of RGBA pixels.
  * @internal
  */
  public readImageToCanvas(options?: ReadImageToCanvasOptions): HTMLCanvasElement {
    const canvas = (this instanceof ScreenViewport && !options?.omitCanvasDecorations) ? this.canvas : undefined;
    return this.target.readImageToCanvas(canvas);
  }

  /** Used internally by `waitForSceneCompletion`.
   * @internal
   */
  protected hasAdditionalTiles(): boolean {
    const tilesThisVp = IModelApp.tileAdmin.getTilesForUser(this);
    const ext = tilesThisVp?.external;
    if ((ext?.requested ?? 0) > 0)
      return true;
    // ViewAttachments and 3d section drawing attachments render to separate off-screen viewports - check those too.
    for (const vp of this.view.secondaryViewports) {
      if (vp.numRequestedTiles > 0) {
        return true;
      }

      const tiles = IModelApp.tileAdmin.getTilesForUser(vp);
      if (tiles && tiles.external.requested > 0) {
        return true;
      }
    }
    return false;
  }

  /** Returns a Promise that resolves after the contents of this viewport are fully loaded and rendered.
   * This can be useful, for example, when you want to capture an image of the viewport's contents, as in the following code:
   * ```ts
   *  async function captureImage(vp: Viewport): Promise<ImageBuffer | undefined> {
   *    await vp.waitForSceneCompletion();
   *    return vp.readImageBuffer();
   *  }
   * ```
   */
  public async waitForSceneCompletion(): Promise<void> {
    const system = this.target.renderSystem;
    let haveNewTiles = true;
    let haveExternalTexRequests = true;
    while ((haveNewTiles || haveExternalTexRequests) && !this.isDisposed) {
      // Since this viewport is not being managed by the ViewManager, we must first manually invalidate the scene and re-render the frame each tick of the tile-wait loop.
      this.invalidateScene();
      this.renderFrame();

      haveExternalTexRequests = system.hasExternalTextureRequests;
      haveNewTiles = !this.areAllTileTreesLoaded || this._hasMissingTiles;
      if (!haveNewTiles)
        haveNewTiles = this.hasAdditionalTiles();

      // Since the viewport is not being managed by the ViewManager, we must manually pump the TileAdmin to initiate further tile requests each tick of the tile-wait loop.
      if (haveNewTiles)
        IModelApp.tileAdmin.process();

      await BeDuration.wait(100);
    }
  }

  /** Get the point at the specified x and y location in the pixel buffer in npc coordinates.
   * @see [[getPixelDataWorldPoint]] to obtain the point in [[CoordSystem.World]].
   */
  public getPixelDataNpcPoint(pixels: Pixel.Buffer, x: number, y: number, out?: Point3d): Point3d | undefined {
    const z = pixels.getPixel(x, y).distanceFraction;
    if (z <= 0.0)
      return undefined;

    const viewSpace = this._viewingSpace;

    const result = undefined !== out ? out : new Point3d();
    const viewRect = this.viewRect.clone();
    viewRect.left = this.cssPixelsToDevicePixels(viewRect.left);
    viewRect.right = this.cssPixelsToDevicePixels(viewRect.right);
    viewRect.bottom = this.cssPixelsToDevicePixels(viewRect.bottom);
    viewRect.top = this.cssPixelsToDevicePixels(viewRect.top);
    result.x = (x + 0.5 - viewRect.left) / viewRect.width;
    result.y = 1.0 - (y + 0.5 - viewRect.top) / viewRect.height;
    if (viewSpace.frustFraction < 1.0)
      result.z = z * viewSpace.frustFraction / (1.0 + z * (viewSpace.frustFraction - 1.0)); // correct to npc if camera on.
    else
      result.z = z;

    return result;
  }

  /** Get the point at the specified x and y location in the pixel buffer in world coordinates.
   * @see [[getPixelDataNpcPoint]] to obtain the point in [[CoordSystem.Npc]].
   */
  public getPixelDataWorldPoint(args: GetPixelDataWorldPointArgs): Point3d | undefined {
    const { pixels, x, y, out, preserveModelDisplayTransforms } = args;
    const npc = this.getPixelDataNpcPoint(pixels, x, y, out);
    if (undefined !== npc) {
      this.npcToWorld(npc, npc);

      // If this is a plan projection model, invert the elevation applied to its display transform.
      // Likewise, if it is a hit on a model with a display transform, reverse the display transform.
      if (!preserveModelDisplayTransforms) {
        const pixel = pixels.getPixel(x, y);
        const modelId = pixel.modelId;
        if (undefined !== modelId) {
          const transform = this.view.computeDisplayTransform({
            modelId,
            elementId: pixel.feature?.elementId,
            viewAttachmentId: pixel.viewAttachmentId,
            inSectionDrawingAttachment: pixel.inSectionDrawingAttachment,
          });
          transform?.multiplyInversePoint3d(npc, npc);
        }
      }
    }

    return npc;
  }

  /** Query which [Feature]($common)s are currently visible within the viewport.
   * @param options Specifies how to query.
   * @param callback Callback to invoke with the results.
   * @note This function may be slow, especially if the features are being queried from screen pixels. Avoid calling it repeatedly in rapid succession.
   */
  public queryVisibleFeatures(options: QueryVisibleFeaturesOptions, callback: QueryVisibleFeaturesCallback): void {
    return queryVisibleFeatures(this, options, callback);
  }

  /** Record graphics memory consumed by this viewport. */
  public collectStatistics(stats: RenderMemory.Statistics): void {
    const trees = new DisclosedTileTreeSet();
    this.discloseTileTrees(trees);
    for (const tree of trees)
      tree.collectStatistics(stats);

    this.view.collectNonTileTreeStatistics(stats);
  }

  /** Intended strictly as a temporary solution for interactive editing applications, until official support for such apps is implemented.
   * Invalidates tile trees for all specified models (or all viewed models, if none specified), causing subsequent requests for tiles to make new requests to back-end for updated tiles.
   * @internal
   */
  public refreshForModifiedModels(modelIds: Id64Arg | undefined): void {
    if (this.view.refreshForModifiedModels(modelIds))
      this.invalidateScene();
  }

  /** A multiplier applied to the size in pixels of a [[Tile]] during tile selection for this viewport. Defaults to [[TileAdmin.defaultTileSizeModifier]] but can be overridden per-viewport.
   * A value greater than 1.0 causes lower-resolution tiles to be selected; a value less than 1.0 causes higher-resolution tiles to be selected.
   * This can allow an application to sacrifice quality for performance or vice-versa.
   * @alpha
   */
  public get tileSizeModifier(): number {
    return undefined !== this._tileSizeModifier ? this._tileSizeModifier : IModelApp.tileAdmin.defaultTileSizeModifier;
  }

  /** Controls this Viewport's [[tileSizeModifier]].
   * @param modifier If defined, overrides [[TileAdmin.defaultTileSizeModifier]]; otherwise, resets it to that default. Must be greater than zero.
   * @alpha
   */
  public setTileSizeModifier(modifier: number | undefined) {
    if (modifier === this._tileSizeModifier)
      return;

    if (undefined !== modifier && (Number.isNaN(modifier) || modifier <= 0))
      return;

    this._tileSizeModifier = modifier;
    this.invalidateScene();
  }

  /** The device pixel ratio used by this Viewport. This value is *not* necessarily equal to `window.devicePixelRatio`.
   * See: https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio
   */
  public get devicePixelRatio(): number {
    return this.target.devicePixelRatio;
  }

  /** Convert a number in CSS pixels to device pixels using this Viewport's device pixel ratio.
   * See: https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio
   * @param num The number in CSS pixels to scale
   * @returns The resulting number in device pixels
   */
  public cssPixelsToDevicePixels(cssPixels: number): number {
    return this.target.cssPixelsToDevicePixels(cssPixels);
  }

  /** See [[ViewState.setModelDisplayTransformProvider]]
   * @internal
   */
  public setModelDisplayTransformProvider(provider: ModelDisplayTransformProvider): void {
    this.view.modelDisplayTransformProvider = provider;
  }

  /** An ordered list of names of screen-space post-processing effects to be applied to the image rendered by the Viewport.
   * The effects are applied to the image in the order in which they appear in the list. Any names not corresponding to a registered effect are ignored.
   * This may have no effect if the Viewport's [[RenderTarget]] does not support screen-space effects.
   * @see [[RenderSystem.createScreenSpaceEffectBuilder]] to create and register new effects.
   * @public
   */
  public get screenSpaceEffects(): Iterable<string> {
    return this.target.screenSpaceEffects;
  }
  public set screenSpaceEffects(effects: Iterable<string>) {
    this.target.screenSpaceEffects = effects;
    this.requestRedraw();
  }

  /** Append a screen-space effect to the list of effects applied to this Viewport.
   * @see [[Viewport.screenSpaceEffects]].
   * @public
   */
  public addScreenSpaceEffect(effectName: string): void {
    this.screenSpaceEffects = [...this.screenSpaceEffects, effectName];
  }

  /** Remove all screen-space effects from this Viewport.
   * @see [[Viewport.screenSpaceEffects]].
   * @public
   */
  public removeScreenSpaceEffects(): void {
    this.screenSpaceEffects = [];
  }

  /** Add an event listener to be invoked whenever the [AnalysisStyle]($common) associated with this viewport changes.
   * The analysis style may change for any of several reasons:
   *  - When the viewport's associated [DisplayStyleSettings.analysisStyle]($common).
   *  - When the viewport's associated [[ViewState.displayStyle]] changes.
   *  - When the viewport's associated [[ViewState]] changes via [[changeView]].
   * @param listener Callback accepting the new analysis style, or undefined if there is no analysis style.
   * @returns A function that can be invoked to remove the event listener.
   */
  public addOnAnalysisStyleChangedListener(listener: (newStyle: AnalysisStyle | undefined) => void): () => void {
    const addSettingsListener = (style: DisplayStyleState) => style.settings.onAnalysisStyleChanged.addListener(listener);
    let removeSettingsListener = addSettingsListener(this.displayStyle);

    const addStyleListener = (view: ViewState) => view.onDisplayStyleChanged.addListener((style) => {
      listener(style.settings.analysisStyle);
      removeSettingsListener();
      removeSettingsListener = addSettingsListener(view.displayStyle);
    });

    const removeStyleListener = addStyleListener(this.view);

    const removeViewListener = this.onChangeView.addListener((vp) => {
      listener(vp.view.displayStyle.settings.analysisStyle);
      removeStyleListener();
      addStyleListener(vp.view);
    });

    return () => {
      removeSettingsListener();
      removeStyleListener();
      removeViewListener();
    };
  }

  /** TileUser implementation @internal */
  public get tileUserId(): number {
    return this.viewportId;
  }

  /** TileUser implementation @internal */
  public onRequestStateChanged(): void {
    this.invalidateScene();
  }

  /** @internal See [[OffScreenViewport.drawingToSheetTransform */
  public get drawingToSheetTransform(): Transform | undefined { return undefined; }
  public set drawingToSheetTransform(_: Transform | undefined) { assert(false, "drawingToSheetTransform is only relevant for OffScreenViewport"); }
}

/** An interactive Viewport that exists within an HTMLDivElement. ScreenViewports can receive HTML events.
 * To render the contents of a ScreenViewport, it must be added to the [[ViewManager]] via ViewManager.addViewport().
 * Every frame, the ViewManager will update the Viewport's state and re-render its contents if anything has changed.
 * To halt this loop, use ViewManager.dropViewport() to remove the viewport from the ViewManager.
 *
 * A ScreenViewport internally owns significant WebGL resources which must be explicitly disposed of when the viewport is no longer needed.
 * This is achieved by invoking the viewport's dispose() method. ViewManager.dropViewport() invokes dispose() on the viewport by default.
 *
 * The lifetime of a ScreenViewport typically follows a pattern:
 * ```
 *  1. Application creates the viewport via ScreenViewport.create()
 *  2. The viewport is added to the render loop via ViewManager.addViewport()
 *  3. When the application is finished with the viewport, it removes it from the render loop and disposes of it via ViewManager.dropViewport().
 * ```
 *
 * In some cases it may be useful to temporarily suspend a viewport's render loop. In this case the lifetime of the viewport proceeds as follows:
 * ```
 *  1. Application creates the viewport via ScreenViewport.create()
 *  2. The viewport is added to the render loop via ViewManager.addViewport()
 *  3. At some point the render loop is suspended via ViewManager.dropViewport(viewport, false), indicating the viewport should not be disposed.
 *  4. Optionally, resume rendering by returning to step 2.
 *  5. When the application is finished with the viewport:
 *    5a. If it is currently registered with the ViewManager, it is dropped and disposed of via ViewManager.dropViewport()
 *    5b. Otherwise, it is disposed of by invoking its dispose() method directly.
 * ```
 *
 * @see [[ScreenViewport.create]] to create a ScreenViewport.
 * @public
 * @extensions
 */
export class ScreenViewport extends Viewport {
  /** Settings that may be adjusted to control the way animations are applied to a [[ScreenViewport]] by methods like
   * [[changeView]] and [[synchWithView].
   */
  public static animation = {
    /** Duration of animations of viewing operations. */
    time: {
      fast: BeDuration.fromSeconds(.5),
      normal: BeDuration.fromSeconds(1.0),
      slow: BeDuration.fromSeconds(1.25),
      /** Duration used when zooming with the mouse wheel. */
      wheel: BeDuration.fromSeconds(.5),
    },
    /** The easing function to use for view animations. */
    easing: Easing.Cubic.Out,
    /** Pertains to view transitions that move far distances, but maintain the same view direction.
     * In that case we zoom out, move the camera, and zoom back in rather than transitioning linearly to
     * provide context for the starting and ending positions. These settings control how and when that happens.
     */
    zoomOut: {
      /** Whether to allow zooming out. If you don't want it, set this to false. */
      enable: true,
      /** The interpolation function used for camera height and position over the zoomOut operation. */
      interpolation: Interpolation.Bezier,
      /** Array of fractional height the camera rises over the animation. Height is interpolated over the array during the duration of the zoom operation.
       * At 1.0 it will be high enough that both are visible if the camera were centered between then.
       * Must start and end at 0.
       */
      heights: [0, 1.5, 2.0, 1.8, 1.5, 1.2, 1, 0],
      /** Array of fractional positions of the camera from starting to ending location when zooming.
       * Position is interpolated from the array using the interpolation function over the duration of the zoom operation (see tween.ts)
       * Must start at 0 and end at 1.
       */
      positions: [0, 0, .1, .3, .5, .8, 1],
      /** Zoom out/in only if the beginning and ending view's range, each expanded by this factor, overlap. */
      margin: 2.5,
      /** Multiply the duration of the animation by this factor when performing a zoom out. */
      durationFactor: 1.5,
    },
  };

  private _evController?: EventController;
  private _resizeObserver?: ResizeObserver;
  private _viewCmdTargetCenter?: Point3d;
  /** The number of entries in the view undo/redo buffer. */
  public maxUndoSteps = 20;
  private readonly _forwardStack: ViewPose[] = [];
  private readonly _backStack: ViewPose[] = [];
  private _currentBaseline?: ViewPose;
  private _lastPose?: ViewPose; // the pose the last time this view was rendered
  private _webglCanvas?: HTMLCanvasElement;
  private _logo!: HTMLImageElement;
  private readonly _decorationCache = new DecorationsCache();

  /** The parent HTMLDivElement of the canvas. */
  public readonly parentDiv: HTMLDivElement;
  /** The div created to hold all viewport elements. */
  public readonly vpDiv: HTMLDivElement;
  /** The canvas to display the view contents. */
  public readonly canvas: HTMLCanvasElement;
  /** The HTMLDivElement used for HTML decorations. May be referenced from the DOM by class "overlay-decorators".
   * @internal
   */
  public readonly decorationDiv: HTMLDivElement;
  /** The HTMLDivElement used for toolTips. May be referenced from the DOM by class "overlay-tooltip". */
  public readonly toolTipDiv: HTMLDivElement;

  /** Create a new ScreenViewport that shows a View of an iModel into an HTMLDivElement. This method will create a new HTMLCanvasElement as a child of the supplied parentDiv.
   * It also creates two new child HTMLDivElements: one of class "overlay-decorators" for HTML overlay decorators, and one of class
   * "overlay-tooltip" for ToolTips. All the new child HTMLElements are the same size as the parentDiv.
   * @param parentDiv The HTMLDivElement to contain the ScreenViewport. The element must have non-zero width and height.
   * @param view The ViewState for the ScreenViewport.
   * @note After creating a new ScreenViewport, you must call [[ViewManager.addViewport]] for it to become "live". You must also ensure you dispose of it properly.
   * @throws Error if `parentDiv` has zero width or height.
   */
  public static create(parentDiv: HTMLDivElement, view: ViewState): ScreenViewport {
    if (0 === parentDiv.clientWidth || 0 === parentDiv.clientHeight)
      throw new Error("viewport cannot be created from a div with zero width or height");

    const canvas = document.createElement("canvas");
    const vp = new this(canvas, parentDiv, IModelApp.renderSystem.createTarget(canvas));
    vp.initialize();

    vp.changeView(view);
    return vp;
  }

  /** @internal */
  public override[Symbol.dispose](): void {
    super[Symbol.dispose]();
    this._decorationCache.clear();
  }

  /** @internal */
  public override invalidateScene(): void {
    super.invalidateScene();

    // When the scene is invalidated, so are all cached decorations - they will be regenerated.
    this._decorationCache.clear();
  }

  /** Forces removal of a specific decorator's cached decorations from this viewport, if they exist.
   * This will force those decorations to be regenerated.
   * @see [[ViewportDecorator.useCachedDecorations]].
   */
  public invalidateCachedDecorations(decorator: ViewportDecorator) {
    this._decorationCache.delete(decorator);

    // Always invalidate decorations. Decorator may have no cached decorations currently, but wants them created.
    this.invalidateDecorations();
  }

  /** @internal */
  public static markAllChildrenForRemoval(el: HTMLDivElement) {
    for (const child of el.children)
      child[ELEMENT_MARKED_FOR_REMOVAL] = true;
  }

  /** @internal */
  public static removeMarkedChildren(el: HTMLDivElement) {
    for (const child of [...el.children]) // spread to duplicate the HTMLCollection which is invalidated by removals
      if (child[ELEMENT_MARKED_FOR_REMOVAL])
        el.removeChild(child);
  }

  /** Remove all of the children of an HTMLDivElement.
   * @internal
   */
  public static removeAllChildren(el: HTMLDivElement) {
    while (el.lastChild)
      el.removeChild(el.lastChild);
  }

  /** set Div style to absolute, {0,0,100%,100%}
   * @internal
   */
  public static setToParentSize(div: HTMLElement) {
    const style = div.style;
    style.position = "absolute";
    style.top = style.left = "0";
    style.height = style.width = "100%";
  }

  /**  add a child element to this.vpDiv and set its size and position the same as the parent.  */
  private addChildDiv(parent: HTMLElement, element: HTMLElement, zIndex: number) {
    ScreenViewport.setToParentSize(element);
    element.style.zIndex = zIndex.toString();
    parent.appendChild(element);
  }

  /** Add a new `HTMLDivElement` as a child of this viewport's div.
   * @param className The CSS class name to apply to the div.
   * @param overflowHidden Whether to set `div.style.overflow` to "hidden" instead of "visible".
   * @param z The Z index of the div relative to its sibling `HTMLElement`s.
   * @returns the new div.
   */
  public addNewDiv(className: string, overflowHidden: boolean, z: number): HTMLDivElement {
    const div = document.createElement("div");
    div.className = className;
    div.style.pointerEvents = "none";
    div.style.overflow = overflowHidden ? "hidden" : "visible";
    this.addChildDiv(this.vpDiv, div, z);
    return div;
  }

  /** The HTMLImageElement of the iTwin.js logo displayed in this ScreenViewport. */
  public get logo() { return this._logo; }

  /** @internal */
  protected addLogo() {
    const logo = this._logo = IModelApp.makeHTMLElement("img", { parent: this.vpDiv, className: "imodeljs-icon" });
    logo.src = `${IModelApp.publicPath}images/imodeljs-icon.svg`;
    logo.alt = "";

    const showLogos = async (ev: Event) => {
      const aboutBox = IModelApp.makeModalDiv({ autoClose: true, width: 460, closeBox: true, rootDiv: this.vpDiv.ownerDocument.body }).modal;
      aboutBox.className += " imodeljs-about"; // only added so the CSS knows this is the about dialog
      const logos = IModelApp.makeHTMLElement("table", { parent: aboutBox, className: "logo-cards" });

      if (undefined !== IModelApp.applicationLogoCard) {
        logos.appendChild(IModelApp.applicationLogoCard());
      }

      logos.appendChild(IModelApp.makeIModelJsLogoCard());
      const promises = new Array<Promise<void>>();
      for (const ref of this.getTileTreeRefs()) {
        promises.push(ref.addAttributions(logos, this));
      }
      await Promise.all(promises);
      ev.stopPropagation();
    };

    logo.onclick = showLogos;
    logo.addEventListener("touchstart", showLogos);
    logo.onmousemove = logo.onmousedown = logo.onmouseup = (ev) => ev.stopPropagation();
  }

  protected constructor(canvas: HTMLCanvasElement, parentDiv: HTMLDivElement, target: RenderTarget) {
    super(target);
    this.canvas = canvas;
    this.parentDiv = parentDiv;

    // first remove all children of the parent Div
    ScreenViewport.removeAllChildren(parentDiv);

    const div = this.vpDiv = IModelApp.makeHTMLElement("div", { className: "imodeljs-vp" });
    this.addChildDiv(this.parentDiv, div, 0);

    this.addChildDiv(this.vpDiv, canvas, 10);
    this.target.updateViewRect();

    // SEE: decorationDiv doc comment
    this.decorationDiv = this.addNewDiv("overlay-decorators", true, 30);
    this.toolTipDiv = this.addNewDiv("overlay-tooltip", true, 40);
    this.setCursor();
    this.addLogo();
  }

  /** Open the toolTip window in this ScreenViewport with the supplied message and location. The tooltip will be a child of [[ScreenViewport.toolTipDiv]].
   * @param message The message to display
   * @param location The position of the toolTip, in view coordinates. If undefined, use center of view.
   * @param options the ToolTip options
   * @note There is only one ToolTip window, so calling this method more than once will move the toolTip and show the second message.
   */
  public openToolTip(message: HTMLElement | string, location?: XAndY, options?: ToolTipOptions) {
    IModelApp.notifications.openToolTip(this.toolTipDiv, message, location, options);
  }

  /** @internal */
  public mousePosFromEvent(ev: MouseEvent): XAndY {
    const rect = this.getClientRect();
    return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
  }

  /** @internal */
  public mouseMovementFromEvent(ev: MouseEvent): XAndY {
    return { x: ev.movementX, y: ev.movementY };
  }

  /** Invoked by ViewManager.addViewport.
   * @internal
   */
  public onViewManagerAdd(): void {
    this.onViewManagerDrop();

    this._evController = new EventController(this);
    this._resizeObserver = new ResizeObserver(() => {
      this.requestRedraw();
    });
    this._resizeObserver.observe(this.canvas);
  }

  /** Invoked by ViewManager.dropViewport.
   * @internal
   */
  public onViewManagerDrop(): void {
    this._evController?.destroy();
    this._resizeObserver?.disconnect();
    this._evController = this._resizeObserver = undefined;
  }

  /** Find a point on geometry visible in this Viewport, within a radius of supplied pick point.
   * @param pickPoint Point to search about, in world coordinates
   * @param radius Radius, in pixels, of the circular area to search.
   * @param allowNonLocatable If true, include geometry with non-locatable flag set.
   * @param out Optional Point3d to hold the result. If undefined, a new Point3d is returned.
   * @returns The point, in world coordinates, on the element closest to `pickPoint`, or undefined if no elements within `radius`.
   */
  public pickNearestVisibleGeometry(pickPoint: Point3d, radius?: number, allowNonLocatable = true, out?: Point3d): Point3d | undefined {
    const depthResult = this.pickDepthPoint(pickPoint, radius, { excludeNonLocatable: !allowNonLocatable });
    let isValidDepth = false;
    switch (depthResult.source) {
      case DepthPointSource.Geometry:
      case DepthPointSource.Model:
      case DepthPointSource.Map:
        isValidDepth = true;
        break;
      case DepthPointSource.BackgroundMap:
      case DepthPointSource.GroundPlane:
      case DepthPointSource.Grid:
      case DepthPointSource.ACS:
        const npcPt = this.worldToNpc(depthResult.plane.getOriginRef());
        isValidDepth = !(npcPt.z < 0.0 || npcPt.z > 1.0);
        break;
    }
    if (!isValidDepth)
      return undefined;
    const result = undefined !== out ? out : new Point3d();
    result.setFrom(depthResult.plane.getOriginRef());
    return result;
  }

  /** @internal */
  public picker = new ElementPicker(); // Picker used in pickDepthPoint below so it hangs around and can be queried later.

  /** Find a point on geometry visible in this Viewport, within a radius of supplied pick point.
   * If no geometry is selected, return the point projected to the most appropriate reference plane.
   * @param pickPoint Point to search about, in world coordinates
   * @param radius Radius, in pixels, of the circular area to search.
   * @param options Optional settings to control what can be selected.
   * @returns A plane with origin from closest geometry point or reference plane projection and the source of the depth point.
   * @note The result plane normal is valid when the source is not geometry or a reality model.
   */
  public pickDepthPoint(pickPoint: Point3d, radius?: number, options?: DepthPointOptions): { plane: Plane3dByOriginAndUnitNormal, source: DepthPointSource, sourceId?: string } {
    if (!this.view.is3d())
      return { plane: Plane3dByOriginAndUnitNormal.createXYPlane(pickPoint), source: DepthPointSource.ACS };

    if (undefined === radius)
      radius = this.pixelsFromInches(ToolSettings.viewToolPickRadiusInches);

    this.picker.empty();
    const locateOpts = new LocateOptions();
    locateOpts.allowNonLocatable = (undefined === options || !options.excludeNonLocatable);
    locateOpts.allowDecorations = (undefined === options || !options.excludeDecorations);
    locateOpts.allowExternalIModels = (undefined === options || !options.excludeExternalIModels);
    locateOpts.preserveModelDisplayTransforms = true;

    if (0 !== this.picker.doPick(this, pickPoint, radius, locateOpts)) {
      const hitDetail = this.picker.getHit(0)!;
      const hitPoint = hitDetail.getPoint();
      if (hitDetail.isModelHit)
        return { plane: Plane3dByOriginAndUnitNormal.create(hitPoint, this.view.getUpVector(hitPoint))!, source: DepthPointSource.Model, sourceId: hitDetail.sourceId };
      else if (hitDetail.isMapHit)
        return { plane: Plane3dByOriginAndUnitNormal.create(hitPoint, this.view.getUpVector(hitPoint))!, source: DepthPointSource.Map, sourceId: hitDetail.sourceId };
      return { plane: Plane3dByOriginAndUnitNormal.create(hitPoint, this.view.getZVector())!, source: DepthPointSource.Geometry, sourceId: hitDetail.sourceId };
    }

    const eyePoint = this.worldToViewMap.transform1.columnZ();
    const direction = Vector3d.createFrom(eyePoint);
    const aa = Geometry.conditionalDivideFraction(1, eyePoint.w);
    if (aa !== undefined) {
      const xyzEye = direction.scale(aa);
      direction.setFrom(pickPoint.vectorTo(xyzEye));
    }

    direction.scaleToLength(-1.0, direction);
    const boresiteIntersectRay = Ray3d.create(pickPoint, direction);
    const projectedPt = Point3d.createZero();

    const backgroundMapGeometry = this.backgroundMapGeometry;
    if (undefined !== backgroundMapGeometry) {
      const intersect = backgroundMapGeometry.getRayIntersection(boresiteIntersectRay, false);

      if (undefined !== intersect) {
        const npcPt = this.worldToNpc(intersect.origin);
        if (npcPt.z < 1)    // Only if in front of eye.
          return { plane: Plane3dByOriginAndUnitNormal.create(intersect.origin, intersect.direction)!, source: DepthPointSource.BackgroundMap };
      }
    }
    // returns true if there's an intersection that isn't behind the front plane
    const boresiteIntersect = (plane: Plane3dByOriginAndUnitNormal) => {
      const dist = boresiteIntersectRay.intersectionWithPlane(plane, projectedPt);
      if (undefined === dist)
        return false;
      const npcPt = this.worldToNpc(projectedPt);
      return npcPt.z < 1.0;
    };

    if (this.view.getDisplayStyle3d().environment.displayGround) {
      const groundPlane = Plane3dByOriginAndUnitNormal.create(Point3d.create(0, 0, this.view.getGroundElevation()), Vector3d.unitZ());
      if (undefined !== groundPlane && boresiteIntersect(groundPlane))
        return { plane: Plane3dByOriginAndUnitNormal.create(projectedPt, groundPlane.getNormalRef())!, source: DepthPointSource.GroundPlane };
    }

    const acsPlane = Plane3dByOriginAndUnitNormal.create(this.getAuxCoordOrigin(), this.getAuxCoordRotation().getRow(2));
    if (undefined !== acsPlane && boresiteIntersect(acsPlane))
      return { plane: Plane3dByOriginAndUnitNormal.create(projectedPt, acsPlane.getNormalRef())!, source: (this.isGridOn && GridOrientationType.AuxCoord === this.view.getGridOrientation() ? DepthPointSource.Grid : DepthPointSource.ACS) };

    const targetPointNpc = this.worldToNpc(this.view.getTargetPoint());
    if (targetPointNpc.z < 0.0 || targetPointNpc.z > 1.0)
      targetPointNpc.z = 0.5;

    this.worldToNpc(pickPoint, projectedPt);
    projectedPt.z = targetPointNpc.z;
    this.npcToWorld(projectedPt, projectedPt);
    return { plane: Plane3dByOriginAndUnitNormal.create(projectedPt, this.view.getZVector())!, source: DepthPointSource.TargetPoint };
  }

  /** Queue an animation that interpolates between this viewport's previous [Frustum]($common) and its current frustum.
   * This function is typically called by [ViewTool]($frontend)s after modifying the viewport's [ViewState]($frontend), to smoothly transition to the new view;
   * as opposed to calling [[synchWithView]] which immediately transitions to the new view. It uses [[FrustumAnimator]] to perform the animation.
   * @public
   */
  public animateFrustumChange(options?: ViewAnimationOptions) {
    if (this._lastPose && this._currentBaseline)
      this.setAnimator(new FrustumAnimator(options ? options : {}, this, this._lastPose, this.view.savePose()));
  }

  /** Animate the view frustum from a starting frustum to the current view frustum. In other words,
   * save a starting frustum (presumably what the user is currently looking at), then adjust the view to
   * a different location and call synchWithView, then call this method. After the animation the viewport
   * frustum will be restored to its current location.
   * @internal
   */
  public animateToCurrent(_start: Frustum, options?: ViewAnimationOptions) {
    options = options ? options : {};
    this.animateFrustumChange(/* start, this.getFrustum(), */ options);
  }

  /** Animate the view frustum to a destination location the earth from the current frustum. */
  public async animateFlyoverToGlobalLocation(destination: GlobalLocation) {
    const animator = await GlobeAnimator.create(this, destination);
    this.setAnimator(animator);
  }

  /** @internal */
  public pickCanvasDecoration(pt: XAndY) { return this.target.pickOverlayDecoration(pt); }

  /** Get the DOMRect of the canvas for this Viewport. */
  public getClientRect(): DOMRect { return this.canvas.getBoundingClientRect(); }

  /** The ViewRect for this ScreenViewport. Left and top will be 0, right will be the width, and bottom will be the height.
   * @note Do not modify the ViewRect's properties.
   */
  public get viewRect(): ViewRect {
    this._viewRange.init(0, 0, this.canvas.clientWidth, this.canvas.clientHeight);
    return this._viewRange;
  }

  /** Populate a set of decoration graphics to be displayed in this viewport. */
  protected override addDecorations(decorations: Decorations): void {
    // SEE: decorationDiv doc comment
    ScreenViewport.markAllChildrenForRemoval(this.decorationDiv);
    const context = new DecorateContext(this, decorations, this._decorationCache);
    try {
      // It is an error to try to remove cached decorations while we are decorating.
      // Some naughty decorators unwittingly do so by e.g. invalidating the scene in their decorate method.
      this._decorationCache.prohibitRemoval = true;

      context.addFromDecorator(this.view);
      for (const ref of this.getTileTreeRefs()) {
        context.addFromDecorator(ref);
      }

      for (const decorator of IModelApp.viewManager.decorators)
        context.addFromDecorator(decorator);

      ScreenViewport.removeMarkedChildren(this.decorationDiv);
    } finally {
      this._decorationCache.prohibitRemoval = false;
    }
  }

  /** Change the cursor for this Viewport */
  public setCursor(cursor: string = "default"): void {
    this.canvas.style.cursor = cursor;
  }

  /** See [[Viewport.synchWithView]]. */
  public override synchWithView(options?: ViewChangeOptions): void {
    options = options ?? {};

    if (this.view.is3d() && options?.globalAlignment)
      this.view.alignToGlobe(options.globalAlignment.target, options.globalAlignment.transition);

    super.synchWithView(options);

    if (true !== options.noSaveInUndo)
      this.saveViewUndo();
    if (true === options.animateFrustumChange)
      this.animateFrustumChange(options);
  }

  /** @internal */
  protected override validateRenderPlan() {
    super.validateRenderPlan();
    this._lastPose = this.view.savePose();
  }

  /** Change the ViewState of this Viewport
   * @param view a fully loaded (see discussion at [[ViewState.load]] ) ViewState
   * @param opts options for how the view change operation should work
   */
  public override changeView(view: ViewState, opts?: ViewChangeOptions) {
    if (view === this.view) // nothing to do
      return;

    this.setAnimator(undefined); // make sure we clear any active animators before we change views.

    opts = opts ?? { animationTime: ScreenViewport.animation.time.slow.milliseconds };

    // determined whether we can animate this ViewState change
    const doAnimate = this.view && this.view.hasSameCoordinates(view) && false !== opts.animateFrustumChange;
    if (!doAnimate)
      this.clearViewUndo(); // if we can animate, don't throw out view undo.

    super.changeView(view, opts);
    this.saveViewUndo();

    if (doAnimate)
      this.animateFrustumChange(opts);
  }

  /** A point in world coordinates describing an appropriate default point for a [[ViewTool]] when no more specific point is provided by the user.
   * This point is generally managed and used by [[ViewManip]].
   */
  public get viewCmdTargetCenter(): Point3d | undefined { return this._viewCmdTargetCenter; }
  public set viewCmdTargetCenter(center: Point3d | undefined) { this._viewCmdTargetCenter = center ? center.clone() : undefined; }
  /** True if an undoable viewing operation exists on the stack */
  public get isUndoPossible(): boolean { return 0 < this._backStack.length; }

  /** True if a redoable viewing operation exists on the stack */
  public get isRedoPossible(): boolean { return 0 < this._forwardStack.length; }

  /** Clear the undo buffers of this Viewport. This resets the undo stack. */
  public clearViewUndo(): void {
    this._currentBaseline = undefined;
    this._forwardStack.length = 0;
    this._backStack.length = 0;
    this._lastPose = undefined;
  }

  /** Saves the current state of this viewport's [[ViewState]] in the undo stack, such that it can be restored by a call to [[ScreenViewport.doUndo]]. */
  public saveViewUndo(): void {
    if (this._inViewChangedEvent) // echo from a view changed event.
      return;

    // the first time we're called we need to establish the baseline
    if (!this._currentBaseline)
      this._currentBaseline = this.view.savePose();

    if (this._currentBaseline.equalState(this.view))
      return; // nothing changed, we're done

    const backStack = this._backStack;
    if (backStack.length >= this.maxUndoSteps) // don't save more than max
      backStack.shift(); // remove the oldest entry

    /** Sometimes we get requests to save undo entries from rapid viewing operations (e.g. mouse wheel rolls). To avoid lots of
     * little useless intermediate view undo steps that mean nothing, if we get a call to this within a minimum time (1/2 second by default)
     * we don't add a new entry to the view undo buffer.
     */
    const now = BeTimePoint.now();
    if (Viewport.undoDelay.isZero || backStack.length < 1 || backStack[backStack.length - 1].undoTime!.plus(Viewport.undoDelay).before(now)) {
      this._currentBaseline.undoTime = now; // save time we put this entry in undo buffer
      this._backStack.push(this._currentBaseline); // save previous state
      this._forwardStack.length = 0; // not possible to do redo after this
    }

    this._currentBaseline = this.view.savePose();
  }

  /** Reverses the most recent change to the Viewport from the undo stack. */
  public doUndo(animationTime?: BeDuration) {
    if (0 === this._backStack.length || this._currentBaseline === undefined)
      return;

    this._forwardStack.push(this._currentBaseline);
    this._currentBaseline = this._backStack.pop()!;
    this.view.applyPose(this._currentBaseline);
    this.finishUndoRedo(animationTime);
    this.onViewUndoRedo.raiseEvent(this, ViewUndoEvent.Undo);
  }

  /** Re-applies the most recently un-done change to the Viewport from the redo stack. */
  public doRedo(animationTime?: BeDuration) {
    if (0 === this._forwardStack.length || this._currentBaseline === undefined)
      return;

    this._backStack.push(this._currentBaseline);
    this._currentBaseline = this._forwardStack.pop()!;
    this.view.applyPose(this._currentBaseline);
    this.finishUndoRedo(animationTime);
    this.onViewUndoRedo.raiseEvent(this, ViewUndoEvent.Redo);
  }

  /** @internal */
  private finishUndoRedo(duration?: BeDuration): void {
    this.updateChangeFlags(this.view);
    this.setupFromView();
    if (undefined !== duration)
      this.animateFrustumChange({ animationTime: duration.milliseconds });
  }

  /** Clear the view undo buffer and establish the current ViewState as the new baseline. */
  public resetUndo() {
    this.clearViewUndo();
    this.saveViewUndo();  // Set up new baseline state
  }

  /** Show the surface normal for geometry under the cursor when snapping. */
  private static drawLocateHitDetail(context: DecorateContext, aperture: number, hit: HitDetail): void {
    if (!context.viewport.view.is3d())
      return; // Not valuable feedback in 2d...

    if (!(hit instanceof SnapDetail) || !hit.normal || hit.isPointAdjusted)
      return; // AccuSnap will flash edge/segment geometry if not a surface hit or snap location has been adjusted...

    const builder = context.createGraphicBuilder(GraphicType.WorldOverlay);
    const color = context.viewport.hilite.color.inverse().withTransparency(100); // Invert hilite color for good contrast
    const colorFill = color.withTransparency(200);

    builder.setSymbology(color, colorFill, 1);

    const skew = context.viewport.view.getAspectRatioSkew();
    const radius = (2.5 * aperture) * context.viewport.getPixelSizeAtPoint(hit.snapPoint);
    const rMatrix = Matrix3d.createRigidHeadsUp(hit.normal);
    const ellipse = Arc3d.createScaledXYColumns(hit.snapPoint, rMatrix, radius, radius / skew, AngleSweep.create360());

    builder.addArc(ellipse, true, true);
    builder.addArc(ellipse, false, false);

    const lengthX = (0.6 * radius);
    const lengthY = lengthX / skew;
    const normal = Vector3d.create();

    ellipse.vector0.normalize(normal);
    const pt1 = hit.snapPoint.plusScaled(normal, lengthX);
    const pt2 = hit.snapPoint.plusScaled(normal, -lengthX);
    builder.addLineString([pt1, pt2]);

    ellipse.vector90.normalize(normal);
    const pt3 = hit.snapPoint.plusScaled(normal, lengthY);
    const pt4 = hit.snapPoint.plusScaled(normal, -lengthY);
    builder.addLineString([pt3, pt4]);

    context.addDecorationFromBuilder(builder);
  }

  /** @internal */
  public drawLocateCursor(context: DecorateContext, viewPt: Point3d, aperture: number, isLocateCircleOn: boolean, hit?: HitDetail): void {
    if (hit)
      ScreenViewport.drawLocateHitDetail(context, aperture, hit);

    if (isLocateCircleOn) {
      // draw a filled and outlined circle to represent the size of the location aperture in the current view.
      const radius = Math.floor(aperture * 0.5) + 0.5;
      const position = viewPt.clone();
      position.x = Math.floor(position.x) + 0.5;
      position.y = Math.floor(position.y) + 0.5;
      const drawDecoration = (ctx: CanvasRenderingContext2D) => {
        ctx.beginPath();
        ctx.strokeStyle = "rgba(255,255,255,.4)";
        ctx.fillStyle = "rgba(255,255,255,.2)";
        ctx.arc(0, 0, radius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.strokeStyle = "rgba(0,0,0,.8)";
        ctx.lineWidth = 1;
        ctx.arc(0, 0, radius + 1, 0, 2 * Math.PI);
        ctx.stroke();
      };
      context.addCanvasDecoration({ position, drawDecoration }, true);
    }
  }

  /** By default, a Viewport's webgl content is rendered to an off-screen canvas owned by the RenderSystem, then the resultant image is copied to the 2d rendering context
   * belonging to the Viewport's own canvas. However, on non-chromium-based browsers this copying incurs a significant performance penalty. So, when only one Viewport
   * needs to be drawn, we can switch to rendering the webgl content directly to the screen to improve performance in those browsers.
   * ViewManager takes care of toggling this behavior.
   * @internal
   */
  public get rendersToScreen(): boolean { return undefined !== this._webglCanvas; }
  public set rendersToScreen(toScreen: boolean) {
    if (toScreen === this.rendersToScreen)
      return;

    // Returns a webgl canvas if we're rendering webgl directly to the screen.
    const webglCanvas = this.target.setRenderToScreen(toScreen);
    if (undefined === webglCanvas) {
      assert(undefined !== this._webglCanvas); // see getter...
      this.vpDiv.removeChild(this._webglCanvas);
      this._webglCanvas = undefined;
    } else {
      assert(undefined === this._webglCanvas); // see getter...
      this._webglCanvas = webglCanvas;

      this.addChildDiv(this.vpDiv, webglCanvas, 5);

      /** We really want this WebGL canvas' zIndex to be lower than this.canvas, but if we do that, browsers can decide to
       * not update the WebGL canvas contents once it is re-added to the parent div after dropping other viewports.
       * The offending element is the 2d canvas sitting on top of the WebGL canvas. We need to clear the 2d canvas' contents
       * in order to ensure browsers allow the underlying WebGL canvas to update. If a decorator is present, the 2d canvas
       * is cleared during the frame render process by virtue of updating the decorator. For the non-decorator case, and for
       * iOS, we must make sure we still clear the 2d canvas, done here. iOS appears to need this clear even when decorators
       * clear the canvas later in the frame render process.
       */
      _clear2dCanvas(this.canvas);
    }

    const resized = this.target.updateViewRect();
    if (resized) {
      this.target.onResized();
      this.invalidateController();
    }
    this.invalidateRenderPlan();
  }

  /** Overrides [[Viewport.waitForSceneCompletion]] to allow the render loop to load graphics until the scene is complete. */
  public override async waitForSceneCompletion(): Promise<void> {
    if (!IModelApp.viewManager.hasViewport(this))
      return super.waitForSceneCompletion();

    const system = this.target.renderSystem;

    // Let the ViewManager/TileAdmin initiate all further requests for tiles until no more requests are pending.
    // We will latch onto the onRender event in order to know when tile requests are finished and the promise is fulfilled.
    const promise = new Promise<void>((resolve, _reject) => {
      const removeOnRender = this.onRender.addListener(() => {
        const removeOnViewClose = IModelApp.viewManager.onViewClose.addListener((vp: ScreenViewport) => {
          if (vp as Viewport === this) {
            removeOnViewClose();
            removeOnRender();
            resolve();
            return;
          }
        });

        if (this.isDisposed) {
          removeOnViewClose();
          removeOnRender();
          resolve();
          return;
        }

        let haveNewTiles = !this.areAllTileTreesLoaded || this._hasMissingTiles;
        if (!haveNewTiles)
          haveNewTiles = this.hasAdditionalTiles();

        if (!haveNewTiles && !system.hasExternalTextureRequests) {
          removeOnViewClose();
          removeOnRender();
          resolve();
          return;
        }
      });
    });

    // Must first wait to ensure all tile trees are loaded -- tile requests will not happen before then; it may look like we have no requests pending, but in reality no requests even began.
    while (!this.areAllTileTreesLoaded) {
      await BeDuration.wait(100);
    }

    // After all tile trees have loaded, kick off an initial request for tiles.
    this.invalidateScene();
    this.renderFrame();

    return promise;
  }
}

function _clear2dCanvas(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d", { alpha: true })!;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0); // revert any previous devicePixelRatio scale for clearRect() call below.
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}

/** Options supplied when creating an [[OffScreenViewport]].
 * @see [[OffScreenViewport.create]].
 * @public
 */
export interface OffScreenViewportOptions {
  /** The view to be drawn in the viewport. */
  view: ViewState;
  /** The dimensions of the viewport. */
  viewRect: ViewRect;
  /** If true, the viewport's aspect ratio will remain fixed. */
  lockAspectRatio?: boolean;
}

/** A viewport that draws to an offscreen buffer instead of to the screen. An offscreen viewport is never added to the [[ViewManager]], therefore does not participate in
 * the render loop. Its dimensions are specified directly instead of being derived from an HTMLCanvasElement, and its renderFrame function must be manually invoked.
 * Offscreen viewports can be useful for, e.g., producing an image from the contents of a view (see [[Viewport.readImageBuffer]] and [[Viewport.readImageToCanvas]])
 * without drawing to the screen.
 * @see [[OffScreenViewport.create]] to create an off-screen viewport.
 * @public
 * @extensions
 */
export class OffScreenViewport extends Viewport {
  protected _isAspectRatioLocked = false;
  private _drawingToSheetTransform?: Transform;

  protected constructor(target: RenderTarget) {
    super(target);
  }

  /** A bit of a hack to work around our ill-advised decision to always expect a RenderClipVolume to be defined in world coordinates.
   * When we attach a section drawing to a sheet view, and the section drawing has a spatial view attached to *it*, the spatial view's clip
   * is transformed into drawing space - but when we display it we need to transform it into world (sheet) coordinates.
   * Fixing the actual problem (clips should always be defined in the coordinate space of the graphic branch containing them) would be quite error-prone
   * and likely to break existing code -- so instead the SheetViewState specifies this transform to be consumed by DrawingViewState.attachToViewport.
   * @internal
   */
  public override get drawingToSheetTransform(): Transform | undefined {
    return this._drawingToSheetTransform;
  }

  public override set drawingToSheetTransform(transform: Transform | undefined) {
    this.detachFromView();
    this._drawingToSheetTransform = transform;
    this.attachToView();
  }

  public static create(options: OffScreenViewportOptions): OffScreenViewport {
    return this.createViewport(options.view, IModelApp.renderSystem.createOffscreenTarget(options.viewRect), options.lockAspectRatio);
  }

  /** @internal because RenderTarget is internal */
  public static createViewport(view: ViewState, target: RenderTarget, lockAspectRatio = false): OffScreenViewport {
    const vp = new this(target);
    vp._isAspectRatioLocked = lockAspectRatio;
    vp.changeView(view);
    vp._decorationsValid = true;

    vp.initialize();
    return vp;
  }

  /** @internal */
  public override get isAspectRatioLocked(): boolean {
    return this._isAspectRatioLocked;
  }

  /** Get the rectangle of this Viewport in [[CoordSystem.View]] coordinates.
   * @note Do not modify the ViewRect's properties.
   */
  public override get viewRect(): ViewRect {
    return this.target.viewRect;
  }

  /** Change the dimensions of the viewport. */
  public setRect(rect: ViewRect): void {
    this.target.setViewRect(rect, false);
    this.changeView(this.view);
  }
}
