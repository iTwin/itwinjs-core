/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { GuidString, Id64Arg, Id64String, assert } from "@itwin/core-bentley";
import { View2dStyle, View3dStyle, ViewStyle, ViewStyleFlags } from "../ViewStyle";
import { AxisAlignedBox3d, ModelClipGroups, ViewFlags } from "@itwin/core-common";
import { IModelConnection } from "../../IModelConnection";
import { GeometricModelState } from "../../ModelState";
import { ClipVector, Range3d, Transform } from "@itwin/core-geometry";
import { DisclosedTileTreeSet, TileTreeReference } from "../../tile/internal";
import { RenderMemory } from "../../render/RenderMemory";
import { DecorateContext, SceneContext } from "../../ViewContext";
import { ComputeDisplayTransformArgs, ModelDisplayTransformProvider, ViewState, ViewState3d } from "../../ViewState";
import { Viewport } from "../../Viewport";
import { RenderClipVolume } from "../../render/RenderClipVolume";
import { ComputeSpatialViewFitRangeOptions, SpatialViewState } from "../../SpatialViewState";
import { IIModelView, IModelView3d, IModelSpatialView, ViewCategorySelector, ViewModelSelector, IModelView } from "../IModelView";
import { View3dStyleImpl } from "./ViewStyleImpl";
import { SceneObjectImpl } from "./SceneObjectImpl";
import { IModelSceneObject, ViewportScene } from "../ViewportScene";
import { HitDetail } from "../../HitDetail";

function equalIdSets(a: Set<Id64String>, b: Set<Id64String>): boolean {
  if (a.size !== b.size)
    return false;

  for (const id of a)
    if (!b.has(id))
      return false;

  return true;
}

export class ViewCategorySelectorImpl implements ViewCategorySelector {
  constructor(public readonly view: ViewState) { }

  private get _selector() { return this.view.categorySelector; }
  
  get categories() { return this._selector.categories; }
  set categories(categories: Set<Id64String>) { this._selector.categories = categories; }

  isEquivalentTo(other: ViewCategorySelector) {
    return equalIdSets(this.categories, other.categories);
  }

  addCategories(arg: Id64Arg) { this._selector.addCategories(arg); }
  dropCategories(arg: Id64Arg) { this._selector.dropCategories(arg); }
  changeCategoryDisplay(arg: Id64Arg, add: boolean) { this._selector.changeCategoryDisplay(arg, add); }
}

export abstract class IModelViewImpl implements IIModelView {
  public readonly impl: ViewState;
  protected readonly _style: ViewStyle;
  readonly categorySelector: ViewCategorySelector;

  protected constructor(view: ViewState, style: ViewStyle) {
    this.impl = view;
    this.categorySelector = new ViewCategorySelectorImpl(view);
    this._style = style;
  }

  get iModel() { return this.impl.iModel; }
  
  get style() { return this._style; }

  get viewFlags() { return this.style.viewFlags; }
  set viewFlags(flags: ViewFlags) { this.style.viewFlags = flags; }

  get clipVector(): ClipVector | undefined { return this.impl.getViewClip(); }
  set clipVector(clip: ClipVector | undefined) { this.impl.setViewClip(clip); }

  isSpatial() { return this.impl.isSpatialView(); }
  isDrawing() { return this.impl.isDrawingView(); }
  isSheet() { return this.impl.isSheetView(); }

  isSubCategoryVisible(id: Id64String) { return this.impl.isSubCategoryVisible(id); }
  enableAllLoadedSubCategories(categoryIds: Id64Arg) { return this.impl.enableAllLoadedSubCategories(categoryIds); }
  setSubCategoryVisible(subCategoryId: Id64String, visible: boolean) { return this.impl.setSubCategoryVisible(subCategoryId, visible); }

  computeFitRange() { return this.impl.computeFitRange(); }
  viewsModel(modelId: Id64String) { return this.impl.viewsModel(modelId); }

  forEachModel(func: (model: GeometricModelState) => void) { this.impl.forEachModel(func); }

  forEachModelTreeRef(func: (treeRef: TileTreeReference) => void) {
    this.impl.forEachModelTreeRef(func);
  }

