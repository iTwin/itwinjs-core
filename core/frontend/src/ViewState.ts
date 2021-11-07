/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { assert, BeEvent, dispose, Id64, Id64Arg, Id64String, JsonUtils } from "@itwin/core-bentley";
import {
  Angle, AxisOrder, ClipVector, Constant, Geometry, LongitudeLatitudeNumber, LowAndHighXY, LowAndHighXYZ, Map4d, Matrix3d,
  Plane3dByOriginAndUnitNormal, Point2d, Point3d, Range2d, Range3d, Ray3d, Transform, Vector2d, Vector3d, XAndY,
  XYAndZ, XYZ, YawPitchRollAngles,
} from "@itwin/core-geometry";
import {
  AnalysisStyle, AxisAlignedBox3d, Camera, Cartographic, ColorDef, FeatureAppearance, Frustum, GlobeMode, GridOrientationType,
  ModelClipGroups, Npc, RenderSchedule, SubCategoryOverride,
  ViewDefinition2dProps, ViewDefinition3dProps, ViewDefinitionProps, ViewDetails, ViewDetails3d, ViewFlags, ViewStateProps,
} from "@itwin/core-common";
import { AuxCoordSystem2dState, AuxCoordSystem3dState, AuxCoordSystemState } from "./AuxCoordSys";
import { CategorySelectorState } from "./CategorySelectorState";
import { DisplayStyle2dState, DisplayStyle3dState, DisplayStyleState } from "./DisplayStyleState";
import { DrawingViewState } from "./DrawingViewState";
import { ElementState } from "./EntityState";
import { Frustum2d } from "./Frustum2d";
import { IModelApp } from "./IModelApp";
import { IModelConnection } from "./IModelConnection";
import { GeometricModel2dState, GeometricModelState } from "./ModelState";
import { NotifyMessageDetails, OutputMessagePriority } from "./NotificationManager";
import { RenderClipVolume } from "./render/RenderClipVolume";
import { RenderMemory } from "./render/RenderMemory";
import { RenderScheduleState } from "./RenderScheduleState";
import { SheetViewState } from "./SheetViewState";
import { SpatialViewState } from "./SpatialViewState";
import { StandardView, StandardViewId } from "./StandardView";
import { DisclosedTileTreeSet, TileTreeReference } from "./tile/internal";
import { MarginOptions, OnViewExtentsError } from "./ViewAnimation";
import { DecorateContext, SceneContext } from "./ViewContext";
import { areaToEyeHeight, areaToEyeHeightFromGcs, GlobalLocation } from "./ViewGlobalLocation";
import { ViewingSpace } from "./ViewingSpace";
import { Viewport } from "./Viewport";
import { ViewPose, ViewPose2d, ViewPose3d } from "./ViewPose";
import { ViewStatus } from "./ViewStatus";
import { EnvironmentDecorations } from "./EnvironmentDecorations";

/** Describes the largest and smallest values allowed for the extents of a [[ViewState]].
 * Attempts to exceed these limits in any dimension will fail, preserving the previous extents.
 * @public
 */
export interface ExtentLimits {
  /** The smallest allowed extent in any dimension. */
  min: number;
  /** The largest allowed extent in any dimension. */
  max: number;
}

/** Interface adopted by an object that wants to apply a per-model display transform.
 * This is intended chiefly for use by model alignment tools.
 * @see [[ViewState.modelDisplayTransformProvider]].
 * @beta
 */
export interface ModelDisplayTransformProvider {
  getModelDisplayTransform(modelId: Id64String, baseTransform: Transform): Transform;
}

/** Arguments to [[ViewState3d.lookAt]] for either a perspective or orthographic view
 * @beta
 */
export interface LookAtArgs {
  /** The new location of the camera/eye. */
  readonly eyePoint: XYAndZ;
  /** A vector that orients the camera's "up" (view y). This vector must not be parallel to the view direction. */
  readonly upVector: Vector3d;
  /** The new size (width and height) of the view rectangle on the focus plane centered on the targetPoint. If undefined, the existing size is unchanged. */
  readonly newExtents?: XAndY;
  /** The distance from the eyePoint to the front plane. If undefined, the existing front distance is used. */
  readonly frontDistance?: number;
  /** The distance from the eyePoint to the back plane. If undefined, the existing back distance is used. */
  readonly backDistance?: number;
  /** Used for providing onExtentsError. */
  readonly opts?: OnViewExtentsError;
}

/** Arguments to [[ViewState3d.lookAt]] to set up a perspective view
 * @beta
 */
export interface LookAtPerspectiveArgs extends LookAtArgs {
  /** The new location to which the camera should point. This becomes the center of the view on the focus plane. */
  readonly targetPoint: XYAndZ;

  readonly viewDirection?: never;
  readonly lensAngle?: never;
}

/** Arguments to [[ViewState3d.lookAt]] to set up an orthographic view
 * @beta
 */
export interface LookAtOrthoArgs extends LookAtArgs {
  /** The direction in which the view should look. */
  readonly viewDirection: XYAndZ;

  readonly targetPoint?: never;
  readonly lensAngle?: never;
}

/** Arguments to [[ViewState3d.lookAt]] to set up an perspective view using a (field-of-view) lens angle.
 * @beta
 */
export interface LookAtUsingLensAngle extends LookAtArgs {
  /** The new location to which the camera should point. This becomes the center of the view on the focus plane. */
  readonly targetPoint: XYAndZ;
  /** The angle that defines the field-of-view for the camera. Must be between .0001 and pi. */
  readonly lensAngle: Angle;

  readonly viewDirection?: never;
}

/** Decorates the viewport with the view's grid. Graphics are cached as long as scene remains valid. */
class GridDecorator {
  public constructor(private readonly _view: ViewState) { }

  public readonly useCachedDecorations = true;

  public decorate(context: DecorateContext): void {
    const vp = context.viewport;
    if (!vp.isGridOn)
      return;

    const orientation = this._view.getGridOrientation();
    if (GridOrientationType.AuxCoord < orientation) {
      return; // NEEDSWORK...
    }
    if (GridOrientationType.AuxCoord === orientation) {
      this._view.auxiliaryCoordinateSystem.drawGrid(context);
      return;
    }

    const isoGrid = false;
    const gridsPerRef = this._view.getGridsPerRef();
    const spacing = Point2d.createFrom(this._view.getGridSpacing());
    const origin = Point3d.create();
    const matrix = Matrix3d.createIdentity();
    const fixedRepsAuto = Point2d.create();

    this._view.getGridSettings(vp, origin, matrix, orientation);
    context.drawStandardGrid(origin, matrix, spacing, gridsPerRef, isoGrid, orientation !== GridOrientationType.View ? fixedRepsAuto : undefined);
  }
}

const scratchCorners = Range3d.createNull().corners();
const scratchRay = Ray3d.createZero();
const unitRange2d = Range2d.createXYXY(0, 0, 1, 1);
const scratchRange2d = Range2d.createNull();
const scratchRange2dIntersect = Range2d.createNull();

/** Arguments to [[ViewState.attachToViewport]].
 * @internal
 */
export interface AttachToViewportArgs {
  invalidateDecorations: () => void;
}

/** The front-end state of a [[ViewDefinition]] element.
 * A ViewState is typically associated with a [[Viewport]] to display the contents of the view on the screen. A ViewState being displayed by a Viewport is considered to be
 * "attached" to that viewport; a "detached" viewport is not being displayed by any viewport. Because the Viewport modifies the state of its attached ViewState, a ViewState
 * can only be attached to one Viewport at a time. Technically, two Viewports can display two different ViewStates that both use the same [[DisplayStyleState]], but this is
 * discouraged - changes made to the style by one Viewport will affect the contents of the other Viewport.
 * * @see [Views]($docs/learning/frontend/Views.md)
 * @public
 */
export abstract class ViewState extends ElementState {
  /** @internal */
  public static override get className() { return "ViewDefinition"; }

  private _auxCoordSystem?: AuxCoordSystemState;
  private _extentLimits?: ExtentLimits;
  private _modelDisplayTransformProvider?: ModelDisplayTransformProvider;
  public description?: string;
  public isPrivate?: boolean;
  private readonly _gridDecorator: GridDecorator;
  private _categorySelector: CategorySelectorState;
  private _displayStyle: DisplayStyleState;
  private readonly _unregisterCategorySelectorListeners: VoidFunction[] = [];

  /** An event raised when the set of categories viewed by this view changes, *only* if the view is attached to a [[Viewport]]. */
  public readonly onViewedCategoriesChanged = new BeEvent<() => void>();

  /** An event raised just before assignment to the [[displayStyle]] property, *only* if the view is attached to a [[Viewport]].
   * @see [[DisplayStyleSettings]] for events raised when properties of the display style change.
   */
  public readonly onDisplayStyleChanged = new BeEvent<(newStyle: DisplayStyleState) => void>();

  /** Event raised just before assignment to the [[modelDisplayTransformProvider]] property, *only* if the view is attached to a [[Viewport]].
   * @beta
   */
  public readonly onModelDisplayTransformProviderChanged = new BeEvent<(newProvider: ModelDisplayTransformProvider | undefined) => void>();

  /** Selects the categories that are display by this ViewState. */
  public get categorySelector(): CategorySelectorState {
    return this._categorySelector;
  }

  public set categorySelector(selector: CategorySelectorState) {
    if (selector === this._categorySelector)
      return;

    const isAttached = this.isAttachedToViewport;
    this.unregisterCategorySelectorListeners();

    this._categorySelector = selector;

    if (isAttached) {
      this.registerCategorySelectorListeners();
      this.onViewedCategoriesChanged.raiseEvent();
    }
  }

  /** The style that controls how the contents of the view are displayed. */
  public get displayStyle(): DisplayStyleState {
    return this._displayStyle;
  }

  public set displayStyle(style: DisplayStyleState) {
    if (style === this.displayStyle)
      return;

    if (this.isAttachedToViewport)
      this.onDisplayStyleChanged.raiseEvent(style);

    this._displayStyle = style;
  }

  /** @internal */
  protected constructor(props: ViewDefinitionProps, iModel: IModelConnection, categoryOrClone: CategorySelectorState, displayStyle: DisplayStyleState) {
    super(props, iModel);
    this.description = props.description;
    this.isPrivate = props.isPrivate;
    this._displayStyle = displayStyle;
    this._categorySelector = categoryOrClone;
    this._gridDecorator = new GridDecorator(this);
    if (!(categoryOrClone instanceof ViewState))  // is this from the clone method?
      return; // not from clone

    // from clone, 3rd argument is source ViewState
    const source = categoryOrClone as ViewState;
    this._categorySelector = source.categorySelector.clone();
    this._displayStyle = source.displayStyle.clone();
    this._extentLimits = source._extentLimits;
    this._auxCoordSystem = source._auxCoordSystem;
    this._modelDisplayTransformProvider = source._modelDisplayTransformProvider;
  }

  /** Create a new ViewState object from a set of properties. Generally this is called internally by [[IModelConnection.Views.load]] after the properties
   * have been read from an iModel. But, it can also be used to create a ViewState in memory, from scratch or from properties stored elsewhere.
   */
  public static createFromProps(_props: ViewStateProps, _iModel: IModelConnection): ViewState | undefined { return undefined; }

  /** Serialize this ViewState as a set of properties that can be used to recreate it via [[ViewState.createFromProps]]. */
  public toProps(): ViewStateProps {
    return {
      viewDefinitionProps: this.toJSON(),
      categorySelectorProps: this.categorySelector.toJSON(),
      displayStyleProps: this.displayStyle.toJSON(),
    };
  }

  /** Flags controlling various aspects of this view's [[DisplayStyleState]].
   * @see [DisplayStyleSettings.viewFlags]($common)
   */
  public get viewFlags(): ViewFlags {
    return this.displayStyle.viewFlags;
  }
  public set viewFlags(flags: ViewFlags) {
    this.displayStyle.viewFlags = flags;
  }

  /** @see [DisplayStyleSettings.analysisStyle]($common). */
  public get analysisStyle(): AnalysisStyle | undefined {
    return this.displayStyle.settings.analysisStyle;
  }

  /** The [RenderSchedule.Script]($common) that animates the contents of the view, if any.
   * @see [[DisplayStyleState.scheduleScript]].
   */
  public get scheduleScript(): RenderSchedule.Script | undefined {
    return this.displayStyle.scheduleScript;
  }

  /** @internal */
  public get scheduleState(): RenderScheduleState | undefined {
    return this.displayStyle.scheduleState;
  }

