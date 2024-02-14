/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { Id64, Id64Arg, Id64String } from "@itwin/core-bentley";
import { View3dStyle, ViewStyle, ViewStyleFlags } from "./ViewStyle";
import { FeatureAppearance, ModelClipGroups, SubCategoryOverride } from "@itwin/core-common";
import { IModelConnection } from "../IModelConnection";
import { GeometricModelState } from "../ModelState";
import { Range3d, Transform } from "@itwin/core-geometry";
import { DisclosedTileTreeSet, TileTreeReference } from "../tile/internal";
import { RenderMemory } from "../render/RenderMemory";
import { DecorateContext, SceneContext } from "../ViewContext";
import { ComputeDisplayTransformArgs, ModelDisplayTransformProvider } from "../ViewState";
import { Viewport } from "../Viewport";
import { RenderClipVolume } from "../render/RenderClipVolume";

export abstract class ViewCategorySelector {
 /** @internal */
 protected constructor() { }
 
 abstract get iModel(): IModelConnection;

 abstract categories: Set<string>;
 abstract equalState(other: ViewCategorySelector): boolean;

 has(id: Id64String): boolean {
  return this.categories.has(id);
 }

 isCategoryViewed(categoryId: Id64String): boolean {
  return this.has(categoryId);
 }

 addCategories(arg: Id64Arg): void {
  for (const id of Id64.iterable(arg))
   this.categories.add(id);
 }

 dropCategories(arg: Id64Arg): void {
  for (const id of Id64.iterable(arg))
   this.categories.delete(id);
 }

 changeCategoryDisplay(arg: Id64Arg, add: boolean): void {
  add ? this.addCategories(arg) : this.dropCategories(arg);
 }
}

export abstract class View {
 /** @internal */
 protected constructor() { }

 abstract get iModel(): IModelConnection;

 abstract categorySelector: ViewCategorySelector;

 abstract displayStyle: ViewStyle;
 
 get viewFlags(): ViewStyleFlags {
  return this.displayStyle.viewFlags;
 }

 set viewFlags(flags: ViewStyleFlags) {
  this.displayStyle.viewFlags = flags;
 }

 // ###TODO scheduleScript, scheduleScriptReference
 // ###TODO analysisStyle

 // ###TODO is this needed?
 abstract equals(other: this): boolean;

 abstract get areAllTileTreesLoaded(): boolean;

 getSubCategoryOverride(id: Id64String): SubCategoryOverride | undefined {
  return this.displayStyle.getSubCategoryOverride(id);
 }

 isSubCategoryVisible(id: Id64String): boolean {
  const app = this.iModel.subcategories.getSubCategoryAppearance(id);
  if (!app)
   return false;

  const ovr = this.getSubCategoryOverride(id);
  if (undefined === ovr?.invisible)
   return !app.invisible;

  return !ovr.invisible;
 }

 getModelAppearanceOverride(id: Id64String): Readonly<FeatureAppearance> | undefined {
  return this.displayStyle.getModelAppearanceOverride(id);
 }

 get details(): View {
  return this;
 }
 
 abstract is3d(): this is View3d;
 abstract isSpatialView(): this is SpatialView;
 abstract isDrawingView(): this is DrawingView;
 abstract isSheetView(): this is SheetView;

 is2d(): this is View2d {
  return !this.is3d();
 }

 abstract computeFitRange(): Range3d;

 abstract viewsModel(modelId: Id64String): boolean;

 abstract forEachModel(func: (model: GeometricModelState) => void): void;

 /** @internal */
 abstract forEachModelTreeRef(func: (treeRef: TileTreeReference) => void): void;
 
 forEachTileTreeRef(func: (treeRef: TileTreeReference) => void): void {
  this.forEachModelTreeRef(func);
  this.displayStyle.forEachTileTreeRef(func);
 }

 /** @internal */
 discloseTileTrees(trees: DisclosedTileTreeSet): void {
  this.forEachTileTreeRef((ref) => trees.disclose(ref));
 }

 /** @internal */
 public collectStatistics(stats: RenderMemory.Statistics): void {
  const trees = new DisclosedTileTreeSet();
   this.discloseTileTrees(trees);
   for (const tree of trees)
     tree.collectStatistics(stats);

   this.collectNonTileTreeStatistics(stats);
 }

