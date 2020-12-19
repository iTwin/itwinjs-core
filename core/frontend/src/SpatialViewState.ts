/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { Id64String } from "@bentley/bentleyjs-core";
import { Constant, Matrix3d, Range3d, XYAndZ } from "@bentley/geometry-core";
import { AxisAlignedBox3d, SpatialViewDefinitionProps, ViewStateProps } from "@bentley/imodeljs-common";
import { AuxCoordSystemSpatialState, AuxCoordSystemState } from "./AuxCoordSys";
import { ModelSelectorState } from "./ModelSelectorState";
import { CategorySelectorState } from "./CategorySelectorState";
import { DisplayStyle3dState } from "./DisplayStyleState";
import { GeometricModel3dState, GeometricModelState } from "./ModelState";
import { SceneContext } from "./ViewContext";
import { IModelConnection } from "./IModelConnection";
import { ViewState3d } from "./ViewState";
import { SpatialTileTreeReferences, TileTreeReference } from "./tile/internal";

/** Defines a view of one or more SpatialModels.
 * The list of viewed models is stored in the ModelSelector.
 * @public
 */
export class SpatialViewState extends ViewState3d {
  /** @internal */
  public static get className() { return "SpatialViewDefinition"; }
  public modelSelector: ModelSelectorState;
  private readonly _treeRefs: SpatialTileTreeReferences;

  /** Create a new *blank* SpatialViewState. The returned SpatialViewState will nave non-persistent empty [[CategorySelectorState]] and [[ModelSelectorState]],
   * and a non-persistent [[DisplayStyle3dState]] with default values for all of its components. Generally after creating a blank SpatialViewState,
   * callers will modify the state to suit specific needs.
   * @param iModel The IModelConnection for the new SpatialViewState
   * @param origin The origin for the new SpatialViewState
   * @param extents The extents for the new SpatialViewState
   * @param rotation The rotation of the new SpatialViewState. If undefined, use top view.
   * @beta
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

  public static createFromProps(props: ViewStateProps, iModel: IModelConnection): SpatialViewState {
    const cat = new CategorySelectorState(props.categorySelectorProps, iModel);
    const displayStyleState = new DisplayStyle3dState(props.displayStyleProps, iModel);
    const modelSelectorState = new ModelSelectorState(props.modelSelectorProps!, iModel);
    return new this(props.viewDefinitionProps as SpatialViewDefinitionProps, iModel, cat, displayStyleState, modelSelectorState);
  }

  public toProps(): ViewStateProps {
    const props = super.toProps();
    props.modelSelectorProps = this.modelSelector.toJSON();
    return props;
  }

  constructor(props: SpatialViewDefinitionProps, iModel: IModelConnection, arg3: CategorySelectorState, displayStyle: DisplayStyle3dState, modelSelector: ModelSelectorState) {
    super(props, iModel, arg3, displayStyle);
    this.modelSelector = modelSelector;
    if (arg3 instanceof SpatialViewState) // from clone
      this.modelSelector = arg3.modelSelector.clone();

    this._treeRefs = SpatialTileTreeReferences.create(this);
  }

  /** @internal */
  public isSpatialView(): this is SpatialViewState { return true; }

  public equals(other: this): boolean { return super.equals(other) && this.modelSelector.equals(other.modelSelector); }

  public createAuxCoordSystem(acsName: string): AuxCoordSystemState { return AuxCoordSystemSpatialState.createNew(acsName, this.iModel); }
  public get defaultExtentLimits() { return { min: Constant.oneMillimeter, max: 3 * Constant.diameterOfEarth }; } // Increased max by 3X to support globe mode.

  /** @internal */
  public markModelSelectorChanged(): void {
    this._treeRefs.update();
  }

  /** Get world-space viewed extents based on the iModel's project extents. */
  protected getDisplayedExtents(): AxisAlignedBox3d {
    const extents = Range3d.fromJSON<AxisAlignedBox3d>(this.iModel.displayedExtents);
    extents.scaleAboutCenterInPlace(1.0001); // projectExtents. lying smack up against the extents is not excluded by frustum...
    extents.extendRange(this.getGroundExtents());
    return extents;
  }

  /** Compute world-space range appropriate for fitting the view. If that range is null, use the displayed extents. */
  public computeFitRange(): AxisAlignedBox3d {
    // Loop over the current models in the model selector with loaded tile trees and union their ranges
    const range = new Range3d();
    this.forEachTileTreeRef((ref) => {
      ref.unionFitRange(range);
    });

    if (range.isNull)
      range.setFrom(this.getDisplayedExtents());

    range.ensureMinLengths(1.0);

    return range;
  }

  public getViewedExtents(): AxisAlignedBox3d {
    const extents = this.getDisplayedExtents();

    // Some displayed tile trees may have a transform applied that takes them outside of the displayed extents.
    extents.extendRange(this.computeFitRange());

    return extents;
  }

  public toJSON(): SpatialViewDefinitionProps {
    const val = super.toJSON() as SpatialViewDefinitionProps;
    val.modelSelectorId = this.modelSelector.id;
    return val;
  }
  public async load(): Promise<void> {
    await super.load();
    return this.modelSelector.load();
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
  public forEachModelTreeRef(func: (treeRef: TileTreeReference) => void): void {
    for (const ref of this._treeRefs)
      func(ref);
  }

  /** @internal */
  public createScene(context: SceneContext): void {
    super.createScene(context);
    context.textureDrapes.forEach((drape) => drape.collectGraphics(context));
    context.viewport.target.updateSolarShadows(this.getDisplayStyle3d().wantShadows ? context : undefined);
  }
}
/** Defines a spatial view that displays geometry on the image plane using a parallel orthographic projection.
 * @public
 */
export class OrthographicViewState extends SpatialViewState {
  /** @internal */
  public static get className() { return "OrthographicViewDefinition"; }

  constructor(props: SpatialViewDefinitionProps, iModel: IModelConnection, categories: CategorySelectorState, displayStyle: DisplayStyle3dState, modelSelector: ModelSelectorState) { super(props, iModel, categories, displayStyle, modelSelector); }

  public supportsCamera(): boolean { return false; }
}