  /** Get the globe projection mode.
   * @internal
   */
  public get globeMode(): GlobeMode { return this.displayStyle.globeMode; }

  /** Determine whether this ViewState exactly matches another. */
  public override equals(other: this): boolean { return super.equals(other) && this.categorySelector.equals(other.categorySelector) && this.displayStyle.equals(other.displayStyle); }

  /** Convert to JSON representation. */
  public override toJSON(): ViewDefinitionProps {
    const json = super.toJSON() as ViewDefinitionProps;
    json.categorySelectorId = this.categorySelector.id;
    json.displayStyleId = this.displayStyle.id;
    json.isPrivate = this.isPrivate;
    json.description = this.description;
    return json;
  }

  private async loadAcs(): Promise<void> {
    this._auxCoordSystem = undefined;
    const acsId = this.getAuxiliaryCoordinateSystemId();
    if (Id64.isValid(acsId)) {
      try {
        const props = await this.iModel.elements.getProps(acsId);
        if (0 !== props.length)
          this._auxCoordSystem = AuxCoordSystemState.fromProps(props[0], this.iModel);
      } catch { }
    }
  }

  /** Asynchronously load any required data for this ViewState from the backend.
   * @note callers should await the Promise returned by this method before using this ViewState.
   * @see [Views]($docs/learning/frontend/Views.md)
   */
  public async load(): Promise<void> {
    const promises = [
      this.loadAcs(),
      this.displayStyle.load(),
    ];

    const subcategories = this.iModel.subcategories.load(this.categorySelector.categories);
    if (undefined !== subcategories)
      promises.push(subcategories.promise.then((_) => { }));

    await Promise.all(promises);
  }

  /** Returns true if all [[TileTree]]s required by this view have been loaded.
   * Note that the map tile trees associated to the viewport rather than the view, to check the
   * map tiles as well call [[Viewport.areAreAllTileTreesLoaded]].
   */
  public get areAllTileTreesLoaded(): boolean {
    let allLoaded = true;
    this.forEachTileTreeRef((ref) => {
      allLoaded = allLoaded && ref.isLoadingComplete;
    });

    return allLoaded;
  }

  /** Get the name of the [[ViewDefinition]] from which this ViewState originated. */
  public get name(): string {
    return this.code.value;
  }

  /** Get this view's background color. */
  public get backgroundColor(): ColorDef {
    return this.displayStyle.backgroundColor;
  }

  /** Query the symbology overrides applied to geometry belonging to a specific subcategory when rendered using this ViewState.
   * @param id The Id of the subcategory.
   * @return The symbology overrides applied to all geometry belonging to the specified subcategory, or undefined if no such overrides exist.
   */
  public getSubCategoryOverride(id: Id64String): SubCategoryOverride | undefined {
    return this.displayStyle.getSubCategoryOverride(id);
  }

  /** Query the symbology overrides applied to a model when rendered using this ViewState.
   * @param id The Id of the model.
   * @return The symbology overrides applied to the model, or undefined if no such overrides exist.
   */
  public getModelAppearanceOverride(id: Id64String): FeatureAppearance | undefined {
    return this.displayStyle.settings.getModelAppearanceOverride(id);
  }

  /** @internal */
  public isSubCategoryVisible(id: Id64String): boolean {
    const app = this.iModel.subcategories.getSubCategoryAppearance(id);
    if (undefined === app)
      return false;

    const ovr = this.getSubCategoryOverride(id);
    if (undefined === ovr || undefined === ovr.invisible)
      return !app.invisible;

    return !ovr.invisible;
  }

  /** Provides access to optional detail settings for this view. */
  public abstract get details(): ViewDetails;

  /** Returns true if this ViewState is-a [[ViewState3d]] */
  public abstract is3d(): this is ViewState3d;
  /** Returns true if this ViewState is-a [[ViewState2d]] */
  public is2d(): this is ViewState2d { return !this.is3d(); }
  /** Returns true if this ViewState is-a [[SpatialViewState]] */
  public abstract isSpatialView(): this is SpatialViewState;
  /** Returns true if this ViewState is-a [[DrawingViewState]] */
  public abstract isDrawingView(): this is DrawingViewState;
  /** Returns true if this ViewState is-a [[SheetViewState]] */
  public isSheetView(): this is SheetViewState { return false; }
  /** Returns true if [[ViewTool]]s are allowed to operate in three dimensions on this view. */
  public abstract allow3dManipulations(): boolean;
  /** @internal */
  public abstract createAuxCoordSystem(acsName: string): AuxCoordSystemState;
  /** Get the extents of this view in [[CoordSystem.World]] coordinates. */
  public abstract getViewedExtents(): AxisAlignedBox3d;
  /** Compute a range in [[CoordSystem.World]] coordinates that tightly encloses the contents of this view.
   * @see [[FitViewTool]].
   */
  public abstract computeFitRange(): Range3d;

  /** Returns true if this view displays the contents of a [[Model]] specified by Id. */
  public abstract viewsModel(modelId: Id64String): boolean;

  /** Get the origin of this view in [[CoordSystem.World]] coordinates. */
  public abstract getOrigin(): Point3d;

  /** Get the extents of this view in [[CoordSystem.World]] coordinates. */
  public abstract getExtents(): Vector3d;

  /** Get the 3x3 ortho-normal Matrix3d for this view. */
  public abstract getRotation(): Matrix3d;

  /** Set the origin of this view in [[CoordSystem.World]] coordinates. */
  public abstract setOrigin(viewOrg: XYAndZ): void;

  /** Set the extents of this view in [[CoordSystem.World]] coordinates. */
  public abstract setExtents(viewDelta: Vector3d): void;

  /** set the center of this view to a new position. */
  public setCenter(center: Point3d) {
    const diff = center.minus(this.getCenter());
    this.setOrigin(this.getOrigin().plus(diff));
  }

  /** Change the rotation of the view.
   * @note viewRot must be ortho-normal. For 2d views, only the rotation angle about the z axis is used.
   */
  public abstract setRotation(viewRot: Matrix3d): void;

  /** Execute a function on each viewed model */
  public abstract forEachModel(func: (model: GeometricModelState) => void): void;

  /** Execute a function against the [[TileTreeReference]]s associated with each viewed model.
   * @note Each model may have more than one tile tree reference - for instance, if the view has a schedule script containing animation transforms.
   * @internal
   */
  public abstract forEachModelTreeRef(func: (treeRef: TileTreeReference) => void): void;

  /** Execute a function against each [[TileTreeReference]] associated with this view.
   * @note This may include tile trees not associated with any [[GeometricModelState]] - e.g., context reality data.
   * @internal
   */
  public forEachTileTreeRef(func: (treeRef: TileTreeReference) => void): void {
    this.forEachModelTreeRef(func);
    this.displayStyle.forEachTileTreeRef(func);
  }

  /** Disclose *all* TileTrees currently in use by this view. This set may include trees not reported by [[forEachTileTreeRef]] - e.g., those used by view attachments, map-draped terrain, etc.
   * @internal
   */
  public discloseTileTrees(trees: DisclosedTileTreeSet): void {
    this.forEachTileTreeRef((ref) => trees.disclose(ref));
  }

  /** Discloses graphics memory consumed by viewed tile trees and other consumers like view attachments.
   * @internal
   */
  public collectStatistics(stats: RenderMemory.Statistics): void {
    const trees = new DisclosedTileTreeSet();
    this.discloseTileTrees(trees);
    for (const tree of trees)
      tree.collectStatistics(stats);

    this.collectNonTileTreeStatistics(stats);
  }

  /** Discloses graphics memory consumed by any consumers *other* than viewed tile trees, like view attachments.
   * @internal
   */
  public collectNonTileTreeStatistics(_stats: RenderMemory.Statistics): void {
    //
  }

  /** @internal */
  public abstract savePose(): ViewPose;

  /** @internal */
  public abstract applyPose(props: ViewPose): this;

  /** @internal */
  public createScene(context: SceneContext): void {
    this.forEachTileTreeRef((ref: TileTreeReference) => ref.addToScene(context));
  }

  /** Add view-specific decorations. The base implementation draws the grid. Subclasses must invoke super.decorate()
   * @internal
   */
  public decorate(context: DecorateContext): void {
    this.drawGrid(context);
  }

  /** @internal */
  public static getStandardViewMatrix(id: StandardViewId): Matrix3d {
    return StandardView.getStandardRotation(id);
  }

  /** Orient this view to one of the [[StandardView]] rotations. */
  public setStandardRotation(id: StandardViewId) { this.setRotation(ViewState.getStandardViewMatrix(id)); }

  /** Orient this view to one of the [[StandardView]] rotations, if the the view is not viewing the project then the
   * standard rotation is relative to the global position rather than the project.
   */
  public setStandardGlobalRotation(id: StandardViewId) {
    const worldToView = ViewState.getStandardViewMatrix(id);
    const globeToWorld = this.getGlobeRotation();
    if (globeToWorld)
      return this.setRotation(worldToView.multiplyMatrixMatrix(globeToWorld));
    else
      this.setRotation(worldToView);
  }

  /** Get the target point of the view. If there is no camera, center is returned. */
  public getTargetPoint(result?: Point3d): Point3d { return this.getCenter(result); }

  /**  Get the point at the geometric center of the view. */
  public getCenter(result?: Point3d): Point3d {
    const delta = this.getRotation().multiplyTransposeVector(this.getExtents());
    return this.getOrigin().plusScaled(delta, 0.5, result);
  }

  /** @internal */
  public drawGrid(context: DecorateContext): void {
    context.addFromDecorator(this._gridDecorator);
  }

  /** @internal */
  public computeWorldToNpc(viewRot?: Matrix3d, inOrigin?: Point3d, delta?: Vector3d, enforceFrontToBackRatio = true): { map: Map4d | undefined, frustFraction: number } {
    if (viewRot === undefined) viewRot = this.getRotation();
    const xVector = viewRot.rowX();
    const yVector = viewRot.rowY();
    const zVector = viewRot.rowZ();

    if (delta === undefined)
      delta = this.getExtents();
    if (inOrigin === undefined)
      inOrigin = this.getOrigin();

    let frustFraction = 1.0;
    let xExtent: Vector3d;
    let yExtent: Vector3d;
    let zExtent: Vector3d;
    let origin: Point3d;

    // Compute root vectors along edges of view frustum.
    if (this.is3d() && this.isCameraOn) {
      const camera = this.camera;
      const eyeToOrigin = Vector3d.createStartEnd(camera.eye, inOrigin); // vector from origin on backplane to eye
      viewRot.multiplyVectorInPlace(eyeToOrigin);                        // align with view coordinates.

      const focusDistance = camera.focusDist;
      let zDelta = delta.z;
      let zBack = eyeToOrigin.z;              // Distance from eye to backplane.
      let zFront = zBack + zDelta;            // Distance from eye to frontplane.

      const nearScale = IModelApp.renderSystem.supportsLogZBuffer ? ViewingSpace.nearScaleLog24 : ViewingSpace.nearScaleNonLog24;
      if (enforceFrontToBackRatio && zFront / zBack < nearScale) {
        // In this case we are running up against the zBuffer resolution limitation (currently 24 bits).
        // Set back clipping plane at 10 kilometer which gives us a front clipping plane about 3 meters.
        // Decreasing the maximumBackClip (MicroStation uses 1 kilometer) will reduce the minimum front
        // clip, but also reduce the back clip (so far geometry may not be visible).
        const maximumBackClip = 10 * Constant.oneKilometer;
        if (-zBack > maximumBackClip) {
          zBack = -maximumBackClip;
          eyeToOrigin.z = zBack;
        }

        zFront = zBack * nearScale;
        zDelta = zFront - eyeToOrigin.z;
      }

      // z out back of eye ===> origin z coordinates are negative.  (Back plane more negative than front plane)
      const backFraction = -zBack / focusDistance;    // Perspective fraction at back clip plane.
      const frontFraction = -zFront / focusDistance;  // Perspective fraction at front clip plane.
      frustFraction = frontFraction / backFraction;

      // delta.x,delta.y are view rectangle sizes at focus distance.  Scale to back plane:
      xExtent = xVector.scale(delta.x * backFraction);   // xExtent at back == delta.x * backFraction.
      yExtent = yVector.scale(delta.y * backFraction);   // yExtent at back == delta.y * backFraction.

      // Calculate the zExtent in the View coordinate system.
      zExtent = new Vector3d(eyeToOrigin.x * (frontFraction - backFraction), eyeToOrigin.y * (frontFraction - backFraction), zDelta);
      viewRot.multiplyTransposeVectorInPlace(zExtent);   // rotate back to root coordinates.

      origin = new Point3d(
        eyeToOrigin.x * backFraction,   // Calculate origin in eye coordinates
        eyeToOrigin.y * backFraction,
        eyeToOrigin.z);

      viewRot.multiplyTransposeVectorInPlace(origin);  // Rotate back to root coordinates
      origin.plus(camera.eye, origin); // Add the eye point.
    } else {
      origin = inOrigin;
      xExtent = xVector.scale(delta.x);
      yExtent = yVector.scale(delta.y);
      zExtent = zVector.scale(delta.z ? delta.z : 1.0);
    }

    // calculate the root-to-npc mapping (using expanded frustum)
    return { map: Map4d.createVectorFrustum(origin, xExtent, yExtent, zExtent, frustFraction), frustFraction };
  }