  forEachTileTreeRef(func: (treeRef: TileTreeReference) => void) {
    this.impl.forEachModelTreeRef(func);
  }

  discloseTileTrees(trees: DisclosedTileTreeSet) {
    this.impl.forEachModelTreeRef((ref) => trees.disclose(ref));
  }

  collectStatistics(stats: RenderMemory.Statistics) {
    const trees = new DisclosedTileTreeSet();
    this.discloseTileTrees(trees);
    for (const tree of trees)
      tree.collectStatistics(stats);

    this.impl.collectNonTileTreeStatistics(stats);
  }

  refreshForModifiedModels(modelIds: Id64Arg | undefined) { return this.impl.refreshForModifiedModels(modelIds); }

  hasSameCoordinates(other: IIModelView): boolean {
    const view = other instanceof IModelViewImpl ? other : undefined;
    return undefined !== view && this.impl.hasSameCoordinates(view.impl);
  }

  getModelElevation(modelId: Id64String) { return this.impl.getModelElevation(modelId); }
  get modelDisplayTransformProvider() { return this.impl.modelDisplayTransformProvider; }
  set modelDisplayTransformProvider(provider: ModelDisplayTransformProvider | undefined) { this.impl.modelDisplayTransformProvider = provider; }
  computeDisplayTransform(args: ComputeDisplayTransformArgs) { return this.impl.computeDisplayTransform(args); }

  get secondaryViewports() { return this.impl.secondaryViewports; }
  getAttachmentViewport(id: Id64String) { return this.impl.getAttachmentViewport(id); }
}

export abstract class View3dImpl extends IModelViewImpl implements IModelView3d {
  readonly is3dView: true = true;

  protected constructor(view: ViewState3d) {
    super(view, new View3dStyleImpl(view));
  }

  override get style() { return this._style as View3dStyle; }

  protected get _view3d() { return this.impl as ViewState3d; }

  get modelClipGroups() { return this._view3d.modelClipGroups; }
  set modelClipGroups(groups: ModelClipGroups) { this._view3d.modelClipGroups = groups; }

  getModelClip(modelId: Id64String) { return this._view3d.getModelClip(modelId); }
}

export class ViewModelSelectorImpl implements ViewModelSelector {
  constructor(private readonly _view: SpatialViewState) { }

  private get _selector() { return this._view.modelSelector; }

  get models() { return this._selector.models; }
  set models(models: Set<Id64String>) { this._selector.models = models; }

  isEquivalentTo(other: ViewModelSelector) {
    return equalIdSets(this.models, other.models);
  }

  addModels(models: Id64Arg) { this._selector.addModels(models); }
  dropModels(models: Id64Arg) { this._selector.dropModels(models); }
}

export class IModelSpatialViewImpl extends View3dImpl implements IModelSpatialView {
  readonly modelSelector: ViewModelSelector;
  
  constructor(view: SpatialViewState) {
    super(view);
    this.modelSelector = new ViewModelSelectorImpl(view);
  }
}

type ViewImpl = IModelSpatialViewImpl /* ###TODO | DrawingViewImpl | SheetViewImpl */

export class IModelSceneObjectImpl<View extends ViewImpl> extends SceneObjectImpl implements IModelSceneObject {
  readonly _view: View;

  constructor(view: View, guid: GuidString, scene: ViewportScene) {
    super(guid, scene);
    this._view = view;
  }

  get view(): IModelView { return this._view; }

  override get isLoadingComplete() {
    return this._view.impl.areAllTileTreesLoaded;
  }

  override async getToolTip(hit: HitDetail): Promise<HTMLElement | string | undefined> {
    // ###TODO somewhere in the element locate code is a call to viewport.view.iModel.getToolTip...should move here.
    assert(undefined !== hit);
    return undefined;
  }

  override decorate(context: DecorateContext): void {
    // ###TODO ground plane, sheet border - but not skybox, grid.
    this._view.impl.decorate(context);
  }

  override draw(context: SceneContext): void {
    // ###TODO need to ignore context reality models and not update solar shadows
    this._view.impl.createScene(context);
  }
}
