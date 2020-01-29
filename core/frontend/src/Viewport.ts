/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { assert, BeDuration, BeEvent, BeTimePoint, compareStrings, dispose, Id64, Id64Arg, Id64Set, Id64String, IDisposable, SortedArray, StopWatch } from "@bentley/bentleyjs-core";
import {
  Angle, AngleSweep, Arc3d, LowAndHighXY, LowAndHighXYZ, Map4d,
  Matrix3d, Plane3dByOriginAndUnitNormal, Point2d, Point3d, Point4d, Range3d, Ray3d, Transform, Vector3d, XAndY, XYAndZ, XYZ, Geometry,
} from "@bentley/geometry-core";
import {
  AnalysisStyle, BackgroundMapProps, BackgroundMapSettings, Camera, ColorDef, ElementProps, Frustum, Hilite, ImageBuffer, NpcCenter,
  Placement2d, Placement2dProps, Placement3d, Placement3dProps, PlacementProps, SubCategoryAppearance, SubCategoryOverride, ViewFlags, Tweens, EasingFunction, Interpolation, Easing,
} from "@bentley/imodeljs-common";
import { AuxCoordSystemState } from "./AuxCoordSys";
import { DisplayStyleState } from "./DisplayStyleState";
import { ElementPicker, LocateOptions } from "./ElementLocateManager";
import { HitDetail, SnapDetail } from "./HitDetail";
import { IModelApp } from "./IModelApp";
import { IModelConnection } from "./IModelConnection";
import { ToolTipOptions } from "./NotificationManager";
import { FeatureSymbology } from "./render/FeatureSymbology";
import { GraphicType } from "./render/GraphicBuilder";
import { GraphicList } from "./render/RenderGraphic";
import { RenderPlan } from "./render/RenderPlan";
import { Pixel } from "./render/Pixel";
import { Decorations } from "./render/Decorations";
import { RenderTarget } from "./render/RenderTarget";
import { RenderMemory } from "./render/RenderSystem";
import { StandardView, StandardViewId } from "./StandardView";
import { SubCategoriesCache } from "./SubCategoriesCache";
import { TileTreeReference, TileTreeSet, TileBoundingBoxes } from "./tile/internal";
import { EventController } from "./tools/EventController";
import { DecorateContext, SceneContext } from "./ViewContext";
import { GridOrientationType, MarginPercent, ViewState, ViewStatus, ViewPose, ViewState2d, ViewPose3d, ViewState3d } from "./ViewState";
import { ViewRect } from "./ViewRect";
import { ViewingSpace } from "./ViewingSpace";
import { ToolSettings } from "./tools/ToolSettings";

// cSpell:Ignore rect's ovrs subcat subcats unmounting UI's

/** An object that customizes the appearance of Features within a [[Viewport]].
 * Only one FeatureOverrideProvider may be associated with a viewport at a time. Setting a new FeatureOverrideProvider replaces any existing provider.
 *
 * If the provider's internal state changes such that the Viewport should recompute the symbology overrides, the provider should notify the viewport by
 * calling [[Viewport.setFeatureOverrideProviderChanged]].
 * @see [[Viewport.featureOverrideProvider]]
 * @public
 */
export interface FeatureOverrideProvider {
  /** Add to the supplied `overrides` any symbology overrides to be applied to the specified `viewport`. */
  addFeatureOverrides(overrides: FeatureSymbology.Overrides, viewport: Viewport): void;
}

/** Provides a way for applications to inject additional non-decorative graphics into a [[Viewport]] by supplying one or more [[TileTreeReference]]s capable of loading and drawing the graphics.
 * Typical use cases involve drawing cartographic imagery like weather, traffic conditions, etc.
 * @see [[MapTileTreeReference]] and [[MapImageryTileTreeReference]] for examples of ways to create a TileTree reference.
 * @see [[Viewport.addTiledGraphicsProvider]] and [[Viewport.dropTiledGraphicsProvider]].
 * @internal
 */
export interface TiledGraphicsProvider {
  /** Apply the supplied function to each [[TileTreeReference]] to be drawn in the specified Viewport. */
  forEachTileTreeRef(viewport: Viewport, func: (ref: TileTreeReference) => void): void;
}

/** @see [[ChangeFlags]]
 * @beta
 */
export enum ChangeFlag {
  None = 0,
  AlwaysDrawn = 1 << 0,
  NeverDrawn = 1 << 1,
  ViewedCategories = 1 << 2,
  ViewedModels = 1 << 3,
  DisplayStyle = 1 << 4,
  FeatureOverrideProvider = 1 << 5,
  ViewedCategoriesPerModel = 1 << 6,
  ViewState = 1 << 7,
  All = 0x0fffffff,
  Overrides = ChangeFlag.All & ~(ChangeFlag.ViewedModels | ChangeFlag.ViewState),
  Initial = ChangeFlag.ViewedCategories | ChangeFlag.ViewedModels | ChangeFlag.DisplayStyle,
}

/** Viewport event synchronization flags. Used primarily for tracking changes that affect the viewport's [[FeatureSymbology.Overrides]].
 * Each time [[Viewport.renderFrame]] is invoked, the effects of any changes to these flags will be applied, and corresponding events dispatched.
 * An individual flag is true if the corresponding Viewport state has changed and needs to be synchronized.
 * @beta
 */
export class ChangeFlags {
  private _flags: ChangeFlag;

  /** The set of always drawn elements has changed. */
  public get alwaysDrawn() { return this.isSet(ChangeFlag.AlwaysDrawn); }
  public setAlwaysDrawn() { this.set(ChangeFlag.AlwaysDrawn); }
  /** The set of never drawn elements has changed. */
  public get neverDrawn() { return this.isSet(ChangeFlag.NeverDrawn); }
  public setNeverDrawn() { this.set(ChangeFlag.NeverDrawn); }
  /** The set of displayed categories has changed. */
  public get viewedCategories() { return this.isSet(ChangeFlag.ViewedCategories); }
  public setViewedCategories() { this.set(ChangeFlag.ViewedCategories); }
  /** The set of displayed models has changed. */
  public get viewedModels() { return this.isSet(ChangeFlag.ViewedModels); }
  public setViewedModels() { this.set(ChangeFlag.ViewedModels); }
  /** The display style or its settings such as [ViewFlags]($common) have changed. */
  public get displayStyle() { return this.isSet(ChangeFlag.DisplayStyle); }
  public setDisplayStyle() { this.set(ChangeFlag.DisplayStyle); }
  /** The [[FeatureOverrideProvider]] has changed, or its internal state has changed such that its overrides must be recomputed. */
  public get featureOverrideProvider() { return this.isSet(ChangeFlag.FeatureOverrideProvider); }
  public setFeatureOverrideProvider() { this.set(ChangeFlag.FeatureOverrideProvider); }
  /** [[changeView]] was used to replace the previous [[ViewState]] with a new one. */
  public get viewState() { return this.isSet(ChangeFlag.ViewState); }
  public setViewState() { this.set(ChangeFlag.ViewState); }
  /** The [[PerModelCategoryVisibility.Overrides]] associated with the viewport have changed.
   * @alpha
   */
  public get viewedCategoriesPerModel() { return this.isSet(ChangeFlag.ViewedCategoriesPerModel); }
  public setViewedCategoriesPerModel() { this.set(ChangeFlag.ViewedCategoriesPerModel); }

  public constructor(flags = ChangeFlag.Initial) { this._flags = flags; }

  /** Return true if any of the specified flags are set. */
  public isSet(flags: ChangeFlag): boolean { return 0 !== (this._flags & flags); }
  /** Return true if all of the specified flags are set. */
  public areAllSet(flags: ChangeFlag): boolean { return flags === (this._flags & flags); }
  /** Set all of the specified flags. */
  public set(flags: ChangeFlag): void { this._flags |= flags; }
  /** Clear all of the specified flags. By default, clears all flags. */
  public clear(flags: ChangeFlag = ChangeFlag.All): void { this._flags &= ~flags; }
  /** Returns true if any flag affecting FeatureSymbology.Overrides is set. */
  public get areFeatureOverridesDirty() { return this.isSet(ChangeFlag.Overrides); }
  /** Returns true if any flag is set. */
  public get hasChanges() { return this.isSet(ChangeFlag.All); }

  public get value(): ChangeFlag { return this._flags; }
}

/** @alpha Source of depth point returned by [[Viewport.pickDepthPoint]]. */
export enum DepthPointSource {
  /** Depth point from geometry within specified radius of pick point */
  Geometry,
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
}

/** @alpha Options to control behavior of [[Viewport.pickDepthPoint]]. */
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

/** Coordinate system types
 * @public
 */
export enum CoordSystem {
  /** Coordinates are relative to the origin of the viewing rectangle.
   * x and y values correspond to pixels within that rectangle, with (x=0,y=0) corresponding to the top-left corner.
   */
  View,

  /** Coordinates are in [Normalized Plane Coordinates]($docs/learning/glossary.md#npc). NPC is a coordinate system
   * for frustums in which each dimension [x,y,z] is normalized to hold values between 0.0 and 1.0.
   * [0,0,0] corresponds to the left-bottom-rear and [1,1,1] to the right-top-front of the frustum.
   */
  Npc,

  /** Coordinates are in the coordinate system of the models in the view. For SpatialViews, this is the iModel's spatial coordinate system.
   * For 2d views, it is the coordinate system of the GeometricModel2d that the view shows.
   */
  World,
}

/** An object to animate a transition of a [[Viewport]].
 * Only one animator may be associated with a viewport at a time. Registering a new
 * animator interrupts and replaces any existing animator.
 * The animator's animate() function will be invoked just prior to the rendering of each frame.
 * The animator may be removed in response to certain changes to the viewport - e.g., when
 * the viewport is closed, or viewing tools operate on it, etc.
 * @beta
 */
export interface Animator {
  /** Apply animation to the viewport. Return true when animation is completed, causing the animator to be removed from the viewport. */
  animate(): boolean;

  /** Invoked to abort this Animator. This method is called if [[Viewport.setAnimator]] is called before `animate` returns true */
  interrupt(): void;
}

/** Options that control how an Viewport animation behaves.
 * @public
 */