  /** Calculate the world coordinate Frustum from the parameters of this ViewState.
   * @param result Optional Frustum to hold result. If undefined a new Frustum is created.
   * @returns The 8-point Frustum with the corners of this ViewState, or undefined if the parameters are invalid.
   */
  public calculateFrustum(result?: Frustum): Frustum | undefined {
    const val = this.computeWorldToNpc();
    if (undefined === val.map)
      return undefined;

    const box = result ? result.initNpc() : new Frustum();
    val.map.transform1.multiplyPoint3dArrayQuietNormalize(box.points);
    return box;
  }

  public calculateFocusCorners() {
    const map = this.computeWorldToNpc()!.map!;
    const focusNpcZ = Geometry.clamp(map.transform0.multiplyPoint3dQuietNormalize(this.getTargetPoint()).z, 0, 1.0);
    const pts = [new Point3d(0.0, 0.0, focusNpcZ), new Point3d(1.0, 0.0, focusNpcZ), new Point3d(0.0, 1.0, focusNpcZ), new Point3d(1.0, 1.0, focusNpcZ)];
    map.transform1.multiplyPoint3dArrayQuietNormalize(pts);
    return pts;
  }

  /** Initialize the origin, extents, and rotation from an existing Frustum
   * This function is commonly used in the implementation of [[ViewTool]]s as follows:
   *  1. Obtain the ViewState's initial frustum.
   *  2. Modify the frustum based on user input.
   *  3. Update the ViewState to match the modified frustum.
   * @param frustum the input Frustum.
   * @param opts for providing onExtentsError
   * @return Success if the frustum was successfully updated, or an appropriate error code.
   */
  public setupFromFrustum(inFrustum: Frustum, opts?: OnViewExtentsError): ViewStatus {
    const frustum = inFrustum.clone(); // make sure we don't modify input frustum
    frustum.fixPointOrder();
    const frustPts = frustum.points;
    const viewOrg = frustPts[Npc.LeftBottomRear];

    // frustumX, frustumY, frustumZ are vectors along edges of the frustum. They are NOT unit vectors.
    // X and Y should be perpendicular, and Z should be right handed.
    const frustumX = Vector3d.createFrom(frustPts[Npc.RightBottomRear].minus(viewOrg));
    const frustumY = Vector3d.createFrom(frustPts[Npc.LeftTopRear].minus(viewOrg));
    const frustumZ = Vector3d.createFrom(frustPts[Npc.LeftBottomFront].minus(viewOrg));

    const frustMatrix = Matrix3d.createRigidFromColumns(frustumX, frustumY, AxisOrder.XYZ);
    if (!frustMatrix)
      return ViewStatus.InvalidWindow;

    // if we're close to one of the standard views, adjust to it to remove any "fuzz"
    StandardView.adjustToStandardRotation(frustMatrix);

    const xDir = frustMatrix.getColumn(0);
    const yDir = frustMatrix.getColumn(1);
    const zDir = frustMatrix.getColumn(2);

    // set up view Rotation matrix as rows of frustum matrix.
    const viewRot = frustMatrix.inverse();
    if (!viewRot)
      return ViewStatus.InvalidWindow;

    // Left handed frustum?
    const zSize = zDir.dotProduct(frustumZ);
    if (zSize < 0.0)
      return ViewStatus.InvalidWindow;

    const viewDiagRoot = new Vector3d();
    viewDiagRoot.plus2Scaled(xDir, xDir.dotProduct(frustumX), yDir, yDir.dotProduct(frustumY), viewDiagRoot);  // vectors on the back plane
    viewDiagRoot.plusScaled(zDir, zSize, viewDiagRoot);       // add in z vector perpendicular to x,y

    // use center of frustum and view diagonal for origin. Original frustum may not have been orthogonal
    frustum.getCenter().plusScaled(viewDiagRoot, -0.5, viewOrg);

    // delta is in view coordinates
    const viewDelta = viewRot.multiplyVector(viewDiagRoot);
    const status = this.adjustViewDelta(viewDelta, viewOrg, viewRot, undefined, opts);
    if (ViewStatus.Success !== status)
      return status;

    this.setOrigin(viewOrg);
    this.setExtents(viewDelta);
    this.setRotation(viewRot);
    this._updateMaxGlobalScopeFactor();
    return ViewStatus.Success;
  }

  /** Get or set the largest and smallest values allowed for the extents for this ViewState
   * The default limits vary based on the type of view:
   *   - Spatial view extents cannot exceed the diameter of the earth.
   *   - Drawing view extents cannot exceed twice the longest axis of the drawing model's range.
   *   - Sheet view extents cannot exceed ten times the paper size of the sheet.
   * Explicitly setting the extent limits overrides the default limits.
   * @see [[resetExtentLimits]] to restore the default limits.
   */
  public get extentLimits(): ExtentLimits { return undefined !== this._extentLimits ? this._extentLimits : this.defaultExtentLimits; }
  public set extentLimits(limits: ExtentLimits) { this._extentLimits = limits; }

  /** Resets the largest and smallest values allowed for the extents of this ViewState to their default values.
   * @see [[extentLimits]].
   */
  public resetExtentLimits(): void { this._extentLimits = undefined; }

  /** Returns the default extent limits for this ViewState. These limits are used if the [[extentLimits]] have not been explicitly overridden.
   */
  public abstract get defaultExtentLimits(): ExtentLimits;

  public setDisplayStyle(style: DisplayStyleState) { this.displayStyle = style; }

  /** Adjust the y dimension of this ViewState so that its aspect ratio matches the supplied value.
   * @internal
   */
  public fixAspectRatio(windowAspect: number): void {
    const origExtents = this.getExtents();
    const extents = origExtents.clone();
    extents.y = extents.x / (windowAspect * this.getAspectRatioSkew());
    if (extents.isAlmostEqual(origExtents))
      return;

    // adjust origin by half of the distance we modified extents to keep centered
    const origin = this.getOrigin().clone();
    origin.addScaledInPlace(this.getRotation().multiplyTransposeVector(extents.vectorTo(origExtents, origExtents)), .5);
    this.setOrigin(origin);
    this.setExtents(extents);
  }

