/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { BeEvent, CompressedId64Set, Id64String } from "@itwin/core-bentley";
import { Constant, Matrix3d, Range3d, XYAndZ } from "@itwin/core-geometry";
import { AxisAlignedBox3d, HydrateViewStateRequestProps, HydrateViewStateResponseProps, SpatialViewDefinitionProps, ViewStateProps } from "@itwin/core-common";
import { AuxCoordSystemSpatialState, AuxCoordSystemState } from "./AuxCoordSys";
import { ModelSelectorState } from "./ModelSelectorState";
import { CategorySelectorState } from "./CategorySelectorState";
import { DisplayStyle3dState } from "./DisplayStyleState";
import { GeometricModel3dState, GeometricModelState } from "./ModelState";
import { SceneContext } from "./ViewContext";
import { IModelConnection } from "./IModelConnection";
import { AttachToViewportArgs, ViewState3d } from "./ViewState";
import { SpatialTileTreeReferences, TileTreeReference } from "./tile/internal";

/** Options supplied to [[SpatialViewState.computeFitRange]].
 * @public
 */
export interface ComputeSpatialViewFitRangeOptions {
  /** The minimal extents. The computed range will be unioned with this range if supplied. */
  baseExtents?: Range3d;
}

/** Defines a view of one or more SpatialModels.
 * The list of viewed models is stored in the ModelSelector.
 * @public
 * @extensions
 */
export class SpatialViewState extends ViewState3d {
  public static override get className() { return "SpatialViewDefinition"; }

  private readonly _treeRefs: SpatialTileTreeReferences;
  private _modelSelector: ModelSelectorState;
  private readonly _unregisterModelSelectorListeners: VoidFunction[] = [];

  /** An event raised when the set of models viewed by this view changes, *only* if the view is attached to a [[Viewport]].
   * @public
   */
  public readonly onViewedModelsChanged = new BeEvent<() => void>();

  public get modelSelector(): ModelSelectorState {
    return this._modelSelector;
  }

  public set modelSelector(selector: ModelSelectorState) {
    if (selector === this.modelSelector)
      return;

    const isAttached = this.isAttachedToViewport;
    this.unregisterModelSelectorListeners();

    this._modelSelector = selector;

    if (isAttached) {
      this.registerModelSelectorListeners();
      this.onViewedModelsChanged.raiseEvent();
    }

    this.markModelSelectorChanged();
  }

  /** Create a new *blank* SpatialViewState. The returned SpatialViewState will nave non-persistent empty [[CategorySelectorState]] and [[ModelSelectorState]],
   * and a non-persistent [[DisplayStyle3dState]] with default values for all of its components. Generally after creating a blank SpatialViewState,
   * callers will modify the state to suit specific needs.
   * @param iModel The IModelConnection for the new SpatialViewState
   * @param origin The origin for the new SpatialViewState
   * @param extents The extents for the new SpatialViewState
   * @param rotation The rotation of the new SpatialViewState. If undefined, use top view.
   * @public
   */
  public static createBlank(iModel: IModelConnection, origin: XYAndZ, extents: XYAndZ, rotation?: Matrix3d): SpatialViewState {
    const blank = {} as any;
    const cat = new CategorySelectorState(blank, iModel);
    const modelSelectorState = new ModelSelectorState(blank, iModel);
    const displayStyleState = new DisplayStyle3dState(blank, iModel);
    const view = new this(blank, iModel, cat, displayStyleState, modelSelectorState);
    view.setOrigin(origin);
    view.setExtents(extents);
    if (undefined !== rotation)
      view.setRotation(rotation);
    return view;
  }

  public static override createFromProps(props: ViewStateProps, iModel: IModelConnection): SpatialViewState {
    const cat = new CategorySelectorState(props.categorySelectorProps, iModel);
    const displayStyleState = new DisplayStyle3dState(props.displayStyleProps, iModel);
    const modelSelectorState = new ModelSelectorState(props.modelSelectorProps!, iModel);
    return new this(props.viewDefinitionProps as SpatialViewDefinitionProps, iModel, cat, displayStyleState, modelSelectorState);
  }

  public override toProps(): ViewStateProps {
    const props = super.toProps();
    props.modelSelectorProps = this.modelSelector.toJSON();
    return props;
  }