export interface ViewAnimationOptions {
  /** Amount of time for animation, in milliseconds. Default is [[ScreenViewport.animation.time.normal]] */
  animationTime?: number;
  /** if animation is aborted, don't move to end, leave at current point instead. */
  cancelOnAbort?: boolean;
  /** easing function for animation. Default is Easing.Cubic.Out */
  easingFunction?: EasingFunction;
}

/** Options that control how operations that change a viewport behave.
 * @public
 */
export interface ViewChangeOptions extends ViewAnimationOptions {
  /** Whether to save the result of this change into the view undo stack. Default is to save in undo. */
  noSaveInUndo?: boolean;
  /** Whether the change should be animated or not. Default is to not animate frustum change. */
  animateFrustumChange?: boolean;
  /** The percentage of the view to leave blank around the edges. */
  marginPercent?: MarginPercent;
}

/** Object to animate a Frustum transition of a viewport. The [[Viewport]] will show as many frames as necessary during the supplied duration.
 * @internal
 */
class FrustumAnimator implements Animator {
  private _tweens = new Tweens();

  public constructor(public options: ViewAnimationOptions, viewport: ScreenViewport, begin: ViewPose, end: ViewPose) {
    const settings = ScreenViewport.animation;
    const zoomSettings = settings.zoomOut;

    let duration = undefined !== options.animationTime ? options.animationTime : settings.time.normal.milliseconds;
    if (duration <= 0 || begin.cameraOn !== end.cameraOn) // no duration means skip animation. We can't animate if the camera toggles.
      return;

    let extentBias: Vector3d | undefined;
    let eyeBias: Vector3d | undefined;
    const zVec = begin.zVec;
    const view = viewport.view;
    const view3 = view as ViewState3d;
    const begin3 = begin as ViewPose3d;
    const end3 = end as ViewPose3d;
    const beginTarget = begin.target;
    const endTarget = end.target;
    const axis = end.rotation.multiplyMatrixMatrixInverse(begin.rotation)!.getAxisAndAngleOfRotation(); // axis to rotate begin to get to end
    const timing = { fraction: 0.0, height: 0, position: 0 }; // updated by tween.

    // don't do "zoom out" if the two views aren't pointing in the same direction, or if they request cancelOnAbort (since that implies that the view
    // is a linear interpolation from begin to end), or if it's disabled.
    if (zoomSettings.enable && !options.cancelOnAbort && zVec.isAlmostEqual(end.zVec)) {
      view.applyPose(end); // start with the pose at the end
      const viewTransform = Transform.createOriginAndMatrix(undefined, view.getRotation());
      const endRange = Range3d.createTransformedArray(viewTransform, view.calculateFocusCorners()); // get the view-aligned range of the focus plane at the end
      const beginRange = Range3d.createTransformedArray(viewTransform, view.applyPose(begin).calculateFocusCorners()); // get the view-aligned range of the focus plane at the beginning

      // do the starting and ending views (plus the margin) overlap? If not we need to zoom out to show how to get from one to the other
      const expand = (range: Range3d) => { const r = range.clone(); r.scaleAboutCenterInPlace(zoomSettings.margin); return r; };
      if (!expand(beginRange).intersectsRangeXY(expand(endRange))) {
        view3.lookAtViewAlignedVolume(beginRange.union(endRange), viewport.viewRect.aspect); // set up a view that would show both extents
        duration *= zoomSettings.durationFactor; // increase duration so the zooming isn't too fast
        extentBias = view.getExtents().minus(begin.extents); // if the camera is off, the "bias" is the amount the union-ed view is larger than the starting view
        if (begin.cameraOn)
          eyeBias = zVec.scaleToLength(zVec.dotProduct(begin3.camera.eye.vectorTo(view3.camera.eye))); // if the camera is on, the bias is the difference in height of the two eye positions
      }
    }

    this._tweens.create(timing, {
      to: { fraction: 1.0, height: zoomSettings.heights, position: zoomSettings.positions },
      duration,
      start: true,
      easing: options.easingFunction ? options.easingFunction : settings.easing,
      interpolation: zoomSettings.interpolation,
      onComplete: () =>
        viewport.setupFromView(end), // when we're done, set up from final state
      onUpdate: () => {
        const fraction = extentBias ? timing.position : timing.fraction; // if we're zooming, fraction comes from position interpolation
        const rot = Matrix3d.createRotationAroundVector(axis.axis, Angle.createDegrees(fraction * axis.angle.degrees))!.multiplyMatrixMatrix(begin.rotation);
        if (begin.cameraOn) {
          const eye = begin3.camera.eye.interpolate(fraction, end3.camera.eye);
          if (undefined !== eyeBias)
            eye.plusScaled(eyeBias, timing.height, eye);
          const target = eye.plusScaled(rot.getRow(2), -1.0 * (Geometry.interpolate(begin3.camera.focusDist, fraction, end3.camera.focusDist)));
          const extents = begin.extents.interpolate(fraction, end.extents);
          view3.lookAt(eye, target, rot.getRow(1), extents);
        } else {
          const extents = begin.extents.interpolate(timing.fraction, end.extents);
          if (undefined !== extentBias)
            extents.plusScaled(extentBias, timing.height, extents); // no camera, zooming out expands extents
          view.setExtents(extents);
          view.setRotation(rot);
          view.setCenter(beginTarget.interpolate(fraction, endTarget)); // must be done last - depends on extents and rotation
        }
        viewport.setupFromView();
      },
    });
  }

  public animate() {
    return !this._tweens.update();
  }

  public interrupt() {
    if (!this.options.cancelOnAbort)
      this._tweens.update(Infinity); // jump to end pose
  }
}

/** Options to allow changing the view rotation with zoomTo methods.
 * @public
 */
export interface ZoomToOptions {
  /** Set view rotation from standard view identifier. */
  standardViewId?: StandardViewId;
  /** Set view rotation relative to placement of first element or props entry. */
  placementRelativeId?: StandardViewId;
  /** Set view rotation from Matrix3d. */
  viewRotation?: Matrix3d;
}

/** Options for changing the viewed Model of a 2d view via [[Viewport.changeViewedModel2d]]
 * @public
 */
export interface ChangeViewedModel2dOptions {
  /** If true, perform a "fit view" operation after changing to the new 2d model. */
  doFit?: boolean;
}

/** @beta Event type for Viewport.onViewUndoRedo */
export enum ViewUndoEvent { Undo = 0, Redo = 1 }

/** Allows the visibility of categories within a [[Viewport]] to be controlled on a per-[[ModelState]] basis.
 * If a category's visibility is overridden for a given model, then elements belonging to that category within that model will be displayed or hidden regardless of the category's inclusion in the Viewport's [[CategorySelectorState]].
 * The override affects geometry on all subcategories belonging to the overridden category. That is, if the category is overridden to be visible, then geometry on all subcategories of the category
 * will be visible, regardless of any [SubCategoryOverride]($common)s applied by the view's [[DisplayStyleState]].
 * @see [[Viewport.perModelCategoryVisibility]]
 * @beta
 */
export namespace PerModelCategoryVisibility {
  /** Describes whether and how a category's visibility is overridden.
   * @beta
   */
  export enum Override {
    /** The category's visibility is not overridden; its visibility is wholly controlled by the [[Viewport]]'s [[CategorySelectorState]]. */
    None,
    /** The category is overridden to be visible. */
    Show,
    /** The category is overridden to be invisible. */
    Hide,
  }

  /** Describes a set of per-model category visibility overrides. Changes to these overrides invoke the [[Viewport.onViewedCategoriesPerModelChanged]] event.
   * @see [[Viewport.perModelCategoryVisibility]].
   * @beta
   */
  export interface Overrides {
    /** Returns the override state of the specified category within the specified model. */
    getOverride(modelId: Id64String, categoryId: Id64String): Override;
    /** Changes the override state of one or more categories for one or more models. */
    setOverride(modelIds: Id64Arg, categoryIds: Id64Arg, override: Override): void;
    /** Removes all overrides for the specified models, or for all models if `modelIds` is undefined. */
    clearOverrides(modelIds?: Id64Arg): void;
    /** Iterates each override.
     * @param func Accepts the model and category Ids and a boolean indicating if the category is visible. Returns `false` to terminate iteration or `true` to continue.
     * @returns `true` if iteration completed; `false` if the callback requested early termination.
     */
    forEachOverride(func: (modelId: Id64String, categoryId: Id64String, visible: boolean) => boolean): boolean;
  }
}

class PerModelCategoryVisibilityOverride {
  public modelId: Id64String;
  public categoryId: Id64String;
  public visible: boolean;

  public constructor(modelId: Id64String, categoryId: Id64String, visible: boolean) {
    this.modelId = modelId;
    this.categoryId = categoryId;
    this.visible = visible;
  }

  public reset(modelId: Id64String, categoryId: Id64String, visible: boolean): void {
    this.modelId = modelId;
    this.categoryId = categoryId;
    this.visible = visible;
  }
}

function compareCategoryOverrides(lhs: PerModelCategoryVisibilityOverride, rhs: PerModelCategoryVisibilityOverride): number {
  const cmp = compareStrings(lhs.modelId, rhs.modelId);
  return 0 === cmp ? compareStrings(lhs.categoryId, rhs.categoryId) : cmp;
}

/** The Viewport-specific implementation of PerModelCategoryVisibility.Overrides.
 * ###TODO: Evaluate performance.
 * @internal
 */
class PerModelCategoryVisibilityOverrides extends SortedArray<PerModelCategoryVisibilityOverride> implements PerModelCategoryVisibility.Overrides {
  private readonly _scratch = new PerModelCategoryVisibilityOverride("0", "0", false);
  private readonly _vp: Viewport;

  public constructor(vp: Viewport) {
    super(compareCategoryOverrides);
    this._vp = vp;
  }

  public getOverride(modelId: Id64String, categoryId: Id64String): PerModelCategoryVisibility.Override {
    this._scratch.reset(modelId, categoryId, false);
    const ovr = this.findEqual(this._scratch);
    if (undefined !== ovr)
      return ovr.visible ? PerModelCategoryVisibility.Override.Show : PerModelCategoryVisibility.Override.Hide;
    else
      return PerModelCategoryVisibility.Override.None;
  }

