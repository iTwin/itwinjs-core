/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Id64Arg, Id64String } from "@itwin/core-bentley";
import { View2dStyle, View3dStyle, ViewStyle, ViewStyleFlags } from "../ViewStyle";
import { AxisAlignedBox3d, ModelClipGroups, ViewFlags } from "@itwin/core-common";
import { IModelConnection } from "../../IModelConnection";
import { GeometricModelState } from "../../ModelState";
import { Range3d, Transform } from "@itwin/core-geometry";
import { DisclosedTileTreeSet, TileTreeReference } from "../../tile/internal";
import { RenderMemory } from "../../render/RenderMemory";
import { DecorateContext, SceneContext } from "../../ViewContext";
import { ComputeDisplayTransformArgs, ModelDisplayTransformProvider, ViewState } from "../../ViewState";
import { Viewport } from "../../Viewport";
import { RenderClipVolume } from "../../render/RenderClipVolume";
import { ComputeSpatialViewFitRangeOptions } from "../../SpatialViewState";
import { IIModelView, IModelView3d, IModelSpatialView, ViewCategorySelector, ViewModelSelector } from "../IModelView";

function equalIdSets(a: Set<Id64String>, b: Set<Id64String>): boolean {
  if (a.size !== b.size)
    return false;

  for (const id of a)
    if (!b.has(id))
      return false;

  return true;
}

export class ViewCategorySelectorImpl implements ViewCategorySelector {
  constructor(private readonly _view: ViewState) { }

  private get _selector() { return this._view.categorySelector; }
  
  get categories() { return this._selector.categories; }
  set categories(categories: Set<Id64String>) { this._selector.categories = categories; }

  isEquivalentTo(other: ViewCategorySelector) {
    return equalIdSets(this.categories, other.categories);
  }

  addCategories(arg: Id64Arg) { this._selector.addCategories(arg); }
  dropCategories(arg: Id64Arg) { this._selector.dropCategories(arg); }
  changeCategoryDisplay(arg: Id64Arg, add: boolean) { this._selector.changeCategoryDisplay(arg, add); }
}

export abstract class ViewImpl implements IIModelView {
  protected readonly _view: ViewState;
  readonly categorySelector: ViewCategorySelector;
  readonly style: ViewStyle;

  protected constructor(view: ViewState, style: ViewStyle) {
    this._view = view;
    this.categorySelector = new ViewCategorySelectorImpl(view);
    this.style = style;
  }

  get iModel() { return this._view.iModel; }
  
  get viewFlags() { return this.style.viewFlags; }
  set viewFlags(flags: ViewFlags) { this.style.viewFlags = flags; }

  isSpatial() { return this._view.isSpatialView(); }
  isDrawing() { return this._view.isDrawingView(); }
  isSheet() { return this._view.isSheetView(); }

  get areAllTileTreesLoaded() { return this._view.areAllTileTreesLoaded; }

  isSubCategoryVisible(id: Id64String) { return this._view.isSubCategoryVisible(id); }
  enableAllLoadedSubCategories(categoryIds: Id64Arg) { return this._view.enableAllLoadedSubCategories(categoryIds); }
  setSubCategoryVisible(subCategoryId: Id64String, visible: boolean) { return this._view.setSubCategoryVisible(subCategoryId, visible); }

  computeFitRange() { return this._view.computeFitRange(); }

  createScene(context: SceneContext) {
    // ###TODO need to ignore context reality models and not update solar shadows
    this._view.createScene(context);
  }
  viewsModel(modelId: Id64String) { return this._view.viewsModel(modelId); }

  forEachModel(func: (model: GeometricModelState) => void) { this._view.forEachModel(func); }

  forEachModelTreeRef(func: (treeRef: TileTreeReference) => void) {
    this._view.forEachModelTreeRef(func);
  }

  forEachTileTreeRef(func: (treeRef: TileTreeReference) => void) {
    this._view.forEachModelTreeRef(func);
  }

  discloseTileTrees(trees: DisclosedTileTreeSet) {
    this._view.forEachModelTreeRef((ref) => trees.disclose(ref));
  }

  collectStatistics(stats: RenderMemory.Statistics) {
    const trees = new DisclosedTileTreeSet();
    this.discloseTileTrees(trees);
    for (const tree of trees)
      tree.collectStatistics(stats);

    this._view.collectNonTileTreeStatistics(stats);
  }

  refreshForModifiedModels(modelIds: Id64Arg | undefined) { return this._view.refreshForModifiedModels(modelIds); }

  hasSameCoordinates(other: IIModelView): boolean {
    const view = other instanceof ViewImpl ? other : undefined;
    return undefined !== view && this._view.hasSameCoordinates(view._view);
  }

  getModelElevation(modelId: Id64String) { return this._view.getModelElevation(modelId); }
  get modelDisplayTransformProvider() { return this._view.modelDisplayTransformProvider; }
  set modelDisplayTransformProvider(provider: ModelDisplayTransformProvider | undefined) { this._view.modelDisplayTransformProvider = provider; }
  computeDisplayTransform(args: ComputeDisplayTransformArgs) { return this._view.computeDisplayTransform(args); }

  get secondaryViewports() { return this._view.secondaryViewports; }
  getAttachmentViewport(id: Id64String) { return this._view.getAttachmentViewport(id); }
}