  /** @internal */
  public outputStatusMessage(status: ViewStatus): ViewStatus {
    IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Error, IModelApp.localization.getLocalizedString(`Viewing.${ViewStatus[status]}`)));
    return status;
  }

  /** @internal */
  public adjustViewDelta(delta: Vector3d, origin: XYZ, rot: Matrix3d, aspect?: number, opts?: OnViewExtentsError): ViewStatus {
    const origDelta = delta.clone();

    let status = ViewStatus.Success;
    const limit = this.extentLimits;
    const limitDelta = (val: number) => {
      if (val < limit.min) {
        val = limit.min;
        status = ViewStatus.MinWindow;
      } else if (val > limit.max) {
        val = limit.max;
        status = ViewStatus.MaxWindow;
      }
      return val;
    };

    delta.x = limitDelta(delta.x);
    delta.y = limitDelta(delta.y);

    if (aspect) { // skip if either undefined or 0
      aspect *= this.getAspectRatioSkew();
      if (delta.x > (aspect * delta.y))
        delta.y = delta.x / aspect;
      else
        delta.x = delta.y * aspect;
    }

    if (!delta.isAlmostEqual(origDelta))
      origin.addScaledInPlace(rot.multiplyTransposeVector(delta.vectorTo(origDelta, origDelta)), .5);

    return (status !== ViewStatus.Success && opts?.onExtentsError) ? opts.onExtentsError(status) : status;
  }

  /** Adjust the aspect ratio of this ViewState so it matches the supplied value. The adjustment is accomplished by increasing one dimension
   * and leaving the other unchanged, depending on the ratio of this ViewState's current aspect ratio to the supplied one. This means the result
   * always shows everything in the current volume, plus potentially more.
   * @note The *automatic* adjustment that happens when ViewStates are used in Viewports **always** adjusts the Y axis (making
   * it potentially smaller). That's so that process can be reversible if the view's aspect ratio changes repeatedly (as happens when panels slide in/out, etc.)
   */
  public adjustAspectRatio(aspect: number) {
    const extents = this.getExtents();
    const origin = this.getOrigin();
    this.adjustViewDelta(extents, origin, this.getRotation(), aspect);
    this.setExtents(extents);
    this.setOrigin(origin);
  }

  /** Set the CategorySelector for this view. */
  public setCategorySelector(categories: CategorySelectorState) { this.categorySelector = categories; }

  /** get the auxiliary coordinate system state object for this ViewState. */
  public get auxiliaryCoordinateSystem(): AuxCoordSystemState {
    if (!this._auxCoordSystem)
      this._auxCoordSystem = this.createAuxCoordSystem("");
    return this._auxCoordSystem;
  }

  /** Get the Id of the auxiliary coordinate system for this ViewState */
  public getAuxiliaryCoordinateSystemId(): Id64String {
    return this.details.auxiliaryCoordinateSystemId;
  }

  /** Set or clear the AuxiliaryCoordinateSystem for this view.
   * @param acs the new AuxiliaryCoordinateSystem for this view. If undefined, no AuxiliaryCoordinateSystem will be used.
   */
  public setAuxiliaryCoordinateSystem(acs?: AuxCoordSystemState) {
    this._auxCoordSystem = acs;
    this.details.auxiliaryCoordinateSystemId = undefined !== acs ? acs.id : Id64.invalid;
  }

  /** Determine whether the specified Category is displayed in this view */
  public viewsCategory(id: Id64String): boolean {
    return this.categorySelector.isCategoryViewed(id);
  }

  /**  Get the aspect ratio (width/height) of this view */
  public getAspectRatio(): number {
    const extents = this.getExtents();
    return extents.x / extents.y;
  }

  /** Get the aspect ratio skew (x/y, usually 1.0) that is used to exaggerate the y axis of the view. */
  public getAspectRatioSkew(): number {
    return this.details.aspectRatioSkew;
  }

  /** Set the aspect ratio skew (x/y) for this view. To remove aspect ratio skew, pass 1.0 for val. */
  public setAspectRatioSkew(val: number) {
    this.details.aspectRatioSkew = val;
  }

  /** Get the unit vector that points in the view X (left-to-right) direction.
   * @param result optional Vector3d to be used for output. If undefined, a new object is created.
   */
  public getXVector(result?: Vector3d): Vector3d { return this.getRotation().getRow(0, result); }

  /** Get the unit vector that points in the view Y (bottom-to-top) direction.
   * @param result optional Vector3d to be used for output. If undefined, a new object is created.
   */
  public getYVector(result?: Vector3d): Vector3d { return this.getRotation().getRow(1, result); }

  /** Get the unit vector that points in the view Z (front-to-back) direction.
   * @param result optional Vector3d to be used for output. If undefined, a new object is created.
   */
  public getZVector(result?: Vector3d): Vector3d { return this.getRotation().getRow(2, result); }

  /** Set or clear the clipping volume for this view.
   * @param clip the new clipping volume. If undefined, clipping is removed from view.
   * @note The ViewState takes ownership of the supplied ClipVector - it should not be modified after passing it to this function.
   */
  public setViewClip(clip?: ClipVector) {
    this.details.clipVector = clip;
  }

  /** Get the clipping volume for this view, if defined
   * @note Do *not* modify the returned ClipVector. If you wish to change the ClipVector, clone the returned ClipVector, modify it as desired, and pass the clone to [[setViewClip]].
   */
  public getViewClip(): ClipVector | undefined {
    return this.details.clipVector;
  }

  /** Set the grid settings for this view */
  public setGridSettings(orientation: GridOrientationType, spacing: Point2d, gridsPerRef: number): void {
    switch (orientation) {
      case GridOrientationType.WorldYZ:
      case GridOrientationType.WorldXZ:
        if (!this.is3d())
          return;
        break;
    }

    this.details.gridOrientation = orientation;
    this.details.gridsPerRef = gridsPerRef;
    this.details.gridSpacing = spacing;
  }

  /** Populate the given origin and rotation with information from the grid settings from the grid orientation. */
  public getGridSettings(vp: Viewport, origin: Point3d, rMatrix: Matrix3d, orientation: GridOrientationType) {
    // start with global origin (for spatial views) and identity matrix
    rMatrix.setIdentity();
    origin.setFrom(vp.view.isSpatialView() ? vp.view.iModel.globalOrigin : Point3d.create());

    switch (orientation) {
      case GridOrientationType.View: {
        const centerWorld = Point3d.create(0.5, 0.5, 0.5);
        vp.npcToWorld(centerWorld, centerWorld);

        rMatrix.setFrom(vp.rotation);
        rMatrix.multiplyXYZtoXYZ(origin, origin);
        origin.z = centerWorld.z;
        rMatrix.multiplyTransposeVectorInPlace(origin);
        break;
      }
      case GridOrientationType.WorldXY:
        break;
      case GridOrientationType.WorldYZ: {
        const rowX = rMatrix.getRow(0);
        const rowY = rMatrix.getRow(1);
        const rowZ = rMatrix.getRow(2);
        rMatrix.setRow(0, rowY);
        rMatrix.setRow(1, rowZ);
        rMatrix.setRow(2, rowX);
        break;
      }
      case GridOrientationType.WorldXZ: {
        const rowX = rMatrix.getRow(0);
        const rowY = rMatrix.getRow(1);
        const rowZ = rMatrix.getRow(2);
        rMatrix.setRow(0, rowX);
        rMatrix.setRow(1, rowZ);
        rMatrix.setRow(2, rowY);
        break;
      }
    }
  }

  /** Get the grid settings for this view */
  public getGridOrientation(): GridOrientationType {
    return this.details.gridOrientation;
  }
  public getGridsPerRef(): number {
    return this.details.gridsPerRef;
  }
  public getGridSpacing(): XAndY {
    return this.details.gridSpacing;
  }

  /** Change the volume that this view displays, keeping its current rotation.
   * @param volume The new volume, in world-coordinates, for the view. The resulting view will show all of worldVolume, by fitting a
   * view-axis-aligned bounding box around it. For views that are not aligned with the world coordinate system, this will sometimes
   * result in a much larger volume than worldVolume.
   * @param aspect The X/Y aspect ratio of the view into which the result will be displayed. If the aspect ratio of the volume does not
   * match aspect, the shorter axis is lengthened and the volume is centered. If aspect is undefined, no adjustment is made.
   * @param options for providing MarginPercent and onExtentsError
   * @note for 2d views, only the X and Y values of volume are used.
   */
  public lookAtVolume(volume: LowAndHighXYZ | LowAndHighXY, aspect?: number, options?: MarginOptions & OnViewExtentsError) {
    const rangeBox = Frustum.fromRange(volume).points;
    this.getRotation().multiplyVectorArrayInPlace(rangeBox);
    return this.lookAtViewAlignedVolume(Range3d.createArray(rangeBox), aspect, options);
  }

  /** Look at a volume of space defined by a range in view local coordinates, keeping its current rotation.
   * @param volume The new volume, in view-aligned coordinates. The resulting view will show all of the volume.
   * @param aspect The X/Y aspect ratio of the view into which the result will be displayed. If the aspect ratio of the volume does not
   * match aspect, the shorter axis is lengthened and the volume is centered. If aspect is undefined, no adjustment is made.
   * @param options for providing MarginPercent and onExtentsError
   * @see lookAtVolume
   */
  public lookAtViewAlignedVolume(volume: Range3d, aspect?: number, options?: MarginOptions & OnViewExtentsError) {
    if (volume.isNull) // make sure volume is valid
      return;

    const viewRot = this.getRotation();
    const newOrigin = volume.low.clone();
    const newDelta = volume.diagonal();

    const minimumDepth = Constant.oneMillimeter;
    if (newDelta.z < minimumDepth) {
      newOrigin.z -= (minimumDepth - newDelta.z) / 2.0;
      newDelta.z = minimumDepth;
    }

    const margin = options?.marginPercent;

    if (this.is3d() && this.isCameraOn) {
      // If the camera is on, the only way to guarantee we can see the entire volume is to set delta at the front plane, not focus plane.
      // That generally causes the view to be too large (objects in it are too small), since we can't tell whether the objects are at
      // the front or back of the view. For this reason, don't attempt to add any "margin" to camera views.
    } else if (margin) {
      // compute how much space we'll need for both of X and Y margins in root coordinates
      const wPercent = margin.left + margin.right;
      const hPercent = margin.top + margin.bottom;

      const marginHorizontal = wPercent / (1 - wPercent) * newDelta.x;
      const marginVert = hPercent / (1 - hPercent) * newDelta.y;

      // compute left and bottom margins in root coordinates
      const marginLeft = margin.left / (1 - wPercent) * newDelta.x;
      const marginBottom = margin.bottom / (1 - hPercent) * newDelta.y;

      // add the margins to the range
      newOrigin.x -= marginLeft;
      newOrigin.y -= marginBottom;
      newDelta.x += marginHorizontal;
      newDelta.y += marginVert;
    } else {
      const origDelta = newDelta.clone();
      newDelta.scale(1.04, newDelta); // default "dilation"
      newOrigin.addScaledInPlace(origDelta.minus(newDelta, origDelta), .5);
    }

    viewRot.multiplyTransposeVectorInPlace(newOrigin);

    if (ViewStatus.Success !== this.adjustViewDelta(newDelta, newOrigin, viewRot, aspect, options))
      return;

    this.setExtents(newDelta);
    this.setOrigin(newOrigin);

    if (!this.is3d())
      return;

    const cameraDef = this.camera;
    cameraDef.validateLens();
    // move the camera back so the entire x,y range is visible at front plane
    const frontDist = newDelta.x / (2.0 * Math.tan(cameraDef.getLensAngle().radians / 2.0));
    const backDist = frontDist + newDelta.z;

    cameraDef.setFocusDistance(frontDist); // do this even if the camera isn't currently on.
    this.centerEyePoint(backDist); // do this even if the camera isn't currently on.
    this.verifyFocusPlane(); // changes delta/origin
  }

  /** Set the rotation of this ViewState to the supplied rotation, by rotating it about a point.
   * @param rotation The new rotation matrix for this ViewState.
   * @param point The point to rotate about. If undefined, use the [[getTargetPoint]].
   */
  public setRotationAboutPoint(rotation: Matrix3d, point?: Point3d): void {
    if (undefined === point)
      point = this.getTargetPoint();

    const inverse = rotation.clone().inverse();
    if (undefined === inverse)
      return;

    const targetMatrix = inverse.multiplyMatrixMatrix(this.getRotation());
    const worldTransform = Transform.createFixedPointAndMatrix(point, targetMatrix);
    const frustum = this.calculateFrustum();
    if (undefined !== frustum) {
      frustum.multiply(worldTransform);
      this.setupFromFrustum(frustum);
    }
  }

  /** Intended strictly as a temporary solution for interactive editing applications, until official support for such apps is implemented.
   * Invalidates tile trees for all specified models (or all viewed models, if none specified), causing subsequent requests for tiles to make new requests to back-end for updated tiles.
   * Returns true if any tile tree was invalidated.
   * @internal
   */
  public refreshForModifiedModels(modelIds: Id64Arg | undefined): boolean {
    let refreshed = false;
    this.forEachModelTreeRef((ref) => {
      const tree = ref.treeOwner.tileTree;
      if (undefined !== tree && (undefined === modelIds || Id64.has(modelIds, tree.modelId))) {
        ref.treeOwner.dispose();
        refreshed = true;
      }
    });

    return refreshed;
  }

  /** Determine whether this ViewState has the same coordinate system as another one.
   * They must be from the same iModel, and view a model in common.
   */
  public hasSameCoordinates(other: ViewState): boolean {
    if (this.iModel !== other.iModel)
      return false;

    // Spatial views view any number of spatial models all sharing one coordinate system.
    if (this.isSpatialView() && other.isSpatialView())
      return true;

    // People sometimes mistakenly stick 2d models into spatial views' model selectors.
    if (this.isSpatialView() || other.isSpatialView())
      return false;

    // Non-spatial views view exactly one model. If they view the same model, they share a coordinate system.
    let allowView = false;
    this.forEachModel((model) => {
      allowView ||= other.viewsModel(model.id);
    });

    return allowView;
  }

  public getUpVector(point: Point3d): Vector3d {
    if (!this.iModel.isGeoLocated || this.globeMode !== GlobeMode.Ellipsoid || this.iModel.projectExtents.containsPoint(point))
      return Vector3d.unitZ();

    const earthCenter = this.iModel.getMapEcefToDb(0).origin;
    const normal = Vector3d.createStartEnd(earthCenter, point);
    normal.normalizeInPlace();

    return normal;
  }

  /** Return true if the view is looking at the current iModel project extents or
   * false if the viewed area do does not include more than one percent of the project.
   */
  public getIsViewingProject(): boolean {
    if (!this.isSpatialView())
      return false;

    const worldToNpc = this.computeWorldToNpc();
    if (!worldToNpc || !worldToNpc.map)
      return false;

    const expandedRange = this.iModel.projectExtents.clone();
    expandedRange.expandInPlace(10E3);
    const corners = expandedRange.corners(scratchCorners);
    worldToNpc.map.transform0.multiplyPoint3dArrayQuietNormalize(corners);
    scratchRange2d.setNull();
    corners.forEach((corner) => scratchRange2d.extendXY(corner.x, corner.y));
    const intersection = scratchRange2d.intersect(unitRange2d, scratchRange2dIntersect);
    if (!intersection || intersection.isNull)
      return false;

    const area = (intersection.high.x - intersection.low.x) * (intersection.high.y - intersection.low.y);
    return area > 1.0E-2;
  }

  /** If the view is not of the project as determined by [[getIsViewingProject]] then return
   * the rotation from a global reference frame to world coordinates.  The global reference frame includes
   * Y vector towards true north, X parallel to the equator and Z perpendicular to the ellipsoid surface
   */
  public getGlobeRotation(): Matrix3d | undefined {
    if (!this.iModel.isGeoLocated || this.globeMode !== GlobeMode.Ellipsoid || this.getIsViewingProject())
      return undefined;

    const backgroundMapGeometry = this.displayStyle.getBackgroundMapGeometry();
    if (!backgroundMapGeometry)
      return undefined;

    const targetRay = Ray3d.create(this.getCenter(), this.getRotation().rowZ().negate(), scratchRay);
    const earthEllipsoid = backgroundMapGeometry.getEarthEllipsoid();
    const intersectFractions = new Array<number>(), intersectAngles = new Array<LongitudeLatitudeNumber>();
    if (earthEllipsoid.intersectRay(targetRay, intersectFractions, undefined, intersectAngles) < 2)
      return undefined;

    let minIndex = 0, minFraction = -1.0E10;
    for (let i = 0; i < intersectFractions.length; i++) {
      const fraction = intersectFractions[i];
      if (fraction < minFraction) {
        minFraction = fraction;
        minIndex = i;
      }
    }
    const angles = intersectAngles[minIndex];
    const pointAndDeriv = earthEllipsoid.radiansToPointAndDerivatives(angles.longitudeRadians, angles.latitudeRadians, false);
    return Matrix3d.createRigidFromColumns(pointAndDeriv.vectorU, pointAndDeriv.vectorV, AxisOrder.XYZ)?.transpose();

  }

  /** A value that represents the global scope of the view -- a value greater than one indicates that the scope of this view is global (viewing most of Earth). */
  public get globalScopeFactor(): number {
    return this.getExtents().magnitudeXY() / Constant.earthRadiusWGS84.equator;
  }

  private _maxGlobalScopeFactor = 0;
  /** The maximum global scope is not persistent, but maintained as highest global scope factor. This can be used to determine
   * if the view is of a limited area or if it has ever viewed the entire globe and therefore may be assumed to view it again
   * and therefore may warrant resources for displaying the globe, such as an expanded viewing frustum and preloading globe map tiles.
   * A value greater than one indicates that the viewport has been used to view globally at least once.
   * @internal
   */
  public get maxGlobalScopeFactor() { return this._maxGlobalScopeFactor; }

  protected _updateMaxGlobalScopeFactor() { this._maxGlobalScopeFactor = Math.max(this._maxGlobalScopeFactor, this.globalScopeFactor); }

  /** Return elevation applied to model when displayed. This is strictly relevant to plan projection models.
   * @internal
   */
  public getModelElevation(_modelId: Id64String): number { return 0; }

  /** Specify a provider of per-model display transforms. Intended chiefly for use by model alignment tools.
   * @note The transform supplied is used for display purposes **only**. Do not expect operations like snapping to account for the display transform.
   * @beta
   */
  public get modelDisplayTransformProvider(): ModelDisplayTransformProvider | undefined {
    return this._modelDisplayTransformProvider;
  }

  public set modelDisplayTransformProvider(provider: ModelDisplayTransformProvider | undefined) {
    if (provider === this.modelDisplayTransformProvider)
      return;

    if (this.isAttachedToViewport)
      this.onModelDisplayTransformProviderChanged.raiseEvent(provider);

    this._modelDisplayTransformProvider = provider;
  }

  /** Obtain the transform with which the specified model will be displayed, accounting for this view's [[ModelDisplayTransformProvider]].
   * @beta
   */
  public getModelDisplayTransform(modelId: Id64String, baseTransform: Transform): Transform {
    return this.modelDisplayTransformProvider ? this.modelDisplayTransformProvider.getModelDisplayTransform(modelId, baseTransform) : baseTransform;
  }

  /** @internal */
  public transformPointByModelDisplayTransform(modelId: string | undefined, pnt: Point3d, inverse: boolean): void {
    if (undefined !== modelId && undefined !== this.modelDisplayTransformProvider) {
      const transform = this.modelDisplayTransformProvider.getModelDisplayTransform(modelId, Transform.createIdentity());
      const newPnt = inverse ? transform.multiplyInversePoint3d(pnt) : transform.multiplyPoint3d(pnt);
      if (undefined !== newPnt)
        pnt.set(newPnt.x, newPnt.y, newPnt.z);
    }
  }

  /** @internal */
  public transformNormalByModelDisplayTransform(modelId: string | undefined, normal: Vector3d): void {
    if (undefined !== modelId && undefined !== this.modelDisplayTransformProvider) {
      const transform = this.modelDisplayTransformProvider.getModelDisplayTransform(modelId, Transform.createIdentity());
      const newVec = transform.matrix.multiplyInverse(normal);
      if (undefined !== newVec) {
        newVec.normalizeInPlace();
        normal.set(newVec.x, newVec.y, newVec.z);
      }
    }
  }

  /** Invoked when this view becomes the view displayed by the specified [[Viewport]].
   * A ViewState can be attached to at most **one** Viewport.
   * @note If you override this method you **must** call `super.attachToViewport`.
   * @throws Error if the view is already attached to any Viewport.
   * @see [[detachFromViewport]] from the inverse operation.
   * @internal
   */
  public attachToViewport(_args: AttachToViewportArgs): void {
    if (this.isAttachedToViewport)
      throw new Error("Attempting to attach a ViewState that is already attached to a Viewport");

    this.registerCategorySelectorListeners();
  }

  private registerCategorySelectorListeners(): void {
    const cats = this.categorySelector.observableCategories;
    const event = () => this.onViewedCategoriesChanged.raiseEvent();
    this._unregisterCategorySelectorListeners.push(cats.onAdded.addListener(event));
    this._unregisterCategorySelectorListeners.push(cats.onDeleted.addListener(event));
    this._unregisterCategorySelectorListeners.push(cats.onCleared.addListener(event));
  }

  /** Invoked when this view, previously attached to the specified [[Viewport]] via [[attachToViewport]], is no longer the view displayed by that Viewport.
   * @note If you override this method you **must** call `super.detachFromViewport`.
   * @throws Error if the view is not attached to any Viewport.
   * @internal
   */
  public detachFromViewport(): void {
    if (!this.isAttachedToViewport)
      throw new Error("Attempting to detach a ViewState from a Viewport to which it is not attached.");

    this.unregisterCategorySelectorListeners();
  }

  private unregisterCategorySelectorListeners(): void {
    this._unregisterCategorySelectorListeners.forEach((f) => f());
    this._unregisterCategorySelectorListeners.length = 0;
  }

  /** Returns whether this view is currently being displayed by a [[Viewport]].
   * @public
   */
  public get isAttachedToViewport(): boolean {
    // In attachToViewport, we register event listeners on the category selector. We remove them in detachFromViewport.
    // So a non-empty list of event listener removal functions indicates we are currently attached to a viewport.
    return this._unregisterCategorySelectorListeners.length > 0;
  }

  /** Returns an iterator over additional Viewports used to construct this view's scene. e.g., those used for ViewAttachments and section drawings.
   * This exists chiefly for display-performance-test-app to determine when all tiles required for the view have been loaded.
   * @internal
   */
  public get secondaryViewports(): Iterable<Viewport> {
    return [];
  }
}