  public setOverride(modelIds: Id64Arg, categoryIds: Id64Arg, override: PerModelCategoryVisibility.Override): void {
    const ovr = this._scratch;
    let changed = false;
    Id64.forEach(modelIds, (modelId) => {
      Id64.forEach(categoryIds, (categoryId) => {
        ovr.reset(modelId, categoryId, false);
        const index = this.indexOf(ovr);
        if (-1 === index) {
          if (PerModelCategoryVisibility.Override.None !== override) {
            this.insert(new PerModelCategoryVisibilityOverride(modelId, categoryId, PerModelCategoryVisibility.Override.Show === override));
            changed = true;
          }
        } else {
          if (PerModelCategoryVisibility.Override.None === override) {
            this._array.splice(index, 1);
            changed = true;
          } else if (this._array[index].visible !== (PerModelCategoryVisibility.Override.Show === override)) {
            this._array[index].visible = (PerModelCategoryVisibility.Override.Show === override);
            changed = true;
          }
        }
      });
    });

    if (changed) {
      this._vp.setViewedCategoriesPerModelChanged();

      if (PerModelCategoryVisibility.Override.None !== override) {
        // Ensure subcategories loaded.
        this._vp.subcategories.push(this._vp.iModel.subcategories, categoryIds, () => this._vp.setViewedCategoriesPerModelChanged());
      }
    }
  }

  public clearOverrides(modelIds?: Id64Arg): void {
    if (undefined === modelIds) {
      if (0 < this.length) {
        this.clear();
        this._vp.setViewedCategoriesPerModelChanged();
      }

      return;
    }

    for (let i = 0; i < this.length; /**/) {
      const ovr = this._array[i];
      const removed = !Id64.iterate(modelIds, (modelId) => {
        if (modelId === ovr.modelId) {
          this._array.splice(i, 1);
          this._vp.setViewedCategoriesPerModelChanged();
          return false; // halt iteration
        }

        return true; // continue iteration
      });

      if (!removed)
        ++i;
    }
  }

  public addOverrides(fs: FeatureSymbology.Overrides, ovrs: Id64.Uint32Map<Id64.Uint32Set>): void {
    const cache = this._vp.iModel.subcategories;

    for (const ovr of this._array) {
      const subcats = cache.getSubCategories(ovr.categoryId);
      if (undefined === subcats)
        continue;

      // It's pointless to override for models which aren't displayed...except if we do this, and then someone enables that model,
      // we would need to regenerate our symbology overrides in response. Preferably people wouldn't bother overriding models that
      // they don't want us to draw...
      /* if (!this._vp.view.viewsModel(ovr.modelId))
        continue; */

      // ###TODO: Avoid recomputing upper and lower portions of modelId if modelId repeated.
      // (Array is sorted first by modelId).
      // Also avoid computing if no effective overrides.
      const modelLo = Id64.getLowerUint32(ovr.modelId);
      const modelHi = Id64.getUpperUint32(ovr.modelId);

      for (const subcat of subcats) {
        const subcatLo = Id64.getLowerUint32(subcat);
        const subcatHi = Id64.getUpperUint32(subcat);
        const vis = fs.isSubCategoryVisible(subcatLo, subcatHi);
        if (vis !== ovr.visible) {
          // Only care if visibility differs from that defined for entire view
          let entry = ovrs.get(modelLo, modelHi);
          if (undefined === entry) {
            entry = new Id64.Uint32Set();
            ovrs.set(modelLo, modelHi, entry);
          }

          entry.add(subcatLo, subcatHi);
        }
      }
    }
  }

  public forEachOverride(func: (modelId: Id64String, categoryId: Id64String, visible: boolean) => boolean): boolean {
    for (const entry of this)
      if (!func(entry.modelId, entry.categoryId, entry.visible))
        return false;

    return true;
  }
}

/** A Viewport renders the contents of one or more Models onto an `HTMLCanvasElement`.
 *
 * It holds a [[ViewState]] object that defines its viewing parameters. [[ViewTool]]s may
 * modify the ViewState object. Changes to the ViewState are only reflected in a Viewport after the
 * [[synchWithView]] method is called.
 *
 * In general, because the Viewport essentially takes control of its attached ViewState, changes to the ViewState should be made
 * indirectly through the Viewport's own API. Doing so ensures that synchronization between the Viewport and its ViewState is reliable and automatic. For example:
 *
 *   * To change the set of categories or models displayed in the Viewport, use [[Viewport.changeCategoryDisplay]] and [[Viewport.changeModelDisplay]] rather than modifying the ViewState's [[CategorySelectorState]] or [[ModelSelectorState]] directly.
 *   * To change the [ViewFlags]($common), set [[Viewport.viewFlags]] rather than modifying the ViewState's [[DisplayStyleState]] directly.
 *   * To modify the [[DisplayStyleState]]:
 *    ```ts
 *    const style = viewport.displayStyle.clone();
 *    style.backgroundColor = ColorDef.red.clone(); // or any other desired modifications
 *    viewport.displayStyle = style;
 *    ```
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
 * @see [[ViewManager]]
 * @public
 */

export abstract class Viewport implements IDisposable {
  /** Event called whenever this viewport is synchronized with its [[ViewState]].
   * @note This event is invoked *very* frequently. To avoid negatively impacting performance, consider using one of the more specific Viewport events;
   * otherwise, avoid performing excessive computations in response to this event.
   * @see [[onViewportChanged]] for receiving events at more regular intervals with more specific information about what changed.
   * @see [[onChangeView]] for an event raised specifically when a different [[ViewState]] becomes associated with the viewport.
   */
  public readonly onViewChanged = new BeEvent<(vp: Viewport) => void>();
  /** Event called after reversing the most recent change to the Viewport from the undo stack or reapplying the most recently undone change to the Viewport from the redo stack.
   * @beta
   */
  public readonly onViewUndoRedo = new BeEvent<(vp: Viewport, event: ViewUndoEvent) => void>();
  /** Event called on the next frame after this viewport's set of always-drawn elements changes.
   * @beta
   */
  public readonly onAlwaysDrawnChanged = new BeEvent<(vp: Viewport) => void>();
  /** Event called on the next frame after this viewport's set of never-drawn elements changes.
   * @beta
   */
  public readonly onNeverDrawnChanged = new BeEvent<(vp: Viewport) => void>();
  /** Event called on the next frame after this viewport's [[DisplayStyleState]] or its members change.
   * Aspects of the display style include [ViewFlags]($common), [SubCategoryOverride]($common)s, and [[Environment]] settings.
   * @beta
   */
  public readonly onDisplayStyleChanged = new BeEvent<(vp: Viewport) => void>();
  /** Event called on the next frame after this viewport's set of displayed categories changes.
   * @beta
   */
  public readonly onViewedCategoriesChanged = new BeEvent<(vp: Viewport) => void>();
  /** Event called on the next frame after this viewport's set of [[PerModelCategoryVisibility.Overrides]] changes.
   * @beta
   */
  public readonly onViewedCategoriesPerModelChanged = new BeEvent<(vp: Viewport) => void>();
  /** Event called on the next frame after this viewport's set of displayed models changes.
   * @beta
   */
  public readonly onViewedModelsChanged = new BeEvent<(vp: Viewport) => void>();
  /** Event called on the next frame after this viewport's [[FeatureOverrideProvider]] changes, or the internal state of the provider changes such that the overrides needed to be recomputed.
   * @beta
   */
  public readonly onFeatureOverrideProviderChanged = new BeEvent<(vp: Viewport) => void>();
  /** Event called on the next frame after this viewport's [[FeatureSymbology.Overrides]] change.
   * @beta
   */
  public readonly onFeatureOverridesChanged = new BeEvent<(vp: Viewport) => void>();
  /** Event called on the next frame after any of the viewport's [[ChangeFlags]] changes.
   * @beta
   */
  public readonly onViewportChanged = new BeEvent<(vp: Viewport, changed: ChangeFlags) => void>();
  /** Event invoked immediately when [[changeView]] is called to replace the current [[ViewState]] with a different one.
   * @beta
   */
  public readonly onChangeView = new BeEvent<(vp: Viewport, previousViewState: ViewState) => void>();

  private _view!: ViewState;
  private readonly _viewportId: number;
  private _scheduleScriptFraction = 0.0;
  private _doContinuousRendering = false;
  /** @internal */
  protected _inViewChangedEvent = false;
  /** @internal */
  protected _decorationsValid = false;
  /** @internal */
  protected _sceneValid = false;
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
  /** @internal */
  protected _scheduleScriptFractionValid = false;
  private _redrawPending = false;

  /** Mark the current set of decorations invalid, so that they will be recreated on the next render frame.
   * This can be useful, for example, if an external event causes one or more current decorations to become invalid and you wish to force
   * them to be recreated to show the changes.
   * @note On the next frame, the `decorate` method of all [[ViewManager.decorators]] will be called. There is no way (or need) to
   * invalidate individual decorations.
   * @beta
   */
  public invalidateDecorations(): void {
    this._decorationsValid = false;
    IModelApp.requestNextAnimation();
  }
  /** @internal */
  public invalidateScene(): void {
    this._sceneValid = false;
    this._scheduleScriptFractionValid = false;
    this.invalidateDecorations();
  }
  /** @internal */
  public invalidateRenderPlan(): void {
    this._renderPlanValid = false;
    this.invalidateScene();
  }
  /** @internal */
  public invalidateController(): void {
    this._controllerValid = false;
    this.invalidateRenderPlan();
  }

  /** @internal */
  public setValidScene() {
    this._sceneValid = true;
  }
  /** @internal */
  public setRedrawPending() {
    this._redrawPending = true;
  }

  private _animator?: Animator;
  /** @internal */
  protected _changeFlags = new ChangeFlags();
  private _scheduleTime = 0.0;
  private _selectionSetDirty = true;
  private readonly _perModelCategoryVisibility = new PerModelCategoryVisibilityOverrides(this);
  private _tileSizeModifier?: number;

  /** @internal */
  public readonly subcategories = new SubCategoriesCache.Queue();

  /** @internal */
  public get scheduleTime() { return this._scheduleTime; }