  constructor(props: SpatialViewDefinitionProps, iModel: IModelConnection, arg3: CategorySelectorState, displayStyle: DisplayStyle3dState, modelSelector: ModelSelectorState) {
    super(props, iModel, arg3, displayStyle);
    this._modelSelector = modelSelector;
    if (arg3 instanceof SpatialViewState) // from clone
      this._modelSelector = arg3.modelSelector.clone();

    this._treeRefs = SpatialTileTreeReferences.create(this);
  }

  /** @internal */
  public override isSpatialView(): this is SpatialViewState { return true; }

  public override equals(other: this): boolean { return super.equals(other) && this.modelSelector.equals(other.modelSelector); }

  public override createAuxCoordSystem(acsName: string): AuxCoordSystemState { return AuxCoordSystemSpatialState.createNew(acsName, this.iModel); }
  public get defaultExtentLimits() { return { min: Constant.oneMillimeter, max: 3 * Constant.diameterOfEarth }; } // Increased max by 3X to support globe mode.

  /** @internal */
  public markModelSelectorChanged(): void {
    this._treeRefs.update();
  }

  /** Get world-space viewed extents based on the iModel's project extents.
   * @deprecated in 3.6. These extents are based on [[IModelConnection.displayedExtents]], which is deprecated. Consider using [[computeFitRange]] or [[getViewedExtents]] instead.
   */
  protected getDisplayedExtents(): AxisAlignedBox3d {
    /* eslint-disable-next-line deprecation/deprecation */
    const extents = Range3d.fromJSON<AxisAlignedBox3d>(this.iModel.displayedExtents);
    extents.scaleAboutCenterInPlace(1.0001); // projectExtents. lying smack up against the extents is not excluded by frustum...
    extents.extendRange(this.getGroundExtents());
    return extents;
  }

  private computeBaseExtents(): AxisAlignedBox3d {
    const extents = Range3d.fromJSON<AxisAlignedBox3d>(this.iModel.projectExtents);

    // Ensure geometry coincident with planes of the project extents is not clipped.
    extents.scaleAboutCenterInPlace(1.0001);

    // Ensure ground plane is not clipped, if it's being drawn.
    extents.extendRange(this.getGroundExtents());

    return extents;
  }

  /** Compute a volume in world coordinates tightly encompassing the contents of the view. The volume is computed from the union of the volumes of the
   * view's viewed models, including [GeometricModel]($backend)s and reality models.
   * Those volumes are obtained from the [[TileTree]]s used to render those models, so any tile tree that has not yet been loaded will not contribute to the computation.
   * If `options.baseExtents` is defined, it will be unioned with the computed volume.
   * If the computed volume is null (empty), a default volume will be computed from [IModel.projectExtents]($common), which may be a looser approximation of the
   * models' volumes.
   * @param options Options used to customize how the volume is computed.
   * @returns A non-null volume in world coordinates encompassing the contents of the view.
   */
  public computeFitRange(options?: ComputeSpatialViewFitRangeOptions): AxisAlignedBox3d {
    // Fit to the union of the ranges of all loaded tile trees.
    const range = options?.baseExtents?.clone() ?? new Range3d();
    this.forEachTileTreeRef((ref) => {
      ref.unionFitRange(range);
    });

    // Fall back to the project extents if necessary.
    if (range.isNull)
      range.setFrom(this.computeBaseExtents());

    // Avoid ridiculously small extents.
    range.ensureMinLengths(1.0);

    return range;
  }

  public getViewedExtents(): AxisAlignedBox3d {
    // Encompass the project extents and ground plane.
    const extents = this.computeBaseExtents();

    // Include any tile trees that extend outside the project extents.
    extents.extendRange(this.computeFitRange());

    return extents;
  }

  public override toJSON(): SpatialViewDefinitionProps {
    const val = super.toJSON() as SpatialViewDefinitionProps;
    val.modelSelectorId = this.modelSelector.id;
    return val;
  }