/** Defines the state of a view of 3d models.
 * @see [ViewState Parameters]($docs/learning/frontend/views#viewstate-parameters)
 * @public
 */
export abstract class ViewState3d extends ViewState {
  private readonly _details: ViewDetails3d;
  private readonly _modelClips: Array<RenderClipVolume | undefined> = [];
  private _environmentDecorations?: EnvironmentDecorations;
  /** @internal */
  public static override get className() { return "ViewDefinition3d"; }
  /** True if the camera is valid. */
  protected _cameraOn: boolean;
  /** The lower left back corner of the view frustum. */
  public readonly origin: Point3d;
  /** The extent of the view frustum. */
  public readonly extents: Vector3d;
  /** Rotation of the view frustum. */
  public readonly rotation: Matrix3d;
  /** The camera used for this view. */
  public readonly camera: Camera;
  /** Minimum distance for front plane */
  public forceMinFrontDist = 0.0;
  /** Provides access to optional detail settings for this view. */
  public get details(): ViewDetails3d {
    return this._details;
  }

  public allow3dManipulations(): boolean {
    return this.details.allow3dManipulations;
  }

  /** Set whether [[ViewTool]]s are allowed to operate in 3 dimensions on this view. */
  public setAllow3dManipulations(allow: boolean) {
    this.details.allow3dManipulations = allow;
  }

  public constructor(props: ViewDefinition3dProps, iModel: IModelConnection, categories: CategorySelectorState, displayStyle: DisplayStyle3dState) {
    super(props, iModel, categories, displayStyle);
    this._cameraOn = JsonUtils.asBool(props.cameraOn);
    this.origin = Point3d.fromJSON(props.origin);
    this.extents = Vector3d.fromJSON(props.extents);
    this.rotation = YawPitchRollAngles.fromJSON(props.angles).toMatrix3d();
    assert(this.rotation.isRigid());
    this.camera = new Camera(props.camera);

    // if the camera is on, make sure the eyepoint is centered.
    if (this.is3d() && this.isCameraOn)
      this.centerEyePoint();

    this._details = new ViewDetails3d(this.jsonProperties);
    this._details.onModelClipGroupsChanged.addListener((newGroups) => this.updateModelClips(newGroups));
    this.updateModelClips(this._details.modelClipGroups);

    this._updateMaxGlobalScopeFactor();
  }

  private updateModelClips(groups: ModelClipGroups): void {
    this._modelClips.length = 0;
    for (const group of groups.groups) {
      const clip = group.clip ? IModelApp.renderSystem.createClipVolume(group.clip) : undefined;
      this._modelClips.push(clip);
    }
  }

  /** @internal */
  public getModelClip(modelId: Id64String): RenderClipVolume | undefined {
    // ###TODO: ViewFlags.clipVolume is for the *view clip* only. Some tiles will want to ignore *all* clips (i.e., section-cut tiles).
    const index = this.details.modelClipGroups.findGroupIndex(modelId);
    return -1 !== index ? this._modelClips[index] : undefined;
  }

  /** @internal */
  public savePose(): ViewPose { return new ViewPose3d(this); }

  /** @internal */
  public applyPose(val: ViewPose3d): this {
    this._cameraOn = val.cameraOn;
    this.setOrigin(val.origin);
    this.setExtents(val.extents);
    this.rotation.setFrom(val.rotation);
    this.camera.setFrom(val.camera);
    this._updateMaxGlobalScopeFactor();
    return this;
  }

  public override toJSON(): ViewDefinition3dProps {
    const val = super.toJSON() as ViewDefinition3dProps;
    val.cameraOn = this._cameraOn;
    val.origin = this.origin;
    val.extents = this.extents;
    val.angles = YawPitchRollAngles.createFromMatrix3d(this.rotation)!.toJSON();
    val.camera = this.camera;
    return val;
  }

  /** @internal */
  public is3d(): this is ViewState3d { return true; }

  /** @internal */
  public isDrawingView(): this is DrawingViewState { return false; }

  public get isCameraOn(): boolean { return this._cameraOn; }

  private static _minGlobeEyeHeight = Constant.earthRadiusWGS84.equator / 4;  // View as globe if more than a quarter of earth radius from surface.
  private static _scratchGlobeCarto = Cartographic.createZero();

  public get isGlobalView() {
    if (undefined === this.iModel.ecefLocation)
      return false;

    return this.globalScopeFactor >= 1;
  }

  /** A value that represents the global scope of the view -- a value greater than one indicates that the scope of this view is global.
   * @see [[isGlobalView]].
   */
  public override get globalScopeFactor(): number {
    const eyeHeight = this.getEyeCartographicHeight();
    return (undefined === eyeHeight) ? (this.extents.magnitudeXY() / Constant.earthRadiusWGS84.equator) : (eyeHeight / ViewState3d._minGlobeEyeHeight);
  }

  /** A value representing the degree to which a view is viewing the globe as opposed to a specific location
   * a value of zero or less indicates that the view is not global, a value between zero and one represent a semi
   * global view.  Values greater than one indicate a global view.
   *
   * A Global view is arbitrarily designated as a camera view with the camera height greater than one fourth of the globe
   * radius or an orthographic view with view diagonal greater than one fourth of the globe radius.
   */
  public globalViewTransition(): number {
    if (undefined === this.iModel.ecefLocation)
      return 0.0;

    let h = 0.0;
    if (this.isCameraOn) {
      const carto = this.rootToCartographic(this.getEyePoint(), ViewState3d._scratchGlobeCarto);
      h = (undefined === carto ? 0.0 : carto.height);
    } else
      h = this.extents.magnitudeXY();

    const startTransition = 0.33333 * ViewState3d._minGlobeEyeHeight;
    if (h > ViewState3d._minGlobeEyeHeight)
      return 1.0;
    else if (h < startTransition)
      return 0.0;
    else
      return (h - startTransition) / (ViewState3d._minGlobeEyeHeight - startTransition);
  }

  public getCartographicHeight(point: XYAndZ): number | undefined {
    const ecefLocation = this.iModel.ecefLocation;
    if (undefined === ecefLocation)
      return undefined;

    const carto = this.rootToCartographic(point, ViewState3d._scratchGlobeCarto);
    return carto === undefined ? undefined : carto.height;
  }
  public getEyeCartographicHeight(): number | undefined {
    return this.isCameraOn ? this.getCartographicHeight(this.getEyePoint()) : undefined;
  }

  public isEyePointGlobalView(eyePoint: XYAndZ) {
    const cartoHeight = this.getCartographicHeight(eyePoint);
    return undefined === cartoHeight ? false : cartoHeight > ViewState3d._minGlobeEyeHeight;
  }

  /** Look at a global location, placing the camera's eye at the specified eye height above a viewed location.
   *  If location is defined, its center position will be viewed using the specified eye height.
   *  If location also has an area specified, the eye height will be adjusted to view the specified location based on that area.
   *  Otherwise, this function views a point on the earth as if the current eye point was placed on the earth. If the eyePoint parameter is defined, instead this point will be placed on the earth and viewed.
   *  Specify pitchAngleRadians to tilt the final view; this defaults to 0.
   *  Returns the distance from original eye point to new eye point.
   *  @public
   */
  public lookAtGlobalLocation(eyeHeight: number, pitchAngleRadians = 0, location?: GlobalLocation, eyePoint?: Point3d): number {
    if (!this.iModel.isGeoLocated)
      return 0;

    if (location !== undefined && location.area !== undefined)
      eyeHeight = areaToEyeHeight(this, location.area, location.center.height);

    const origEyePoint = eyePoint !== undefined ? eyePoint.clone() : this.getEyePoint().clone();

    let targetPoint = origEyePoint;
    const targetPointCartographic = location !== undefined ? location.center.clone() : this.rootToCartographic(targetPoint)!;
    targetPointCartographic.height = 0.0;
    targetPoint = this.cartographicToRoot(targetPointCartographic)!;

    targetPointCartographic.height = eyeHeight;
    const lEyePoint = this.cartographicToRoot(targetPointCartographic)!;
    return this.finishLookAtGlobalLocation(targetPointCartographic, origEyePoint, lEyePoint, targetPoint, pitchAngleRadians);
  }