  /** Time the current flash started.
   * @internal
   */
  public flashUpdateTime?: BeTimePoint;
  /** Current flash intensity from [0..1]
   * @internal
   */
  public flashIntensity = 0;
  /** The length of time that the flash intensity will increase (in seconds)
   * @internal
   */
  public flashDuration = 0;
  private _flashedElem?: string;         // id of currently flashed element
  /** Id of last flashed element.
   * @internal
   */
  public lastFlashedElem?: string;

  /** The number of tiles selected for display in the view as of the most recently-drawn frame.
   * The tiles selected may not meet the desired level-of-detail for the view, instead being temporarily drawn while
   * tiles of more appropriate level-of-detail are loaded asynchronously.
   * @note This member should be treated as read-only - it should only be modified internally.
   * @see Viewport.numRequestedTiles
   * @see Viewport.numReadyTiles
   */
  public numSelectedTiles = 0;

  /** The number of tiles which were ready and met the desired level-of-detail for display in the view as of the most recently-drawn frame.
   * These tiles may *not* have been selected because some other (probably sibling) tiles were *not* ready for display.
   * This is a useful metric for determining how "complete" the view is - e.g., one indicator of progress toward view completion can be expressed as:
   * `  (numReadyTiles) / (numReadyTiles + numRequestedTiles)`
   * @note This member should be treated as read-only - it should only be modified internally.
   * @see Viewport.numSelectedTiles
   * @see Viewport.numRequestedTiles
   */
  public numReadyTiles = 0;

  /** Don't allow entries in the view undo buffer unless they're separated by more than this amount of time. */
  public static undoDelay = BeDuration.fromSeconds(.5);
  private static _nextViewportId = 1;

  private _debugBoundingBoxes: TileBoundingBoxes = TileBoundingBoxes.None;
  private _freezeScene = false;
  private _viewingSpace!: ViewingSpace;
  private _target?: RenderTarget;
  private _fadeOutActive = false;
  private _neverDrawn?: Id64Set;
  private _alwaysDrawn?: Id64Set;
  private _alwaysDrawnExclusive: boolean = false;
  private _featureOverrideProvider?: FeatureOverrideProvider;
  private readonly _tiledGraphicsProviders = new Set<TiledGraphicsProvider>();
  private _hilite = new Hilite.Settings();
  private _emphasis = new Hilite.Settings(ColorDef.black.clone(), 0, 0, Hilite.Silhouette.Thick);

  /** @internal */
  public get viewingSpace(): ViewingSpace { return this._viewingSpace; }

  /** This viewport's rotation matrix. */
  public get rotation(): Matrix3d { return this._viewingSpace.rotation; }
  /** The vector between the opposite corners of this viewport's extents. */
  public get viewDelta(): Vector3d { return this._viewingSpace.viewDelta; }
  /** Provides conversions between world and view coordinates. */
  public get worldToViewMap(): Map4d { return this._viewingSpace.worldToViewMap; }
  /** @internal */
  public get frustFraction(): number { return this._viewingSpace.frustFraction; }

  /** @internal */
  public get scheduleScriptFraction(): number { return this._scheduleScriptFraction; }
  public set scheduleScriptFraction(fraction: number) {
    this._scheduleScriptFraction = fraction;
    this._scheduleScriptFractionValid = false;
    IModelApp.requestNextAnimation();
  }

  /** @internal */
  protected readonly _viewRange: ViewRect = new ViewRect();

  /** Get the rectangle of this Viewport in [[CoordSystem.View]] coordinates. */
  public abstract get viewRect(): ViewRect;
  /** @internal */
  public get isAspectRatioLocked(): boolean { return false; }

