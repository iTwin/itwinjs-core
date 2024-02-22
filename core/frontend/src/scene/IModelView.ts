/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { Id64Arg, Id64String } from "@itwin/core-bentley";
import { View2dStyle, View3dStyle, ViewStyle, ViewStyleFlags } from "./ViewStyle";
import { AxisAlignedBox3d, ModelClipGroups } from "@itwin/core-common";
import { IModelConnection } from "../IModelConnection";
import { GeometricModelState } from "../ModelState";
import { Range3d, Transform } from "@itwin/core-geometry";
import { DisclosedTileTreeSet, TileTreeReference } from "../tile/internal";
import { RenderMemory } from "../render/RenderMemory";
import { DecorateContext, SceneContext } from "../ViewContext";
import { ComputeDisplayTransformArgs, ModelDisplayTransformProvider } from "../ViewState";
import { Viewport } from "../Viewport";
import { RenderClipVolume } from "../render/RenderClipVolume";
import { ComputeSpatialViewFitRangeOptions } from "../SpatialViewState";

export interface ViewCategorySelector {
  categories: Set<string>;
  isEquivalentTo(other: ViewCategorySelector): boolean;

  addCategories(arg: Id64Arg): void;
  dropCategories(arg: Id64Arg): void;
  changeCategoryDisplay(arg: Id64Arg, add: boolean): void;
}

export interface IIModelView {
  readonly iModel: IModelConnection;

  readonly categorySelector: ViewCategorySelector;
  readonly style: ViewStyle;
  viewFlags: ViewStyleFlags;

  isSpatial(): this is IModelSpatialView;
  isDrawing(): this is DrawingView;
  isSheet(): this is SheetView;

  // ###TODO scheduleScript, scheduleScriptReference
  // ###TODO analysisStyle

  readonly areAllTileTreesLoaded: boolean;

  isSubCategoryVisible(id: Id64String): boolean;
  enableAllLoadedSubCategories(categoryIds: Id64Arg): boolean;
  setSubCategoryVisible(subCategoryId: Id64String, visible: boolean): boolean;

  computeFitRange(): Range3d;

  viewsModel(modelId: Id64String): boolean;

  forEachModel(func: (model: GeometricModelState) => void): void;

  /** @internal */
  forEachModelTreeRef(func: (treeRef: TileTreeReference) => void): void;

  // ###TODO will this be needed externally (or at all)? Hopefully not.
  forEachTileTreeRef(func: (treeRef: TileTreeReference) => void): void;

  /** @internal */
  discloseTileTrees(trees: DisclosedTileTreeSet): void;

  /** @internal */
  collectStatistics(stats: RenderMemory.Statistics): void;

  /** @internal */
  createScene(context: SceneContext): void;

  /** @internal */
  // ###TODO draw sheet border, ground plane maybe; don't draw sky box, grid. decorate(context: DecorateContext): void;

  // get/setViewClip in addition to scene clip?

  /** @internal */
  refreshForModifiedModels(modelIds: Id64Arg | undefined): boolean;

  /** Determine whether this ViewState has the same coordinate system as another one.
   * They must be from the same iModel, and view a model in common.
   */
  hasSameCoordinates(other: IIModelView): boolean;

  /** @internal strictly for plan projection models. */
  getModelElevation(modelId: Id64String): number;

  modelDisplayTransformProvider: ModelDisplayTransformProvider | undefined;

  computeDisplayTransform(args: ComputeDisplayTransformArgs): Transform | undefined;

  /** Returns an iterator over additional Viewports used to construct this view's scene. e.g., those used for ViewAttachments and section drawings.
   * This exists chiefly for display-performance-test-app to determine when all tiles required for the view have been loaded.
   * @internal
   */
  readonly secondaryViewports: Iterable<Viewport>;

  /** Find the viewport that renders the contents of the view attachment with the specified element Id into this view.
   * @internal
   */
  getAttachmentViewport(_id: Id64String): Viewport | undefined;
}

export interface IModelView3d extends IIModelView {
  readonly is3dView: true;
  readonly is2dView?: never;

  readonly style: View3dStyle;

  modelClipGroups: ModelClipGroups;

  /** @internal */
  getModelClip(modelId: Id64String): RenderClipVolume | undefined;
}

export interface IModelView2d extends IIModelView {
  readonly is2dView: true;
  readonly is3dView?: never;

  readonly style: View2dStyle;
}

export interface ViewModelSelector {
 models: Set<Id64String>;
 isEquivalentTo(other: ViewModelSelector): boolean;
 addModels(models: Id64Arg): void;
 dropModels(models: Id64Arg): void;
}

export interface IModelSpatialView extends IModelView3d {
  readonly modelSelector: ViewModelSelector;

  // ###TODO used by ViewCreator3d when model extents are known before tile trees are loaded.
  // Needed here? Generalize so base extents can be passed to Scene/SceneObject range c:w
  // computeSpatialFitRange(options?: ComputeSpatialViewFitRangeOptions): AxisAlignedBox3d;
}

export interface DrawingView extends IModelView2d {

}

export interface SheetView extends IModelView2d {

}

export type IModelView = DrawingView | SheetView | IModelSpatialView;