  /** Look at a global location, placing the camera's eye at the specified eye height above a viewed location using the GCS.
   *  If location is defined, its center position will be viewed using the specified eye height.
   *  If location also has an area specified, the eye height will be adjusted to view the specified location based on that area.
   *  Otherwise, this function views a point on the earth as if the current eye point was placed on the earth. If the eyePoint parameter is defined, instead this point will be placed on the earth and viewed.
   *  Specify pitchAngleRadians to tilt the final view; this defaults to 0.
   *  Returns the distance from original eye point to new eye point.
   *  @public
   */
  public async lookAtGlobalLocationFromGcs(eyeHeight: number, pitchAngleRadians = 0, location?: GlobalLocation, eyePoint?: Point3d): Promise<number> {
    if (!this.iModel.isGeoLocated)
      return 0;

    if (location !== undefined && location.area !== undefined)
      eyeHeight = await areaToEyeHeightFromGcs(this, location.area, location.center.height);

    const origEyePoint = eyePoint !== undefined ? eyePoint.clone() : this.getEyeOrOrthographicViewPoint().clone();

    let targetPoint = origEyePoint;
    const targetPointCartographic = location !== undefined ? location.center.clone() : this.rootToCartographic(targetPoint)!;
    targetPointCartographic.height = 0.0;
    targetPoint = (await this.cartographicToRootFromGcs(targetPointCartographic))!;

    targetPointCartographic.height = eyeHeight;
    const lEyePoint = (await this.cartographicToRootFromGcs(targetPointCartographic))!;
    return this.finishLookAtGlobalLocation(targetPointCartographic, origEyePoint, lEyePoint, targetPoint, pitchAngleRadians);
  }

  private finishLookAtGlobalLocation(targetPointCartographic: Cartographic, origEyePoint: Point3d, eyePoint: Point3d, targetPoint: Point3d, pitchAngleRadians: number): number {
    targetPointCartographic.latitude += .001;
    const northOfEyePoint = this.cartographicToRoot(targetPointCartographic)!;
    let upVector = targetPoint.unitVectorTo(northOfEyePoint)!;
    if (this.globeMode === GlobeMode.Plane)
      upVector = Vector3d.create(Math.abs(upVector.x), Math.abs(upVector.y), Math.abs(upVector.z));

    if (0 !== pitchAngleRadians) {
      const pitchAxis = upVector.unitCrossProduct(Vector3d.createStartEnd(targetPoint, eyePoint));
      if (undefined !== pitchAxis) {
        const pitchMatrix = Matrix3d.createRotationAroundVector(pitchAxis, Angle.createRadians(pitchAngleRadians))!;
        const pitchTransform = Transform.createFixedPointAndMatrix(targetPoint, pitchMatrix);
        eyePoint = pitchTransform.multiplyPoint3d(eyePoint);
        pitchMatrix.multiplyVector(upVector, upVector);
      }
    }

    const isCameraEnabled = this.isCameraOn;
    this.lookAt({ eyePoint, targetPoint, upVector, lensAngle: this.camera.getLensAngle() });
    if (!isCameraEnabled && this.isCameraOn)
      this.turnCameraOff();

    return eyePoint.distance(origEyePoint);
  }

  /** Convert a point in spatial space to a cartographic coordinate. */
  public rootToCartographic(root: XYAndZ, result?: Cartographic): Cartographic | undefined {
    const backgroundMapGeometry = this.displayStyle.getBackgroundMapGeometry();
    return backgroundMapGeometry ? backgroundMapGeometry.dbToCartographic(root, result) : undefined;
  }

  /** Convert a cartographic coordinate to a point in spatial space. */
  public cartographicToRoot(cartographic: Cartographic, result?: Point3d): Point3d | undefined {
    const backgroundMapGeometry = this.displayStyle.getBackgroundMapGeometry();
    return backgroundMapGeometry ? backgroundMapGeometry.cartographicToDb(cartographic, result) : undefined;
  }

  /** Convert a point in spatial space to a cartographic coordinate using the GCS reprojection. */
  public async rootToCartographicFromGcs(root: XYAndZ, result?: Cartographic): Promise<Cartographic | undefined> {
    const backgroundMapGeometry = this.displayStyle.getBackgroundMapGeometry();
    return backgroundMapGeometry ? backgroundMapGeometry.dbToCartographicFromGcs(root, result) : undefined;
  }

  /** Convert a cartographic coordinate to a point in spatial space using the GCS reprojection. */
  public async cartographicToRootFromGcs(cartographic: Cartographic, result?: Point3d): Promise<Point3d | undefined> {
    const backgroundMapGeometry = this.displayStyle.getBackgroundMapGeometry();
    return backgroundMapGeometry ? backgroundMapGeometry.cartographicToDbFromGcs(cartographic, result) : undefined;
  }

  public override setupFromFrustum(frustum: Frustum, opts?: OnViewExtentsError): ViewStatus {
    const stat = super.setupFromFrustum(frustum, opts);
    if (ViewStatus.Success !== stat)
      return stat;

    this.turnCameraOff();
    const frustPts = frustum.points;

    // use comparison of back, front plane X sizes to indicate camera or flat view ...
    const xBack = frustPts[Npc.LeftBottomRear].distance(frustPts[Npc.RightBottomRear]);
    const xFront = frustPts[Npc.LeftBottomFront].distance(frustPts[Npc.RightBottomFront]);

    const flatViewFractionTolerance = 1.0e-6;
    if (xFront > xBack * (1.0 + flatViewFractionTolerance))
      return ViewStatus.InvalidWindow;

    // see if the frustum is tapered, and if so, set up camera eyepoint and adjust viewOrg and delta.
    const compression = xFront / xBack;
    if (compression >= (1.0 - flatViewFractionTolerance))
      return ViewStatus.Success;

    // the frustum has perspective, turn camera on
    let viewOrg = frustPts[Npc.LeftBottomRear];
    const viewDelta = this.getExtents().clone();
    const zDir = this.getZVector();
    const frustumZ = viewOrg.vectorTo(frustPts[Npc.LeftBottomFront]);
    const frustOrgToEye = frustumZ.scale(1.0 / (1.0 - compression));
    const eyePoint = viewOrg.plus(frustOrgToEye);

    const backDistance = frustOrgToEye.dotProduct(zDir);         // distance from eye to back plane of frustum
    const focusDistance = this.camera.isFocusValid ? this.camera.focusDist : (backDistance - (viewDelta.z / 2.0));
    const focalFraction = focusDistance / backDistance;           // ratio of focus plane distance to back plane distance

    viewOrg = eyePoint.plus2Scaled(frustOrgToEye, -focalFraction, zDir, focusDistance - backDistance);    // now project that point onto back plane
    viewDelta.x *= focalFraction;                                  // adjust view delta for x and y so they are also at focus plane
    viewDelta.y *= focalFraction;

    this.setEyePoint(eyePoint);
    this.setFocusDistance(focusDistance);
    this.setOrigin(viewOrg);
    this.setExtents(viewDelta);
    this.setLensAngle(this.calcLensAngle());
    this.enableCamera();
    this._updateMaxGlobalScopeFactor();
    return ViewStatus.Success;
  }

  protected static calculateMaxDepth(delta: Vector3d, zVec: Vector3d): number {
    const depthRatioLimit = 1.0E8;          // Limit for depth Ratio.
    const maxTransformRowRatio = 1.0E5;
    const minXYComponent = Math.min(Math.abs(zVec.x), Math.abs(zVec.y));
    const maxDepthRatio = (0.0 === minXYComponent) ? depthRatioLimit : Math.min((maxTransformRowRatio / minXYComponent), depthRatioLimit);
    return Math.max(delta.x, delta.y) * maxDepthRatio;
  }

  public getOrigin(): Point3d { return this.origin; }
  public getExtents(): Vector3d { return this.extents; }
  public getRotation(): Matrix3d { return this.rotation; }
  public setOrigin(origin: XYAndZ) { this.origin.setFrom(origin); }
  public setExtents(extents: XYAndZ) { this.extents.setFrom(extents); }
  public setRotation(rot: Matrix3d) { this.rotation.setFrom(rot); }
  /** @internal */
  protected enableCamera(): void {
    if (this.supportsCamera())
      this._cameraOn = true;
  }

  public supportsCamera(): boolean {
    return this.allow3dManipulations();
  }

  public minimumFrontDistance() {
    return Math.max(15.2 * Constant.oneCentimeter, this.forceMinFrontDist);
  }

  public isEyePointAbove(elevation: number): boolean {
    return !this._cameraOn ? (this.getZVector().z > 0) : (this.getEyePoint().z > elevation);
  }

  /** The style that controls how the contents of the view are displayed. */
  public override get displayStyle(): DisplayStyle3dState {
    return this.getDisplayStyle3d();
  }

  public override set displayStyle(style: DisplayStyle3dState) {
    assert(style instanceof DisplayStyle3dState);
    super.displayStyle = style;
  }

  /** The style that controls how the contents of the view are displayed.
   * @see [[ViewState3d.displayStyle]].
   */
  public getDisplayStyle3d() {
    return super.displayStyle as DisplayStyle3dState;
  }

  /** Turn the camera off for this view. After this call, the camera parameters in this view definition are ignored and views that use it will
   * display with an orthographic (infinite focal length) projection of the view volume from the view direction.
   * @note To turn the camera back on, call #lookAt
   */
  public turnCameraOff() { this._cameraOn = false; }

  /** Determine whether the camera is valid for this view */
  public get isCameraValid() { return this.camera.isValid; }

  /** Calculate the lens angle formed by the current delta and focus distance */
  public calcLensAngle(): Angle {
    return Angle.createRadians(2.0 * Math.atan2(this.extents.x * 0.5, this.camera.getFocusDistance()));
  }

  /** Get the target point of the view. If there is no camera, view center is returned. */
  public override getTargetPoint(result?: Point3d): Point3d {
    if (!this._cameraOn) {
      const earthFocalPoint = this.getEarthFocalPoint();
      return earthFocalPoint ? earthFocalPoint : super.getTargetPoint(result);
    }

    return this.getEyePoint().plusScaled(this.getZVector(), -1.0 * this.getFocusDistance(), result);
  }