  /** @internal */
  protected override preload(hydrateRequest: HydrateViewStateRequestProps): void {
    super.preload(hydrateRequest);
    const notLoaded = this.iModel.models.filterLoaded(this.modelSelector.models);
    if (undefined === notLoaded)
      return; // all requested models are already loaded
    hydrateRequest.notLoadedModelSelectorStateModels = CompressedId64Set.sortAndCompress(notLoaded);
  }

  /** @internal */
  protected override async postload(hydrateResponse: HydrateViewStateResponseProps): Promise<void> {
    const promises = [];
    promises.push(super.postload(hydrateResponse));
    if (hydrateResponse.modelSelectorStateModels !== undefined)
      promises.push(this.iModel.models.updateLoadedWithModelProps(hydrateResponse.modelSelectorStateModels));
    await Promise.all(promises);
  }

  public viewsModel(modelId: Id64String): boolean { return this.modelSelector.containsModel(modelId); }
  public clearViewedModels() { this.modelSelector.models.clear(); }
  public addViewedModel(id: Id64String) { this.modelSelector.addModels(id); }
  public removeViewedModel(id: Id64String) { this.modelSelector.dropModels(id); }

  public forEachModel(func: (model: GeometricModelState) => void) {
    for (const modelId of this.modelSelector.models) {
      const model = this.iModel.models.getLoaded(modelId);
      if (undefined !== model && undefined !== model.asGeometricModel3d)
        func(model as GeometricModel3dState);
    }
  }

  /** @internal */
  public override forEachModelTreeRef(func: (treeRef: TileTreeReference) => void): void {
    for (const ref of this._treeRefs)
      func(ref);
  }

  /** @internal */
  public override createScene(context: SceneContext): void {
    super.createScene(context);
    context.textureDrapes.forEach((drape) => drape.collectGraphics(context));
    context.viewport.target.updateSolarShadows(this.getDisplayStyle3d().wantShadows ? context : undefined);
  }

  /** See [[ViewState.attachToViewport]]. */
  public override attachToViewport(args: AttachToViewportArgs): void {
    super.attachToViewport(args);
    this.registerModelSelectorListeners();
    this._treeRefs.attachToViewport(args);
  }

  /** See [[ViewState.detachFromViewport]]. */
  public override detachFromViewport(): void {
    super.detachFromViewport();
    this._treeRefs.detachFromViewport();
    this.unregisterModelSelectorListeners();
  }

  /** Chiefly for debugging: change the "deactivated" state of one or more tile tree references. Deactivated references are
   * omitted when iterating the references, so e.g. their graphics are omitted from the scene.
   * @param modelIds The Ids of one or more models whose tile tree references are to be affected. If omitted, all models are affected.
   * @param deactivated True to deactivate the specified references, false to reactivate them, undefined to invert each one's current state.
   * @param which The references to be affected as either a broad category or one or more indices of animated references.
   * @internal
   */
  public setTileTreeReferencesDeactivated(modelIds: Id64String | Id64String[] | undefined, deactivated: boolean | undefined, which: "all" | "animated" | "primary" | "section" | number[]): void {
    this._treeRefs.setDeactivated(modelIds, deactivated, which);
  }

  private registerModelSelectorListeners(): void {
    const models = this.modelSelector.observableModels;
    const func = () => {
      this.markModelSelectorChanged();
      this.onViewedModelsChanged.raiseEvent();
    };

    this._unregisterModelSelectorListeners.push(models.onAdded.addListener(func));
    this._unregisterModelSelectorListeners.push(models.onDeleted.addListener(func));
    this._unregisterModelSelectorListeners.push(models.onCleared.addListener(func));
  }

  private unregisterModelSelectorListeners(): void {
    this._unregisterModelSelectorListeners.forEach((f) => f());
    this._unregisterModelSelectorListeners.length = 0;
  }
}
/** Defines a spatial view that displays geometry on the image plane using a parallel orthographic projection.
 * @public
 * @extensions
 */
export class OrthographicViewState extends SpatialViewState {
  public static override get className() { return "OrthographicViewDefinition"; }

  constructor(props: SpatialViewDefinitionProps, iModel: IModelConnection, categories: CategorySelectorState, displayStyle: DisplayStyle3dState, modelSelector: ModelSelectorState) { super(props, iModel, categories, displayStyle, modelSelector); }

  public override supportsCamera(): boolean { return false; }
}