  /** @internal */
  public get target(): RenderTarget {
    assert(undefined !== this._target, "Accessing RenderTarget of a disposed Viewport");
    return this._target!;
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
   * @see [FeatureSymbology.Appearance.emphasized].
   * @beta
   */
  public get emphasisSettings(): Hilite.Settings { return this._emphasis; }
  public set emphasisSettings(settings: Hilite.Settings) {
    this._emphasis = settings;
    this.invalidateRenderPlan();
  }

  /** Determine whether the Grid display is currently enabled in this Viewport.
   * @return true if the grid display is on.
   */
  public get isGridOn(): boolean { return this.viewFlags.grid; }
  /** The [ViewFlags]($common) that determine how the contents of this Viewport are rendered. */
  public get viewFlags(): ViewFlags { return this.view.viewFlags; }
  public set viewFlags(viewFlags: ViewFlags) {
    if (!this.viewFlags.equals(viewFlags)) {
      this._changeFlags.setDisplayStyle();
      this.invalidateRenderPlan();
      this.view.displayStyle.viewFlags = viewFlags;
    }
  }

  /** The display style controller how the contents of this viewport are rendered.
   * @note To ensure proper synchronization, do not directly modify the [[DisplayStyleState]] returned by the getter. Instead, create a new one (possibly by cloning this display style) and pass it to the setter.
   */
  public get displayStyle(): DisplayStyleState { return this.view.displayStyle; }
  public set displayStyle(style: DisplayStyleState) {
    this.view.displayStyle = style;
    this._changeFlags.setDisplayStyle();
    this.invalidateRenderPlan();
  }

  /** Remove any [[SubCategoryOverride]] for the specified subcategory.
   * @param id The Id of the subcategory.
   * @see [[overrideSubCategory]]
   */
  public dropSubCategoryOverride(id: Id64String): void {
    this.view.displayStyle.dropSubCategoryOverride(id);
    this._changeFlags.setDisplayStyle();
    this.invalidateRenderPlan();
  }

  /** Override the symbology of geometry belonging to a specific subcategory when rendered within this viewport.
   * @param id The Id of the subcategory.
   * @param ovr The symbology overrides to apply to all geometry belonging to the specified subcategory.
   * @see [[dropSubCategoryOverride]]
   */
  public overrideSubCategory(id: Id64String, ovr: SubCategoryOverride): void {
    this.view.displayStyle.overrideSubCategory(id, ovr);
    this._changeFlags.setDisplayStyle();
    this.invalidateRenderPlan();
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

  private invalidateShadows(): void {
    // When shadows are being displayed and the set of displayed categories changes, we must invalidate the scene so that shadows will be regenerated.
    // Same occurs when changing feature symbology overrides (e.g., always/never-drawn element sets, transparency override)
    if (this._sceneValid && this.view.displayStyle.wantShadows)
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
    this._changeFlags.setViewedCategories();
    this.invalidateShadows();

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
    Id64.forEach(categoryIds, (categoryId) => {
      const subCategoryIds = this.iModel.subcategories.getSubCategories(categoryId);
      if (undefined !== subCategoryIds) {
        for (const subCategoryId of subCategoryIds)
          this.changeSubCategoryDisplay(subCategoryId, true);
      }
    });
  }

  /** @internal */
  public getSubCategories(categoryId: Id64String): Id64Set | undefined { return this.iModel.subcategories.getSubCategories(categoryId); }

  /** Change the visibility of geometry belonging to the specified subcategory when displayed in this viewport.
   * @param subCategoryId The Id of the subcategory
   * @param display: True to make geometry belonging to the subcategory visible within this viewport, false to make it invisible.
   * @alpha
   */
  public changeSubCategoryDisplay(subCategoryId: Id64String, display: boolean): void {
    const app = this.iModel.subcategories.getSubCategoryAppearance(subCategoryId);
    if (undefined === app)
      return; // category not enabled or subcategory not found

    const curOvr = this.getSubCategoryOverride(subCategoryId);
    const isAlreadyVisible = undefined !== curOvr && undefined !== curOvr.invisible ? !curOvr.invisible : !app.invisible;
    if (isAlreadyVisible === display)
      return;

    // Preserve existing overrides - just flip the visibility flag.
    const json = undefined !== curOvr ? curOvr.toJSON() : {};
    json.invisible = !display;
    this.overrideSubCategory(subCategoryId, SubCategoryOverride.fromJSON(json)); // will set the ChangeFlag appropriately
    this.invalidateShadows();
  }

  /** The settings controlling how a background map is displayed within a view.
   * @see [[ViewFlags.backgroundMap]] for toggling display of the map on or off.
   * @beta
   */
  public get backgroundMapSettings(): BackgroundMapSettings { return this.displayStyle.backgroundMapSettings; }
  public set backgroundMapSettings(settings: BackgroundMapSettings) {
    this.displayStyle.backgroundMapSettings = settings;
    this.invalidateScene();
  }

  /** Modify a subset of the background map display settings.
   * @param name props JSON representation of the properties to change. Any properties not present will retain their current values in `this.backgroundMapSettings`.
   * @see [[ViewFlags.backgroundMap]] for toggling display of the map.
   *
   * Example that changes only the elevation, leaving the provider and type unchanged:
   * ``` ts
   *  viewport.changeBackgroundMapProps({ groundBias: 16.2 });
   * ```
   * @beta
   */
  public changeBackgroundMapProps(props: BackgroundMapProps): void {
    this.displayStyle.changeBackgroundMapProps(props);
    this.invalidateScene();
  }

  /** Returns true if this Viewport is currently displaying the model with the specified Id. */
  public viewsModel(modelId: Id64String): boolean { return this.view.viewsModel(modelId); }

  /** Attempt to change the 2d Model this Viewport is displaying, if its ViewState is a ViewState2d.
   * @param baseModelId The Id of the new 2d Model to be displayed.
   * @param options options that determine how the new view is displayed
   * @note This function *only works* if the viewport is viewing a [[ViewState2d]], otherwise it does nothing. Also note that
   * the Model of baseModelId should be the same type (Drawing or Sheet) as the current view.
   * @note this method clones the current ViewState2d and sets its baseModelId to the supplied value. The DisplayStyle and CategorySelector remain unchanged.
   */
  public async changeViewedModel2d(baseModelId: Id64String, options?: ChangeViewedModel2dOptions & ViewChangeOptions): Promise<void> {
    if (!this.view.is2d)
      return;

    const newView = this.view.clone() as ViewState2d; // start by cloning the current ViewState
    // NOTE: the cast below is necessary since baseModelId is marked as readonly after construction.
    //  We know this is a special case where it is safe to change it.
    (newView.baseModelId as Id64String) = baseModelId; // change its baseModelId.

    await newView.load(); // make sure new model is loaded.
    this.changeView(newView, options); // switch this viewport to use new ViewState2d

    if (options && options.doFit) { // optionally fit view to the extents of the new model
      const range = await this.iModel.models.queryModelRanges([baseModelId]);
      this.zoomToVolume(Range3d.fromJSON(range[0]), options);
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
    this.view.markModelSelectorChanged();

    this._changeFlags.setViewedModels();
    this.invalidateScene();

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
      this.view.markModelSelectorChanged();
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

    const prevSize = this.view.modelSelector.models.size;
    if (display)
      this.view.modelSelector.addModels(models);
    else
      this.view.modelSelector.dropModels(models);

    if (this.view.modelSelector.models.size !== prevSize) {
      this._changeFlags.setViewedModels();
      this.view.markModelSelectorChanged();
      this.invalidateScene();
    }

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
    return this.iModel.models.load(models).then(() => {
      this.invalidateScene();
      if (this.view.isSpatialView())
        this.view.markModelSelectorChanged();
    });
  }

  /** Determines what type (if any) of debug graphics will be displayed to visualize [[Tile]] volumes.
   * @see [[TileBoundingBoxes]]
   * @internal
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

  /** @internal */
  public get analysisStyle(): AnalysisStyle | undefined { return this.view.analysisStyle; }
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
  /** @internal */
  public getToolTip(hit: HitDetail): HTMLElement | string {
    let toolTip: string | HTMLElement = "";
    if (this.displayStyle) {
      this.displayStyle.forEachTileTreeRef((model) => {
        const thisToolTip = model.getToolTip(hit);
        if (thisToolTip !== undefined)
          toolTip = thisToolTip;
      });
    }

    return toolTip;
  }

  /** @internal */
  protected constructor(target: RenderTarget) {
    this._target = target;
    this._viewportId = Viewport._nextViewportId++;
  }

  public dispose(): void {
    assert(undefined !== this._target, "Double disposal of Viewport");
    this._target = dispose(this._target);
    this.subcategories.dispose();
    IModelApp.tileAdmin.forgetViewport(this);
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
  /** This gives each Viewport a unique Id, which can be used for comparing and sorting Viewport objects inside collections.
   * @internal
   */
  public get viewportId(): number { return this._viewportId; }

  /** The ViewState for this Viewport */
  public get view(): ViewState { return this._view; }
  /** @internal */
  public get pixelsPerInch() { /* ###TODO: This is apparently unobtainable information in a browser... */ return 96; }
  /** @internal */
  public get backgroundMapPlane() { return this.view.displayStyle.backgroundMapPlane; }

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
      this.invalidateShadows();
    }
  }

  /** Clear the set of never-drawn elements.
   * @see [[neverDrawn]]
   */
  public clearNeverDrawn(): void {
    if (undefined !== this.neverDrawn && 0 < this.neverDrawn.size) {
      this.neverDrawn.clear();
      this._changeFlags.setNeverDrawn();
      this.invalidateShadows();
    }
  }

  /** Specify the Ids of a set of elements which should never be rendered within this view.
   * @see [[neverDrawn]].
   */
  public setNeverDrawn(ids: Id64Set): void {
    this._neverDrawn = ids;
    this._changeFlags.setNeverDrawn();
    this.invalidateShadows();
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
    this.invalidateShadows();
  }

  /** Returns true if the set of elements in the [[alwaysDrawn]] set are the *only* elements rendered within this view. */
  public get isAlwaysDrawnExclusive(): boolean { return this._alwaysDrawnExclusive; }

  /** Allows visibility of categories within this viewport to be overridden on a per-model basis.
   * @alpha
   */
  public get perModelCategoryVisibility(): PerModelCategoryVisibility.Overrides { return this._perModelCategoryVisibility; }

  /** Adds visibility overrides for any subcategories whose visibility differs from that defined by the view's
   * category selector in the context of specific models.
   * @internal
   */
  public addModelSubCategoryVisibilityOverrides(fs: FeatureSymbology.Overrides, ovrs: Id64.Uint32Map<Id64.Uint32Set>): void {
    this._perModelCategoryVisibility.addOverrides(fs, ovrs);
  }

  /** An object which can customize the appearance of [[Feature]]s within a viewport.
   * If defined, the provider will be invoked whenever the overrides are determined to need updating.
   * The overrides can be explicitly marked as needing a refresh by calling [[Viewport.setFeatureOverrideProviderChanged]]. This is typically called when
   * the internal state of the provider changes such that the computed overrides must also change.
   * @see [[FeatureSymbology.Overrides]]
   */
  public get featureOverrideProvider(): FeatureOverrideProvider | undefined {
    return this._featureOverrideProvider;
  }
  public set featureOverrideProvider(provider: FeatureOverrideProvider | undefined) {
    if (provider !== this._featureOverrideProvider) {
      this._featureOverrideProvider = provider;
      this.setFeatureOverrideProviderChanged();
    }
  }

  /** Notifies this viewport that the internal state of its [[FeatureOverrideProvider]] has changed such that its
   * [[FeatureSymbology.Overrides]] should be recomputed.
   */
  public setFeatureOverrideProviderChanged(): void {
    this._changeFlags.setFeatureOverrideProvider();
    this.invalidateShadows();
  }

  /** @internal */
  protected forEachTiledGraphicsProviderTree(func: (ref: TileTreeReference) => void): void {
    for (const provider of this._tiledGraphicsProviders)
      provider.forEachTileTreeRef(this, (ref) => func(ref));
  }

  /** @internal */
  public forEachTileTreeRef(func: (ref: TileTreeReference) => void): void {
    this.view.forEachTileTreeRef(func);
    this.forEachTiledGraphicsProviderTree(func);
  }

  /** Disclose *all* TileTrees currently in use by this Viewport. This set may include trees not reported by [[forEachTileTreeRef]] - e.g., those used by view attachments, map-draped terrain, etc.
   * @internal
   */
  public discloseTileTrees(trees: TileTreeSet): void {
    this.forEachTiledGraphicsProviderTree((ref) => trees.disclose(ref));
    trees.disclose(this.view);
  }

  /** @internal */
  public addTiledGraphicsProvider(provider: TiledGraphicsProvider): void {
    this._tiledGraphicsProviders.add(provider);
    this.invalidateScene();
  }
  /** @internal */
  public dropTiledGraphicsProvider(provider: TiledGraphicsProvider): void {
    this._tiledGraphicsProviders.delete(provider);
    this.invalidateScene();
  }

  /** @internal */
  public hasTiledGraphicsProvider(provider: TiledGraphicsProvider): boolean {
    return this._tiledGraphicsProviders.has(provider);
  }

  /** @internal */
  public getDisplayedPlanes(): Plane3dByOriginAndUnitNormal[] {
    const planes: Plane3dByOriginAndUnitNormal[] = [];
    this.forEachTileTreeRef((ref) => ref.addPlanes(planes));
    return planes;
  }

  /** @internal */
  public setViewedCategoriesPerModelChanged(): void {
    this._changeFlags.setViewedCategoriesPerModel();
  }

  /** @internal */
  public markSelectionSetDirty() { this._selectionSetDirty = true; }

  /** True if this is a 3d view with the camera turned on. */
  public get isCameraOn(): boolean { return this.view.isCameraEnabled(); }

  /** @internal */
  public changeDynamics(dynamics: GraphicList | undefined): void {
    this.target.changeDynamics(dynamics);
    this.invalidateDecorations();
  }

  /** Set or clear the currently *flashed* element.
   * @param id The Id of the element to flash. If undefined, remove (un-flash) the currently flashed element
   * @param duration The amount of time, in seconds, the flash intensity will increase (see [[flashDuration]])
   * @internal
   */
  public setFlashed(id: string | undefined, duration: number): void {
    if (id !== this._flashedElem) {
      this.lastFlashedElem = this._flashedElem;
      this._flashedElem = id;
    }
    this.flashDuration = duration;
  }

  public get auxCoordSystem(): AuxCoordSystemState { return this.view.auxiliaryCoordinateSystem; }
  public getAuxCoordRotation(result?: Matrix3d) { return this.auxCoordSystem.getRotation(result); }
  public getAuxCoordOrigin(result?: Point3d) { return this.auxCoordSystem.getOrigin(result); }

  /** The number of outstanding requests for tiles to be displayed in this viewport.
   * @see Viewport.numSelectedTiles
   */
  public get numRequestedTiles(): number { return IModelApp.tileAdmin.getNumRequestsForViewport(this); }

  /** @internal */
  public toViewOrientation(from: XYZ, to?: XYZ) { this._viewingSpace.toViewOrientation(from, to); }
  /** @internal */
  public fromViewOrientation(from: XYZ, to?: XYZ) { this._viewingSpace.fromViewOrientation(from, to); }

  /** Change the ViewState of this Viewport
   * @param view a fully loaded (see discussion at [[ViewState.load]] ) ViewState
   * @param _opts options for how the view change operation  should work
   */
  public changeView(view: ViewState, _opts?: ViewChangeOptions) {
    const prevView = this.view;

    this.updateChangeFlags(view);
    this.doSetupFromView(view);
    this.invalidateScene();
    this.invalidateController();
    this.target.reset();

    if (undefined !== prevView && prevView !== view) {
      this.onChangeView.raiseEvent(this, prevView);
      this._changeFlags.setViewState();
    }
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

  /** Turn the camera on if it is currently off. If the camera is already on, adjust it to use the supplied lens angle.
   * @param lensAngle The lens angle for the camera. If undefined, use view.camera.lens.
   * @note This method will fail if the ViewState is not 3d.
   */
  public turnCameraOn(lensAngle?: Angle): ViewStatus {
    const view = this.view;
    if (!view.is3d())
      return ViewStatus.InvalidViewport;

    if (!lensAngle)
      lensAngle = view.camera.lens;

    Camera.validateLensAngle(lensAngle);

    if (view.isCameraOn)
      return view.lookAtUsingLensAngle(view.getEyePoint(), view.getTargetPoint(), view.getYVector(), lensAngle);

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

    const eye = corners[2].interpolate(0.5, corners[3]); // middle of closest plane
    const target = corners[0].interpolate(0.5, corners[1]); // middle of halfway plane
    const backDist = eye.distance(target) * 2.0;
    const frontDist = view.minimumFrontDistance();
    return view.lookAtUsingLensAngle(eye, target, view.getYVector(), lensAngle, frontDist, backDist);
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

    this._view = view;

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
   * @note In previous versions, the argument was a boolean `saveInUndo`. For backwards compatibility, if `_options` is a boolean, it is interpreted as "{ noSaveInUndo: !_options }"
   */
  public synchWithView(_options?: ViewChangeOptions | boolean): void { this.setupFromView(); }

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
    if (view.isCameraEnabled()) {
      const frust = this.getFrustum(CoordSystem.View, false)!;
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
  public zoom(newCenter: Point3d | undefined, factor: number, options?: ViewChangeOptions): void {
    const view = this.view;
    if (undefined === view)
      return;

    if (view.isCameraEnabled()) {
      const centerNpc = newCenter ? this.worldToNpc(newCenter) : NpcCenter.clone();
      const scaleTransform = Transform.createFixedPointAndMatrix(centerNpc, Matrix3d.createScale(factor, factor, 1.0));

      const offset = centerNpc.minus(NpcCenter); // offset by difference of old/new center
      offset.z = 0.0;     // z center stays the same.

      const offsetTransform = Transform.createTranslationXYZ(offset.x, offset.y, offset.z);
      const product = offsetTransform.multiplyTransformTransform(scaleTransform);

      const frust = new Frustum();
      product.multiplyPoint3dArrayInPlace(frust.points);

      this.npcToWorldArray(frust.points);
      view.setupFromFrustum(frust);
      view.centerEyePoint();
    } else {
      // for non-camera views, do the zooming by adjusting the origin and delta directly so there can be no
      // chance of the rotation changing due to numerical precision errors calculating it from the frustum corners.
      const delta = view.getExtents().scale(factor);

      // first check to see whether the zoom operation results in an invalid view. If so, make sure we don't change anything
      if (ViewStatus.Success !== view.validateViewDelta(delta, true))
        return;

      const rot = view.getRotation();
      const center = rot.multiplyVector(newCenter ? newCenter : view.getCenter());

      if (!view.allow3dManipulations())
        center.z = 0.0;

      view.setOrigin(rot.multiplyTransposeVector(delta.scale(.5).vectorTo(center)));
      view.setExtents(delta);
    }

    this.synchWithView(options);
  }

  /** Zoom the view to a show the tightest box around a given set of PlacementProps. Optionally, change view rotation.
   * @param props array of PlacementProps. Will zoom to the union of the placements.
   * @param options options that control how the view change works and whether to change view rotation.
   * @note any invalid placements are ignored. If no valid placements are supplied, this function does nothing.
   */
  public zoomToPlacementProps(placementProps: PlacementProps[], options?: ViewChangeOptions & ZoomToOptions) {
    const toPlacement = (placement: Placement2dProps | Placement3dProps): Placement2d | Placement3d => {
      const props = placement as any;
      return undefined !== props.angle ? Placement2d.fromJSON(props) : Placement3d.fromJSON(props);
    };

    const indexOfFirstValidPlacement = placementProps.findIndex((props) => toPlacement(props).isValid);
    if (-1 === indexOfFirstValidPlacement)
      return;

    const view = this.view;
    if (undefined !== options) {
      if (undefined !== options.standardViewId) {
        view.setStandardRotation(options.standardViewId);
      } else if (undefined !== options.placementRelativeId) {
        const firstPlacement = toPlacement(placementProps[indexOfFirstValidPlacement]);
        const viewRotation = StandardView.getStandardRotation(options.placementRelativeId).clone();
        viewRotation.multiplyMatrixMatrixTranspose(firstPlacement.transform.matrix, viewRotation);
        view.setRotation(viewRotation);
      } else if (undefined !== options.viewRotation) {
        view.setRotation(options.viewRotation);
      }
    }

    const viewTransform = Transform.createOriginAndMatrix(undefined, view.getRotation());
    const frust = new Frustum();
    const viewRange = new Range3d();
    for (let i = indexOfFirstValidPlacement; i < placementProps.length; i++) {
      const placement = toPlacement(placementProps[i]);
      if (placement.isValid)
        viewRange.extendArray(placement.getWorldCorners(frust).points, viewTransform);
    }

    view.lookAtViewAlignedVolume(viewRange, this.viewRect.aspect, options ? options.marginPercent : undefined);
    this.synchWithView(options);
  }

  /** Zoom the view to a show the tightest box around a given set of ElementProps. Optionally, change view rotation.
   * @param props element props. Will zoom to the union of the placements.
   * @param options options that control how the view change works and whether to change view rotation.
   */
  public zoomToElementProps(elementProps: ElementProps[], options?: ViewChangeOptions & ZoomToOptions) {
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
  public async zoomToElements(ids: Id64Arg, options?: ViewChangeOptions & ZoomToOptions): Promise<void> {
    this.zoomToElementProps(await this.iModel.elements.getProps(ids), options);
  }

  /** Zoom the view to a volume of space in world coordinates.
   * @param volume The low and high corners, in world coordinates.
   * @param options options that control how the view change works
   */
  public zoomToVolume(volume: LowAndHighXYZ | LowAndHighXY, options?: ViewChangeOptions) {
    this.view.lookAtVolume(volume, this.viewRect.aspect, options ? options.marginPercent : undefined);
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

  /** @internal */
  public computeViewRange(): Range3d {
    this.setupFromView(); // can't proceed if viewport isn't valid (not active)
    const fitRange = this.view.computeFitRange();
    this.forEachTiledGraphicsProviderTree((ref) => {
      ref.unionFitRange(fitRange);
    });
    return fitRange;
  }

  /** Set or clear the animator for this Viewport.
   * @param animator The new animator for this Viewport, or undefined to remove current animator.
   * @note current animator's `interrupt` method will be called (if it has not completed yet)
   * @beta
   */
  public setAnimator(animator?: Animator) {
    if (this._animator)
      this._animator.interrupt();
    this._animator = animator;
  }

  /** Used strictly by TwoWayViewportSync to change the reactive viewport's view to a clone of the active viewport's ViewState.
   * Does *not* trigger "ViewState changed" events.
   * @internal
   */
  public applyViewState(val: ViewState) {
    this._view = val;
    this.updateChangeFlags(val);
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
      const oldExclude = oldView.displayStyle.settings.excludedElements;
      const newExclude = newView.displayStyle.settings.excludedElements;
      if (oldExclude.size !== newExclude.size) {
        flags.setNeverDrawn();
      } else {
        for (const exclude of oldExclude)
          if (!newExclude.has(exclude)) {
            flags.setNeverDrawn();
            break;
          }
      }
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
      origin.setFrom(this.iModel!.globalOrigin);

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
    if (this.view.isCameraEnabled())
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

    if (this._flashedElem !== this.lastFlashedElem) {
      this.flashIntensity = 0.0;
      this.flashUpdateTime = BeTimePoint.now();
      this.lastFlashedElem = this._flashedElem; // flashing has begun; this is now the previous flash
      needsFlashUpdate = this._flashedElem === undefined; // notify render thread that flash has been turned off (signified by undefined elem)
    }

    if (this._flashedElem !== undefined && this.flashIntensity < 1.0) {
      const flashDuration = BeDuration.fromSeconds(this.flashDuration);
      const flashElapsed = BeTimePoint.now().milliseconds - this.flashUpdateTime!.milliseconds;
      this.flashIntensity = Math.min(flashElapsed, flashDuration.milliseconds) / flashDuration.milliseconds; // how intense do we want the flash effect to be from [0..1]?
      needsFlashUpdate = true;
    }

    return needsFlashUpdate;
  }

  /** @internal */
  public createSceneContext(): SceneContext { return new SceneContext(this); }

  /** Called when the visible contents of the viewport are redrawn.
   * @note Due to the frequency of this event, avoid performing expensive work inside event listeners.
   */
  public readonly onRender = new BeEvent<(vp: Viewport) => void>();

  /** @internal */
  protected validateRenderPlan() {
    this.target.changeRenderPlan(RenderPlan.createFromViewport(this));
    this._renderPlanValid = true;
  }

  /** @internal */
  public renderFrame(): void {
    const changeFlags = this._changeFlags;
    if (changeFlags.hasChanges)
      this._changeFlags = new ChangeFlags(ChangeFlag.None);

    const view = this.view;
    const target = this.target;

    // Start timer for tile loading time
    const timer = new StopWatch(undefined, true);

    // if any animation is active, perform it now
    if (this._animator && this._animator.animate())
      this._animator = undefined; // animation completed

    let isRedrawNeeded = this._redrawPending || this._doContinuousRendering;
    this._redrawPending = false;

    if (target.updateViewRect()) {
      target.onResized();
      this.invalidateController();
    }

    if (this._selectionSetDirty) {
      target.setHiliteSet(view.iModel.hilited);
      this._selectionSetDirty = false;
      isRedrawNeeded = true;
    }

    let overridesNeeded = changeFlags.areFeatureOverridesDirty;

    if (!this._scheduleScriptFractionValid) {
      target.animationFraction = this.scheduleScriptFraction;
      isRedrawNeeded = true;
      this._scheduleScriptFractionValid = true;
      const scheduleScript = view.displayStyle.scheduleScript;
      if (scheduleScript) {
        const scheduleTime = scheduleScript.duration.fractionToPoint(target.animationFraction);
        if (scheduleTime !== this._scheduleTime) {
          this._scheduleTime = scheduleTime;
          target.animationBranches = scheduleScript.getAnimationBranches(scheduleTime);
          if (scheduleScript.containsFeatureOverrides)
            overridesNeeded = true;
        }
      }
    }

    if (overridesNeeded) {
      const ovr = new FeatureSymbology.Overrides(this);
      target.overrideFeatureSymbology(ovr);
      isRedrawNeeded = true;
    }

    if (!this._controllerValid)
      this.setupFromView();

    if (!this._sceneValid) {
      if (!this._freezeScene) {
        this.numSelectedTiles = this.numReadyTiles = 0;
        const context = this.createSceneContext();
        view.createScene(context);
        this.forEachTiledGraphicsProviderTree((ref) => ref.addToScene(context));

        context.requestMissingTiles();

        target.changeScene(context.graphics);
        target.changeBackgroundMap(context.backgroundGraphics);
        target.changeOverlayGraphics(context.overlayGraphics);
        target.changePlanarClassifiers(context.planarClassifiers);
        target.changeActiveVolumeClassifierProps(context.getActiveVolumeClassifierProps(), context.getActiveVolumeClassifierModelId());
        target.changeTextureDrapes(context.textureDrapes);

        isRedrawNeeded = true;
      }

      this._sceneValid = true;
    }

    if (!this._renderPlanValid) {
      this.validateRenderPlan();
      isRedrawNeeded = true;
    }

    if (!this._decorationsValid) {
      const decorations = new Decorations();
      this.addDecorations(decorations);
      target.changeDecorations(decorations);
      this._decorationsValid = true;
      isRedrawNeeded = true;
    }

    let requestNextAnimation = false;
    if (this.processFlash()) {
      target.setFlashed(undefined !== this._flashedElem ? this._flashedElem : Id64.invalid, this.flashIntensity);
      isRedrawNeeded = true;
      requestNextAnimation = undefined !== this._flashedElem;
    }

    timer.stop();
    if (isRedrawNeeded) {
      target.drawFrame(timer.elapsed.milliseconds);
      this.onRender.raiseEvent(this);
    }

    // Dispatch change events after timer has stopped and update has finished.
    if (changeFlags.hasChanges) {
      this.onViewportChanged.raiseEvent(this, changeFlags);

      if (changeFlags.displayStyle)
        this.onDisplayStyleChanged.raiseEvent(this);

      if (changeFlags.viewedModels)
        this.onViewedModelsChanged.raiseEvent(this, changeFlags);

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

  /** @internal */
  protected addDecorations(_decorations: Decorations): void { }

  /** Read selected data about each pixel within a rectangular region of this Viewport.
   * @param rect The area of the viewport's contents to read. The origin specifies the upper-left corner. Must lie entirely within the viewport's dimensions. This input viewport is specified using CSS pixels not device pixels.
   * @param selector Specifies which aspect(s) of data to read.
   * @param receiver A function accepting a [[Pixel.Buffer]] object from which the selected data can be retrieved, or receiving undefined if the viewport is not active, the rect is out of bounds, or some other error. The pixels received will be device pixels, not CSS pixels. See [[Viewport.devicePixelRatio]] and [[Viewport.cssPixelsToDevicePixels]].
   * @param excludeNonLocatable If true, geometry with the "non-locatable" flag set will not be drawn.
   * @note The [[Pixel.Buffer]] supplied to the `receiver` function becomes invalid once that function exits. Do not store a reference to it.
   * @beta
   */
  public readPixels(rect: ViewRect, selector: Pixel.Selector, receiver: Pixel.Receiver, excludeNonLocatable = false): void {
    const viewRect = this.viewRect;
    if (!rect.isContained(viewRect))
      receiver(undefined);
    else
      this.target.readPixels(rect, selector, receiver, excludeNonLocatable);
  }

  /** Read the current image from this viewport from the rendering system. If a view rectangle outside the actual view is specified, the entire view is captured.
   * @param rect The area of the view to read. The origin of a viewRect must specify the upper left corner.
   * @param targetSize The size of the image to be returned. The size can be larger or smaller than the original view.
   * @param flipVertically If true, the image is flipped along the x-axis.
   * @returns The contents of the viewport within the specified rectangle as a bitmap image, or undefined if the image could not be read.
   * @note By default the image is returned with the coordinate (0,0) referring to the bottom-most pixel. Pass `true` for `flipVertically` to flip it along the x-axis.
   */
  public readImage(rect: ViewRect = new ViewRect(0, 0, -1, -1), targetSize: Point2d = Point2d.createZero(), flipVertically: boolean = false): ImageBuffer | undefined {
    return this.target.readImage(rect, targetSize, flipVertically);
  }

  /** Reads the current image from this viewport into an HTMLCanvasElement with a Canvas2dRenderingContext such that additional 2d graphics can be drawn onto it.
   * @internal
   */
  public readImageToCanvas(): HTMLCanvasElement {
    return this.target.readImageToCanvas();
  }

  /** Get the point at the specified x and y location in the pixel buffer in npc coordinates
   * @beta
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

  /** Get the point at the specified x and y location in the pixel buffer in world coordinates
   * @beta
   */
  public getPixelDataWorldPoint(pixels: Pixel.Buffer, x: number, y: number, out?: Point3d): Point3d | undefined {
    const npc = this.getPixelDataNpcPoint(pixels, x, y, out);
    if (undefined !== npc)
      this.npcToWorld(npc, npc);

    return npc;
  }

  /** @internal */
  public collectStatistics(stats: RenderMemory.Statistics): void {
    const trees = new TileTreeSet();
    this.discloseTileTrees(trees);
    for (const tree of trees.trees)
      tree.collectStatistics(stats);
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
   * @beta
   */
  public get devicePixelRatio(): number {
    return this.target.devicePixelRatio;
  }

  /** Convert a number in CSS pixels to device pixels using this Viewport's device pixel ratio.
   * See: https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio
   * @param num The number in CSS pixels to scale
   * @returns The resulting number in device pixels
   * @beta
   */
  public cssPixelsToDevicePixels(cssPixels: number): number {
    return this.target.cssPixelsToDevicePixels(cssPixels);
  }
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
 * @public
 */
export class ScreenViewport extends Viewport {

  /** Settings that may be adjusted to control the way animations of viewing operations work.
   * @beta
   */
  public static animation = {
    /** Duration of animations of viewing operations. */
    time: {
      fast: BeDuration.fromSeconds(.75),
      normal: BeDuration.fromSeconds(1.25),
      slow: BeDuration.fromSeconds(2.0),
      wheel: BeDuration.fromSeconds(.175), // zooming with the wheel
    },
    /** The easing function to use for view animations. */
    easing: Easing.Cubic.Out,
    /** ZoomOut pertains to view transitions that move far distances, but maintain the same view direction.
     * In that case we zoom out, move the camera, and zoom back in rather than transitioning linearly to
     * provide context for the starting and ending positions. These settings control how and when that happens.
     */
    zoomOut: {
      /** whether to allow zooming out. If you don't want it, set this to false. */
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
      /** zoom out/in only if the beginning and ending view's range, each expanded by this factor, overlap. */
      margin: 2.5,
      /** multiply the duration of the animation by this factor if perform a zoom out. */
      durationFactor: 2,
    },
  };

  private _evController?: EventController;
  private _viewCmdTargetCenter?: Point3d;
  /** The number of entries in the view undo/redo buffer. */
  public maxUndoSteps = 20;
  private readonly _forwardStack: ViewPose[] = [];
  private readonly _backStack: ViewPose[] = [];
  private _currentBaseline?: ViewPose;
  private _lastPose?: ViewPose; // the pose the last time this view was rendered
  private _webglCanvas?: HTMLCanvasElement;
  private _logo!: HTMLImageElement;

  /** The parent HTMLDivElement of the canvas. */
  public readonly parentDiv: HTMLDivElement;
  /** The div created to hold all viewport elements. */
  public readonly vpDiv: HTMLDivElement;
  /** The canvas to display the view contents. */
  public readonly canvas: HTMLCanvasElement;
  /** The HTMLDivElement used for HTML decorations. May be referenced from the DOM by class "overlay-decorators". */
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
    vp.changeView(view);
    return vp;
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

  /** @internal */
  public addNewDiv(className: string, overflowHidden: boolean, z: number): HTMLDivElement {
    const div = document.createElement("div");
    div.className = className;
    div.style.pointerEvents = "none";
    div.style.overflow = overflowHidden ? "hidden" : "visible";
    this.addChildDiv(this.vpDiv, div, z);
    return div;
  }

  /** The HTMLImageElement of the iModel.js logo displayed in this ScreenViewport
   * @beta
   */
  public get logo() { return this._logo; }

  /** @internal */
  protected addLogo() {
    const logo = this._logo = IModelApp.makeHTMLElement("img", { parent: this.vpDiv, className: "imodeljs-icon" });
    logo.src = "images/imodeljs-icon.svg";

    const showLogos = (ev: Event) => {
      const aboutBox = IModelApp.makeModalDiv({ autoClose: true, width: 460, closeBox: true }).modal;
      const logos = IModelApp.makeHTMLElement("table", { parent: aboutBox, className: "logo-cards" });
      if (undefined !== IModelApp.applicationLogoCard)
        logos.appendChild(IModelApp.applicationLogoCard());
      logos.appendChild(IModelApp.makeIModelJsLogoCard());
      this.displayStyle.getAttribution(logos, this);
      ev.stopPropagation();
    };
    logo.onclick = showLogos;
    logo.addEventListener("touchstart", showLogos);
    logo.onmousemove = logo.onmousedown = logo.onmouseup = (ev) => ev.stopPropagation();
  }

  /** @internal */
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

    this.decorationDiv = this.addNewDiv("overlay-decorators", true, 30);
    this.toolTipDiv = this.addNewDiv("overlay-tooltip", false, 40);
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

  /** Set the event controller for this Viewport. Destroys previous controller, if one was defined. */
  public setEventController(controller?: EventController) {
    if (this._evController)
      this._evController.destroy();

    this._evController = controller;
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
    if (DepthPointSource.TargetPoint === depthResult.source)
      return undefined;
    const result = undefined !== out ? out : new Point3d();
    result.setFrom(depthResult.plane.getOriginRef());
    return result;
  }

  /** Find a point on geometry visible in this Viewport, within a radius of supplied pick point.
   * If no geometry is selected, return the point projected to the most appropriate reference plane.
   * @param pickPoint Point to search about, in world coordinates
   * @param radius Radius, in pixels, of the circular area to search.
   * @param options Optional settings to control what can be selected.
   * @returns A plane with origin from closest geometry point or reference plane projection and the source of the depth point.
   * @note The result plane normal is valid when the source is not geometry or a reality model.
   * @alpha
   */
  public pickDepthPoint(pickPoint: Point3d, radius?: number, options?: DepthPointOptions): { plane: Plane3dByOriginAndUnitNormal, source: DepthPointSource, sourceId?: string } {
    if (!this.view.is3d())
      return { plane: Plane3dByOriginAndUnitNormal.createXYPlane(pickPoint), source: DepthPointSource.ACS };

    if (undefined === radius)
      radius = this.pixelsFromInches(ToolSettings.viewToolPickRadiusInches);

    const picker = new ElementPicker();
    const locateOpts = new LocateOptions();
    locateOpts.allowNonLocatable = (undefined === options || !options.excludeNonLocatable);
    locateOpts.allowDecorations = (undefined === options || !options.excludeDecorations);
    locateOpts.allowExternalIModels = (undefined === options || !options.excludeExternalIModels);

    if (0 !== picker.doPick(this, pickPoint, radius, locateOpts)) {
      const hitDetail = picker.getHit(0)!;
      const geomPlane = Plane3dByOriginAndUnitNormal.create(hitDetail.getPoint(), this.view.getZVector())!;
      return { plane: geomPlane, source: (hitDetail.isModelHit ? DepthPointSource.Model : DepthPointSource.Geometry), sourceId: hitDetail.sourceId };
    }

    const eyePoint = this.worldToViewMap.transform1.columnZ();
    const direction = Vector3d.createFrom(eyePoint);
    const aa = Geometry.conditionalDivideFraction(1, eyePoint.w);
    if (aa !== undefined) {
      const xyzEye = direction.scale(aa);
      direction.setFrom(pickPoint.vectorTo(xyzEye));
    }
    direction.scaleToLength(-1.0, direction);
    const boresite = Ray3d.create(pickPoint, direction);
    const projectedPt = Point3d.createZero();

    // returns true if there's an intersection that isn't behind the front plane
    const boresiteIntersect = (plane: Plane3dByOriginAndUnitNormal) => {
      const dist = boresite.intersectionWithPlane(plane, projectedPt);
      if (undefined === dist)
        return false;
      const npcPt = this.worldToNpc(projectedPt);
      return npcPt.z < 1.0;
    };

    if (undefined !== this.backgroundMapPlane && boresiteIntersect(this.backgroundMapPlane))
      return { plane: Plane3dByOriginAndUnitNormal.create(projectedPt, this.backgroundMapPlane.getNormalRef())!, source: DepthPointSource.BackgroundMap };

    if (this.view.getDisplayStyle3d().environment.ground.display) {
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

    this.worldToNpc(pickPoint, projectedPt); projectedPt.z = targetPointNpc.z; this.npcToWorld(projectedPt, projectedPt);
    return { plane: Plane3dByOriginAndUnitNormal.create(projectedPt, this.view.getZVector())!, source: DepthPointSource.TargetPoint };
  }

  /** @internal */
  public animateFrustumChange(options?: ViewAnimationOptions) {
    if (this._lastPose && this._currentBaseline)
      this.setAnimator(new FrustumAnimator(options ? options : {}, this, this._lastPose, this.view.savePose()));
  }

  /** @internal */
  public pickCanvasDecoration(pt: XAndY) { return this.target.pickOverlayDecoration(pt); }

  /** Get the ClientRect of the canvas for this Viewport. */
  public getClientRect(): ClientRect { return this.canvas.getBoundingClientRect(); }

  /** The ViewRect for this ScreenViewport. Left and top will be 0, right will be the width, and bottom will be the height. */
  public get viewRect(): ViewRect { this._viewRange.init(0, 0, this.canvas.clientWidth, this.canvas.clientHeight); return this._viewRange; }

  /** @internal */
  protected addDecorations(decorations: Decorations): void {
    ScreenViewport.removeAllChildren(this.decorationDiv);
    const context = new DecorateContext(this, decorations);
    this.view.decorate(context);
    this.forEachTiledGraphicsProviderTree((ref) => ref.decorate(context));

    for (const decorator of IModelApp.viewManager.decorators)
      decorator.decorate(context);
  }

  /** Change the cursor for this Viewport */
  public setCursor(cursor: string = "default"): void {
    this.canvas.style.cursor = cursor;
  }

  /** @internal */
  public synchWithView(options?: ViewChangeOptions | boolean): void {
    options = (undefined === options) ? {} :
      (typeof options !== "boolean") ? options : { noSaveInUndo: !options }; // for backwards compatibility, was "saveInUndo"

    super.synchWithView(options);

    if (true !== options.noSaveInUndo)
      this.saveViewUndo();
    if (true === options.animateFrustumChange)
      this.animateFrustumChange(options);
  }

  /** @internal */
  protected validateRenderPlan() {
    super.validateRenderPlan();
    this._lastPose = this.view.savePose();
  }
  /** Change the ViewState of this Viewport
   * @param view a fully loaded (see discussion at [[ViewState.load]] ) ViewState
   * @param opts options for how the view change operation should work
   */
  public changeView(view: ViewState, opts?: ViewChangeOptions) {
    if (view === this.view) // nothing to do
      return;

    this.setAnimator(undefined); // make sure we clear any active animators before we change views.

    if (opts === undefined)
      opts = { animationTime: ScreenViewport.animation.time.slow.milliseconds };

    // determined whether we can animate this ViewState change
    const doAnimate = this.view && this.view.hasSameCoordinates(view) && false !== opts.animateFrustumChange;
    if (!doAnimate)
      this.clearViewUndo(); // if we can animate, don't throw out view undo.

    super.changeView(view, opts);
    this.saveViewUndo();

    if (doAnimate)
      this.animateFrustumChange(opts);
  }

  /** @internal */
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
      this._currentBaseline!.undoTime = now; // save time we put this entry in undo buffer
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

    this._backStack.push(this._currentBaseline!);
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
    const color = context.viewport.hilite.color.invert(); // Invert hilite color for good contrast
    const colorFill = color.clone();

    color.setTransparency(100);
    colorFill.setTransparency(200);
    builder.setSymbology(color, colorFill, 1);

    const radius = (2.5 * aperture) * context.viewport.getPixelSizeAtPoint(hit.snapPoint);
    const rMatrix = Matrix3d.createRigidHeadsUp(hit.normal);
    const ellipse = Arc3d.createScaledXYColumns(hit.snapPoint, rMatrix, radius, radius, AngleSweep.create360());

    builder.addArc(ellipse, true, true);
    builder.addArc(ellipse, false, false);

    const length = (0.6 * radius);
    const normal = Vector3d.create();

    ellipse.vector0.normalize(normal);
    const pt1 = hit.snapPoint.plusScaled(normal, length);
    const pt2 = hit.snapPoint.plusScaled(normal, -length);
    builder.addLineString([pt1, pt2]);

    ellipse.vector90.normalize(normal);
    const pt3 = hit.snapPoint.plusScaled(normal, length);
    const pt4 = hit.snapPoint.plusScaled(normal, -length);
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
      this.vpDiv.removeChild(this._webglCanvas!);
      this._webglCanvas = undefined;
    } else {
      assert(undefined === this._webglCanvas); // see getter...
      this._webglCanvas = webglCanvas;

      // this.canvas has zIndex 10. Make webgl canvas' zIndex lower so that canvas decorations draw on top.
      this.addChildDiv(this.vpDiv, webglCanvas, 5);
    }

    this.target.updateViewRect();
    this.invalidateRenderPlan();
  }
}

/** Forms a 2-way connection between 2 Viewports of the same iModel, such that any change of the parameters in one will be reflected in the other.
 * For example, Navigator uses this class to synchronize two views for revision comparison.
 * @note It is possible to synchronize two Viewports from two different [[IModelConnection]]s of the same iModel.
 * @alpha
 */
export class TwoWayViewportSync {
  private _removals: VoidFunction[] = [];
  private _isEcho = false;
  private syncView(source: Viewport, target: Viewport) {
    if (this._isEcho) return;
    this._isEcho = true; // so we don't react to the echo of this sync
    target.applyViewState(source.view.clone(target.iModel));
    this._isEcho = false;
  }

  /** Establish the connection between two Viewports. When this method is called, view2 is initialized with the state of view1. */
  public connect(view1: Viewport, view2: Viewport) {
    this.disconnect();

    const viewState2 = view1.view.clone(view2.iModel); // use view1 as the starting point
    view2.applyViewState(viewState2);

    // listen to the onViewChanged events from both views
    this._removals.push(view1.onViewChanged.addListener(() => this.syncView(view1, view2)));
    this._removals.push(view2.onViewChanged.addListener(() => this.syncView(view2, view1)));
  }

  /** Remove the connection between the two views. */
  public disconnect() { this._removals.forEach((removal) => removal()); }
}

/** An off-screen viewport is not rendered to the screen. It is never added to the [[ViewManager]], therefore does not participate in
 * the render loop. It must be initialized with an explicit height and width, and its renderFrame function must be manually invoked.
 * @internal
 */
export class OffScreenViewport extends Viewport {
  protected _isAspectRatioLocked = false;

  public static create(view: ViewState, viewRect?: ViewRect, lockAspectRatio = false) {
    const rect = new ViewRect(0, 0, 1, 1);
    if (undefined !== viewRect)
      rect.setFrom(viewRect);

    const vp = new this(IModelApp.renderSystem.createOffscreenTarget(rect));
    vp._isAspectRatioLocked = lockAspectRatio;
    vp.changeView(view);
    vp._decorationsValid = true;
    return vp;
  }

  public get isAspectRatioLocked(): boolean { return this._isAspectRatioLocked; }
  public get viewRect(): ViewRect { return this.target.viewRect; }

  public setRect(rect: ViewRect, temporary: boolean = false) {
    this.target.setViewRect(rect, temporary);
    this.changeView(this.view);
  }
}

/** @internal */
export function linePlaneIntersect(outP: Point3d, linePt: Point3d, lineNormal: Vector3d | undefined, planePt: Point3d, planeNormal: Vector3d, perpendicular: boolean): void {
  let dot = 0;
  if (lineNormal)
    dot = lineNormal.dotProduct(planeNormal);
  else
    perpendicular = true;

  let temp: Vector3d;
  if (perpendicular || Math.abs(dot) < .001) {
    const t = linePt.vectorTo(planePt).dotProduct(planeNormal);
    temp = planeNormal.scale(t);
  } else {
    const t = (planeNormal.dotProduct(planePt) - planeNormal.dotProduct(linePt)) / dot;
    temp = lineNormal!.scale(t);
  }

  outP.setFrom(temp.plus(linePt));
}