  /** Setup view state for either perspective or orthographic view.
   * @returns A [[ViewStatus]] indicating whether the camera was successfully positioned.
   * @note If the aspect ratio of viewDelta does not match the aspect ratio of a Viewport into which this view is displayed, it will be
   * adjusted when the [[Viewport]] is synchronized from this view.
   * @beta
   */
  public lookAt(args: LookAtPerspectiveArgs | LookAtOrthoArgs | LookAtUsingLensAngle): ViewStatus {
    if (args.lensAngle) {
      const lensAngle = args.lensAngle;
      const eyePoint = Vector3d.createFrom(args.eyePoint);
      const focus = eyePoint.vectorTo(args.targetPoint).magnitude();   // Set focus at target point

      if (focus <= Constant.oneMillimeter)       // eye and target are too close together
        return ViewStatus.InvalidTargetPoint;

      if (lensAngle.radians < .0001 || lensAngle.radians > Math.PI)
        return ViewStatus.InvalidLens;

      const width = 2.0 * Math.tan(lensAngle.radians / 2.0) * focus;
      const newExtents = Vector2d.createFrom(args.newExtents ?? this.extents);
      newExtents.scale(width / newExtents.x, newExtents);
      args = { ...args, newExtents };
    }

    const isPerspective = undefined !== args.targetPoint;
    if (isPerspective && !this.supportsCamera())
      return ViewStatus.NotCameraView;

    const eye = new Point3d(args.eyePoint.x, args.eyePoint.y, args.eyePoint.z);
    const yVec = args.upVector.normalize();
    if (!yVec) // up vector zero length?
      return ViewStatus.InvalidUpVector;

    let zVec: Vector3d;
    let focusDist: number;
    if (args.targetPoint) {
      zVec = Vector3d.createStartEnd(args.targetPoint, eye); // z defined by direction from eye to target
      focusDist = zVec.normalizeWithLength(zVec).mag; // set focus at target point
    } else {
      zVec = Vector3d.createFrom(args.viewDirection).negate();
      if (!zVec.normalizeInPlace())
        return ViewStatus.InvalidDirection;
      focusDist = this.getFocusDistance();
    }
    const minFrontDist = this.minimumFrontDistance();

    if (focusDist <= minFrontDist) { // eye and target are too close together
      args.opts?.onExtentsError?.(ViewStatus.InvalidTargetPoint);
      return ViewStatus.InvalidTargetPoint;
    }

    const xVec = new Vector3d();
    if (yVec.crossProduct(zVec).normalizeWithLength(xVec).mag < Geometry.smallMetricDistance)
      return ViewStatus.InvalidUpVector;    // up is parallel to z

    if (zVec.crossProduct(xVec).normalizeWithLength(yVec).mag < Geometry.smallMetricDistance)
      return ViewStatus.InvalidUpVector;

    // we now have rows of the rotation matrix
    const rotation = Matrix3d.createRows(xVec, yVec, zVec);

    let backDist = args.backDistance ? args.backDistance : this.getBackDistance();
    let frontDist = args.frontDistance ? args.frontDistance : this.getFrontDistance();

    const delta = args.newExtents ? new Vector3d(Math.abs(args.newExtents.x), Math.abs(args.newExtents.y), this.extents.z) : this.extents.clone();

    // The front/back distance are relatively arbitrary -- the frustum will be adjusted to include geometry.
    // Set them here to reasonable in front of eye and just beyond target.
    frontDist = Math.min(frontDist, (.5 * Constant.oneMeter));
    backDist = Math.min(backDist, focusDist + (.5 * Constant.oneMeter));

    if (backDist < focusDist) // make sure focus distance is in front of back distance.
      backDist = focusDist + Constant.oneMillimeter;

    if (frontDist > focusDist)
      frontDist = focusDist - minFrontDist;

    if (frontDist < minFrontDist)
      frontDist = minFrontDist;

    delta.z = (backDist - frontDist);

    const stat = this.adjustViewDelta(delta, eye, rotation, undefined, args.opts);
    if (ViewStatus.Success !== stat)
      return stat;

    if (delta.z > ViewState3d.calculateMaxDepth(delta, zVec)) // make sure we're not zoomed out too far
      return ViewStatus.MaxDisplayDepth;

    // The origin is defined as the lower left of the view rectangle on the focus plane, projected to the back plane.
    // Start at eye point, and move to center of back plane, then move left half of width. and down half of height
    const origin = eye.plus3Scaled(zVec, -backDist, xVec, -0.5 * delta.x, yVec, -0.5 * delta.y);

    this.setEyePoint(args.eyePoint);
    this.setRotation(rotation);
    this.setFocusDistance(focusDist);
    this.setOrigin(origin);
    this.setExtents(delta);
    this.setLensAngle(this.calcLensAngle());
    if (isPerspective)
      this.enableCamera();
    else
      this.turnCameraOff();
    this._updateMaxGlobalScopeFactor();
    return ViewStatus.Success;
  }

  /** Change the focus distance for this ViewState3d. Preserves the content of the view.
   * @internal
   */
  public changeFocusDistance(newDist: number): ViewStatus {
    if (newDist <= Constant.oneMillimeter)
      return ViewStatus.InvalidTargetPoint;

    const oldExtents = this.extents.clone(); // save current extents so we can keep frustum unchanged
    this.extents.x = 2.0 * Math.tan(this.camera.lens.radians / 2.0) * newDist; // new width based on focus distance and lens angle.
    this.extents.y = this.extents.y * (this.extents.x / oldExtents.x); // preserve aspect ratio
    this.origin.addScaledInPlace(this.rotation.multiplyTransposeVector(this.extents.vectorTo(oldExtents)), .5); // move origin by half the change in extents
    this.camera.focusDist = newDist; // save new focus distance
    return ViewStatus.Success;
  }

  /** Change the focus distance for this ViewState3d to be defined by the the supplied point, if it is in front of the camera.
   * Preserves the content of the view.
   * @internal
   */
  public changeFocusFromPoint(pt: Point3d) {
    return this.changeFocusDistance(this.getZVector().dotProduct(pt.vectorTo(this.camera.eye)));
  }

  /** Move the camera relative to its current location by a distance in camera coordinates.
   * @param distance to move camera. Length is in world units, direction relative to current camera orientation.
   * @returns Status indicating whether the camera was successfully positioned. See values at [[ViewStatus]] for possible errors.
   */
  public moveCameraLocal(distance: Vector3d): ViewStatus {
    const distWorld = this.rotation.multiplyTransposeVector(distance);
    return this.moveCameraWorld(distWorld);
  }

  /** Move the camera relative to its current location by a distance in world coordinates.
   * @param distance in world units.
   * @returns Status indicating whether the camera was successfully positioned. See values at [[ViewStatus]] for possible errors.
   */
  public moveCameraWorld(distance: Vector3d): ViewStatus {
    if (!this._cameraOn) {
      this.origin.plus(distance, this.origin);
      return ViewStatus.Success;
    }

    const targetPoint = this.getTargetPoint().plus(distance);
    const eyePoint = this.getEyePoint().plus(distance);
    return this.lookAt({ eyePoint, targetPoint, upVector: this.getYVector() });
  }

  /** Rotate the camera from its current location about an axis relative to its current orientation.
   * @param angle The angle to rotate the camera.
   * @param axis The axis about which to rotate the camera. The axis is a direction relative to the current camera orientation.
   * @param aboutPt The point, in world coordinates, about which the camera is rotated. If aboutPt is undefined, the camera rotates in place
   *  (i.e. about the current eyePoint).
   * @note Even though the axis is relative to the current camera orientation, the aboutPt is in world coordinates, \b not relative to the camera.
   * @returns Status indicating whether the camera was successfully positioned. See values at [[ViewStatus]] for possible errors.
   */
  public rotateCameraLocal(angle: Angle, axis: Vector3d, aboutPt?: Point3d): ViewStatus {
    const axisWorld = this.getRotation().multiplyTransposeVector(axis);
    return this.rotateCameraWorld(angle, axisWorld, aboutPt);
  }

  /** Rotate the camera from its current location about an axis in world coordinates.
   * @param angle The angle to rotate the camera.
   * @param axis The world-based axis (direction) about which to rotate the camera.
   * @param aboutPt The point, in world coordinates, about which the camera is rotated. If aboutPt is undefined, the camera rotates in place
   *  (i.e. about the current eyePoint).
   * @returns Status indicating whether the camera was successfully positioned. See values at [[ViewStatus]] for possible errors.
   */
  public rotateCameraWorld(angle: Angle, axis: Vector3d, aboutPt?: Point3d): ViewStatus {
    const about = aboutPt ? aboutPt : this.getEyePoint();
    const rotation = Matrix3d.createRotationAroundVector(axis, angle);
    if (!rotation)
      return ViewStatus.InvalidUpVector;    // Invalid axis given
    const trans = Transform.createFixedPointAndMatrix(about, rotation);
    const targetPoint = trans.multiplyPoint3d(this.getTargetPoint());
    const upVector = rotation.multiplyVector(this.getYVector());
    return this.lookAt({ eyePoint: this.getEyePoint(), targetPoint, upVector });
  }

  /** Move camera about the global ellipsoid. This rotates the camera position about the center of the global ellipsoid maintaining the current height.
   * @param fromPoint Point to pan from.
   * @param point Point to point to.
   * @returns Status indicating whether the camera was successfully positioned. See values at [[ViewStatus]] for possible errors.
   */
  public moveCameraGlobal(fromPoint: Point3d, toPoint: Point3d): ViewStatus {
    if (!this.iModel.ecefLocation)
      return ViewStatus.NotGeolocated;

    if (this.globeMode !== GlobeMode.Ellipsoid)
      return ViewStatus.NotEllipsoidGlobeMode;

    const earthCenter = this.iModel.ecefLocation?.earthCenter;
    const rMatrix = Matrix3d.createRotationVectorToVector(Vector3d.createStartEnd(earthCenter, toPoint), Vector3d.createStartEnd(earthCenter, fromPoint));
    if (!rMatrix)
      return ViewStatus.DegenerateGeometry;

    const rotationTransform = Transform.createFixedPointAndMatrix(earthCenter, rMatrix);
    const frustum = this.calculateFrustum();
    if (!frustum)
      return ViewStatus.DegenerateGeometry;

    frustum.multiply(rotationTransform);
    return this.setupFromFrustum(frustum);
  }

  /** Get the distance from the eyePoint to the front plane for this view. */
  public getFrontDistance(): number { return this.getBackDistance() - this.extents.z; }

  /** Get the distance from the eyePoint to the back plane for this view. */
  public getBackDistance(): number {
    // backDist is the z component of the vector from the origin to the eyePoint .
    const eyeOrg = this.origin.vectorTo(this.getEyePoint());
    this.getRotation().multiplyVector(eyeOrg, eyeOrg);
    return eyeOrg.z;
  }

  /** Place the eyepoint of the camera so it is aligned with the center of the view. This removes any 1-point perspective skewing that may be
   * present in the current view.
   * @param backDistance If defined, the new the distance from the eyepoint to the back plane. Otherwise the distance from the
   * current eyepoint is used.
   */
  public centerEyePoint(backDistance?: number): void {
    const eyePoint = this.getExtents().scale(0.5);
    eyePoint.z = backDistance ? backDistance : this.getBackDistance();
    const eye = this.getOrigin().plus(this.getRotation().multiplyTransposeXYZ(eyePoint.x, eyePoint.y, eyePoint.z));
    this.camera.setEyePoint(eye);
  }

  /** Center the focus distance of the camera halfway between the front plane and the back plane, keeping the eyepoint,
   * lens angle, rotation, back distance, and front distance unchanged.
   * @note The focus distance, origin, and delta values are modified, but the view encloses the same volume and appears visually unchanged.
   */
  public centerFocusDistance(): void {
    const backDistance = this.getBackDistance();
    const frontDistance = this.getFrontDistance();
    const eyePoint = this.getEyePoint();
    const targetPoint = eyePoint.plusScaled(this.getZVector(), frontDistance - backDistance);
    this.lookAt({ eyePoint, targetPoint, upVector: this.getYVector(), lensAngle: this.getLensAngle(), frontDistance, backDistance });
  }

  /** Ensure the focus plane lies between the front and back planes. If not, center it. */
  public verifyFocusPlane(): void {
    if (!this._cameraOn)
      return;

    let backDist = this.getBackDistance();
    const frontDist = backDist - this.extents.z;
    const camera = this.camera;
    const extents = this.extents;
    const rot = this.rotation;

    if (backDist <= 0.0 || frontDist <= 0.0) {
      // the camera location is invalid. Set it based on the view range.
      const tanAngle = Math.tan(camera.lens.radians / 2.0);
      backDist = extents.z / tanAngle;
      camera.setFocusDistance(backDist / 2);
      this.centerEyePoint(backDist);
      return;
    }

    const focusDist = camera.focusDist;
    if (focusDist > frontDist && focusDist < backDist)
      return;

    // put it halfway between front and back planes
    camera.setFocusDistance((extents.z / 2.0) + frontDist);

    // moving the focus plane means we have to adjust the origin and delta too (they're on the focus plane, see diagram above)
    const ratio = camera.focusDist / focusDist;
    extents.x *= ratio;
    extents.y *= ratio;
    camera.eye.plus3Scaled(rot.rowZ(), -backDist, rot.rowX(), -0.5 * extents.x, rot.rowY(), -0.5 * extents.y, this.origin); // this centers the camera too
  }

  /** Get the current location of the eyePoint for camera in this view. */
  public getEyePoint(): Point3d { return this.camera.eye; }

  /** Get the lens angle for this view. */
  public getLensAngle(): Angle { return this.camera.lens; }

  /** Set the lens angle for this view.
   *  @param angle The new lens angle in radians. Must be greater than 0 and less than pi.
   *  @note This does not change the view's current field-of-view. Instead, it changes the lens that will be used if the view
   *  is subsequently modified and the lens angle is used to position the eyepoint.
   *  @note To change the field-of-view (i.e. "zoom") of a view, pass a new viewDelta to #lookAt
   */
  public setLensAngle(angle: Angle): void { this.camera.setLensAngle(angle); }