 /** @internal */
 collectNonTileTreeStatistics(_stats: RenderMemory.Statistics): void {
  // derived classes will override if necessary.
 }

 /** @internal */
 createScene(context: SceneContext): void {
  this.forEachTileTreeRef((ref) => ref.addToScene(context));
 }

 /** @internal */
 abstract decorate(context: DecorateContext): void;

 setDisplayStyle(style: ViewStyle): void {
  this.displayStyle = style;
 }

 setCategorySelector(selector: ViewCategorySelector): void {
  this.categorySelector = selector;
 }

 viewsCategory(id: Id64String): boolean {
  return this.categorySelector.isCategoryViewed(id);
 }

 // get/setViewClip in addition to scene clip?

 /** @internal */
 refreshForModifiedModels(modelIds: Id64Arg | undefined): boolean {
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
  public hasSameCoordinates(other: View): boolean {
    if (this.iModel !== other.iModel)
      return false;

    // Spatial views view any number of spatial models all sharing one coordinate system.
    if (this.isSpatialView() && other.isSpatialView())
      return true;

    // People sometimes mistakenly stick 2d models into spatial views' model selectors.
    if (this.isSpatialView() != other.isSpatialView())
      return false;

    // Non-spatial views view exactly one model. If they view the same model, they share a coordinate system.
    let allowView = false;
    this.forEachModel((model) => {
      allowView ||= other.viewsModel(model.id);
    });

    return allowView;
  }

 /** @internal strictly for plan projection models. */
 getModelElevation(_modelId: Id64String): number {
  return 0;
 }

 abstract modelDisplayTransformProvider: ModelDisplayTransformProvider | undefined;

 computeDisplayTransform(args: ComputeDisplayTransformArgs): Transform | undefined {
   const elevation = this.getModelElevation(args.modelId);
   const modelTransform = this.modelDisplayTransformProvider?.getModelDisplayTransform(args.modelId);

   // NB: A ModelTimeline can apply a transform to all elements in the model, but no code exists which actually applies that at display time.
   // So for now we continue to only consider the ElementTimeline transform.
   let scriptTransform;
   /* ###TODO
   if (this.scheduleScript && args.elementId) {
     const idPair = Id64.getUint32Pair(args.elementId);
     const modelTimeline = this.scheduleScript.find(args.modelId);
     const elementTimeline = modelTimeline?.getTimelineForElement(idPair.lower, idPair.upper);
     scriptTransform = elementTimeline?.getAnimationTransform(args.timePoint ?? this.displayStyle.settings.timePoint ?? 0);
   }
  */

   if (0 === elevation && !modelTransform && !scriptTransform)
     return undefined;

   const transform = Transform.createTranslationXYZ(0, 0, elevation);
   if (modelTransform?.premultiply)
     modelTransform.transform.multiplyTransformTransform(transform, transform);

   if (modelTransform && !modelTransform.premultiply)
     transform.multiplyTransformTransform(modelTransform.transform, transform);

   if (scriptTransform)
     transform.multiplyTransformTransform(scriptTransform as Transform, transform);

   return transform;
 }

 /** Returns an iterator over additional Viewports used to construct this view's scene. e.g., those used for ViewAttachments and section drawings.
  * This exists chiefly for display-performance-test-app to determine when all tiles required for the view have been loaded.
  * @internal
  */
 public get secondaryViewports(): Iterable<Viewport> {
   return [];
 }

 /** Find the viewport that renders the contents of the view attachment with the specified element Id into this view.
  * @internal
  */
 public getAttachmentViewport(_id: Id64String): Viewport | undefined {
   return undefined;
 }

 abstract modelClipGroups: ModelClipGroups;
}

export abstract class View3d extends View {
 /** @internal */
 protected constructor() { super(); }

 override is3d(): this is View3d { return true; }
 override isDrawingView(): this is DrawingView { return false; }

 abstract getDisplayStyle3d(): View3dStyle;
 
 override get displayStyle(): View3dStyle {
  return this.getDisplayStyle3d();
 }
 
 /** @internal */
 abstract getModelClip(modelId: Id64String): RenderClipVolume | undefined;
 
}

export abstract class View2d extends View {

}

export abstract class SpatialView extends View3d {
 override isSpatialView(): this is SpatialView {
  return true;
 }
}

export abstract class DrawingView extends View2d {
 
}

export abstract class SheetView extends View2d {
 
}