  /** Change the location of the eyePoint for the camera in this view.
   * @param pt The new eyepoint.
   * @note This method is generally for internal use only. Moving the eyePoint arbitrarily can result in skewed or illegal perspectives.
   * The most common method for user-level camera positioning is #lookAt.
   */
  public setEyePoint(pt: XYAndZ): void { this.camera.setEyePoint(pt); }

  /** Set the focus distance for this view.
   *  @note Changing the focus distance changes the plane on which the delta.x and delta.y values lie. So, changing focus distance
   *  without making corresponding changes to delta.x and delta.y essentially changes the lens angle, causing a "zoom" effect
   */
  public setFocusDistance(dist: number): void { this.camera.setFocusDistance(dist); }

  /**  Get the distance from the eyePoint to the focus plane for this view. */
  public getFocusDistance(): number { return this.camera.focusDist; }

  /** @internal */
  public getEyeOrOrthographicViewPoint(): Point3d {
    if (this.isCameraOn)
      return this.camera.getEyePoint();

    this.camera.validateLens();
    const tanHalfAngle = Math.tan(this.camera.lens.radians / 2);
    const halfDelta = this.getExtents().magnitudeXY();
    const eyeDistance = tanHalfAngle ? (halfDelta / tanHalfAngle) : 0;
    const zVector = this.getRotation().getRow(2);

    return this.getCenter().plusScaled(zVector, - eyeDistance);
  }
  public createAuxCoordSystem(acsName: string): AuxCoordSystemState { return AuxCoordSystem3dState.createNew(acsName, this.iModel); }

  public override decorate(context: DecorateContext): void {
    super.decorate(context);
    if (this._environmentDecorations)
      this._environmentDecorations.decorate(context);
  }

  /** Returns the ground elevation taken from the environment added with the global z position of this imodel. */
  public getGroundElevation(): number {
    const env = this.getDisplayStyle3d().environment;
    return env.ground.elevation + this.iModel.globalOrigin.z;
  }

  /** Return the ground extents, which will originate either from the viewport frustum or the extents of the imodel. */
  public getGroundExtents(vp?: Viewport): AxisAlignedBox3d {
    const displayStyle = this.getDisplayStyle3d();
    const extents = new Range3d();
    if (!displayStyle.environment.displayGround)
      return extents; // Ground plane is not enabled

    const elevation = this.getGroundElevation();

    if (undefined !== vp) {
      const viewRay = Ray3d.create(Point3d.create(), vp.rotation.rowZ());
      const xyPlane = Plane3dByOriginAndUnitNormal.create(Point3d.create(0, 0, elevation), Vector3d.create(0, 0, 1));

      // first determine whether the ground plane is displayed in the view
      const worldFrust = vp.getFrustum();
      for (const point of worldFrust.points) {
        viewRay.origin = point;   // We never modify the reference
        const xyzPoint = Point3d.create();
        const param = viewRay.intersectionWithPlane(xyPlane!, xyzPoint);
        if (param === undefined)
          return extents;   // View does not show ground plane
      }
    }

    extents.setFrom(this.iModel.projectExtents);
    extents.low.z = extents.high.z = elevation;

    const center = extents.low.interpolate(.5, extents.high);

    const radius = extents.low.distance(extents.high);
    extents.setNull();
    extents.extendPoint(center);  // Extents now contains single point
    extents.low.addScaledInPlace(Vector3d.create(-1, -1, -1), radius);
    extents.high.addScaledInPlace(Vector3d.create(1, 1, 1), radius);
    extents.low.z = extents.high.z = elevation;
    return extents;
  }

  /** @internal */
  public override getModelElevation(modelId: Id64String): number {
    const settings = this.getDisplayStyle3d().settings.getPlanProjectionSettings(modelId);
    return settings && settings.elevation ? settings.elevation : 0;
  }

  /** If the background map is displayed, return the point on the globe in directly front of the eye (or in center of view if camera off)
   *  This is generally a better target point for orthographic views than the view center which can be far from the area of interest.
   * @public
   */
  public getEarthFocalPoint(): Point3d | undefined {
    if (!this.iModel.ecefLocation || this.globeMode !== GlobeMode.Ellipsoid)
      return undefined;

    const backgroundMapGeometry = this.displayStyle.getBackgroundMapGeometry();
    if (undefined === backgroundMapGeometry)
      return undefined;

    const earthEllipsoid = backgroundMapGeometry.getEarthEllipsoid();
    const viewZ = this.getRotation().rowZ();
    const center = this.getCenter();
    const eye = this.isCameraOn ? this.camera.getEyePoint() : center.plusScaled(viewZ, Constant.diameterOfEarth);
    const eyeRay = Ray3d.create(eye, viewZ);
    const fractions = new Array<number>(), points = new Array<Point3d>();

    if (earthEllipsoid.intersectRay(eyeRay, fractions, points, undefined)) {
      let fraction = -1.0E10, index = -1;
      for (let i = 0; i < fractions.length; i++)
        if (fractions[i] > fraction) {
          fraction = fractions[i];
          index = i;
        }
      return (index >= 0 && fraction < 0) ? points[index] : undefined;
    } else {
      return eyeRay.projectPointToRay(center);
    }
  }

  /**
   * For a geoLocated project, align the view with the global ellipsoid by rotating
   * around the supplied target point such that the view axis points toward the
   * globe center. If the viewing height is below the global transition threshold.
   * @param target The rotation target or pivot point.  This point will remain stationary in the view.
   * @param transition If this is defined and true then the rotation is scaled by the [[ViewState.globalViewTransition]]  This
   * will cause a smooth transition as a view is zoomed out from a specific location to a more global representation.
   * @public
   */
  public alignToGlobe(target: Point3d, transition?: boolean): ViewStatus {
    if (!this.iModel.ecefLocation)
      return ViewStatus.NotGeolocated;

    if (this.globeMode !== GlobeMode.Ellipsoid)
      return ViewStatus.NotEllipsoidGlobeMode;

    const globalTransition = this.globalViewTransition();

    if (globalTransition <= 0)
      return ViewStatus.HeightBelowTransition;

    const earthCenter = this.iModel.ecefLocation?.earthCenter;
    const viewCenter = this.getCenter();
    const viewZ = this.getRotation().rowZ();
    const eye = this.isCameraOn ? this.camera.eye : viewCenter.plusScaled(viewZ, Constant.diameterOfEarth);

    const centerToEye = earthCenter.unitVectorTo(eye);
    if (!centerToEye)
      return ViewStatus.DegenerateGeometry;

    const axis = viewZ.unitCrossProduct(centerToEye);
    if (!axis)
      return ViewStatus.DegenerateGeometry;

    const theta = viewZ.angleTo(centerToEye);
    if (theta.radians > Angle.piOver2Radians)
      return ViewStatus.DegenerateGeometry;

    if (theta.isAlmostZero)
      return ViewStatus.NoTransitionRequired;

    const transitionRotation = Matrix3d.createRotationAroundVector(axis, transition ? theta.cloneScaled(globalTransition) : theta);
    if (!transitionRotation)
      return ViewStatus.DegenerateGeometry;

    const transitionTransform = Transform.createFixedPointAndMatrix(target, transitionRotation);
    const frustum = this.calculateFrustum();
    if (!frustum)
      return ViewStatus.DegenerateGeometry;

    frustum.multiply(transitionTransform);
    return this.setupFromFrustum(frustum);
  }

  /** @internal */
  public override attachToViewport(args: AttachToViewportArgs): void {
    super.attachToViewport(args);

    const removeListener = this.displayStyle.settings.onEnvironmentChanged.addListener((env) => {
      this._environmentDecorations?.setEnvironment(env);
    });

    this._environmentDecorations = new EnvironmentDecorations(this, () => args.invalidateDecorations(), () => removeListener());
  }

  public override detachFromViewport(): void {
    super.detachFromViewport();
    this._environmentDecorations = dispose(this._environmentDecorations);
  }
}

/** Defines the state of a view of a single 2d model.
 * @public
 */
export abstract class ViewState2d extends ViewState {
  private readonly _details: ViewDetails;
  /** @internal */
  public static override get className() { return "ViewDefinition2d"; }
  public readonly origin: Point2d;
  public readonly delta: Point2d;
  public readonly angle: Angle;
  protected _baseModelId: Id64String;
  public get baseModelId(): Id64String { return this._baseModelId; }
  /** @internal */
  protected _treeRef?: TileTreeReference;

  /** @internal */
  protected get _tileTreeRef(): TileTreeReference | undefined {
    if (undefined === this._treeRef) {
      const model = this.getViewedModel();
      if (undefined !== model)
        this._treeRef = model.createTileTreeReference(this);
    }

    return this._treeRef;
  }

  public constructor(props: ViewDefinition2dProps, iModel: IModelConnection, categories: CategorySelectorState, displayStyle: DisplayStyle2dState) {
    super(props, iModel, categories, displayStyle);
    this.origin = Point2d.fromJSON(props.origin);
    this.delta = Point2d.fromJSON(props.delta);
    this.angle = Angle.fromJSON(props.angle);
    this._baseModelId = Id64.fromJSON(props.baseModelId);
    this._details = new ViewDetails(this.jsonProperties);
  }

  public override toJSON(): ViewDefinition2dProps {
    const val = super.toJSON() as ViewDefinition2dProps;
    val.origin = this.origin;
    val.delta = this.delta;
    val.angle = this.angle;
    val.baseModelId = this.baseModelId;
    return val;
  }

  /** @internal */
  public is3d(): this is ViewState3d { return false; }

  /** @internal */
  public isSpatialView(): this is SpatialViewState { return false; }

  /** @internal */
  public savePose(): ViewPose { return new ViewPose2d(this); }

  /** @internal */
  public applyPose(val: ViewPose2d) {
    this.setOrigin(val.origin);
    this.setExtents(val.delta);
    this.angle.setFrom(val.angle);
    return this;
  }

  /** Return the model for this 2d view. */
  public getViewedModel(): GeometricModel2dState | undefined {
    const model = this.iModel.models.getLoaded(this.baseModelId);
    if (model && !(model instanceof GeometricModel2dState))
      return undefined;

    return model;
  }

  /** Change the model viewed by this view.
   * @note The new model should be of the same type (drawing or sheet) as the current viewed model.
   * @throws Error if attempting to change the viewed model while the view is attached to a viewport.
   * @see [[Viewport.changeViewedModel2d]].
   * @public
   */
  public async changeViewedModel(newViewedModelId: Id64String): Promise<void> {
    if (this.isAttachedToViewport)
      throw new Error("Cannot change the viewed model of a view that is attached to a viewport.");

    this._baseModelId = newViewedModelId;
    this._treeRef = undefined;
    await this.load();
  }

  public computeFitRange(): Range3d {
    return this.getViewedExtents();
  }

  public override async load(): Promise<void> {
    await super.load();
    return this.iModel.models.load(this.baseModelId);
  }

  /** Provides access to optional detail settings for this view. */
  public get details(): ViewDetails {
    return this._details;
  }

  public allow3dManipulations(): boolean { return false; }
  public getOrigin() { return new Point3d(this.origin.x, this.origin.y, Frustum2d.minimumZExtents.low); }
  public getExtents() { return new Vector3d(this.delta.x, this.delta.y, Frustum2d.minimumZExtents.length()); }
  public getRotation() { return Matrix3d.createRotationAroundVector(Vector3d.unitZ(), this.angle)!; }
  public setExtents(delta: XAndY) { this.delta.set(delta.x, delta.y); }
  public setOrigin(origin: XAndY) { this.origin.set(origin.x, origin.y); }
  public setRotation(rot: Matrix3d) { const xColumn = rot.getColumn(0); this.angle.setRadians(Math.atan2(xColumn.y, xColumn.x)); }
  public viewsModel(modelId: Id64String) { return this.baseModelId === modelId; }
  public forEachModel(func: (model: GeometricModelState) => void) {
    const model = this.iModel.models.getLoaded(this.baseModelId);
    if (undefined !== model && undefined !== model.asGeometricModel2d)
      func(model as GeometricModel2dState);
  }

  /** @internal */
  public override forEachModelTreeRef(func: (ref: TileTreeReference) => void): void {
    const ref = this._tileTreeRef;
    if (undefined !== ref)
      func(ref);
  }

  public createAuxCoordSystem(acsName: string): AuxCoordSystemState { return AuxCoordSystem2dState.createNew(acsName, this.iModel); }
}
