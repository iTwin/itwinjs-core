/*--------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { Id64, Id64String } from "@itwin/core-bentley";
import { ChangeCategoryDisplayArgs, IModelDisplayReference, SpatialIModelDisplayReference } from "../IModelDisplayReference";
import { SubCategoryAppearance, SubCategoryOverride } from "@itwin/core-common";
import { Transform } from "@itwin/core-geometry";

// This file contains glue code common to the primary and linked implementations of IModelDisplayReference.

/** Computes the world-space display transform that rendering applies to a model displayed through a non-primary
 * IModelDisplayReference, for use by picking and snapping. The reference's plan projection elevation and
 * [[ModelDisplayTransformProvider]] apply - linked references do not support schedule scripts or view attachments.
 * @see ViewState.computeDisplayTransform for the primary reference's equivalent.
 */
export function computeIModelRefDisplayTransform(ref: IModelDisplayReference, modelId: Id64String): Transform | undefined {
  const elevation = ref.isSpatial() ? (ref.planProjectionSettings.get(modelId)?.elevation ?? 0) : 0;
  const displayTf = ref.modelDisplayTransformProvider?.getModelDisplayTransform(modelId);
  if (0 === elevation && !displayTf)
    return undefined;

  // Transforms applied in the reference's own coordinate space, composed as ViewState.computeDisplayTransform does:
  // the plan projection elevation first, then a non-premultiplied model display transform.
  let local = 0 !== elevation ? Transform.createTranslationXYZ(0, 0, elevation) : undefined;
  if (displayTf && !displayTf.premultiply)
    local = local ? local.multiplyTransformTransform(displayTf.transform) : displayTf.transform.clone();

  // Conjugate into the view's world space for use on world-space points.
  let world: Transform | undefined;
  if (local) {
    const toWorld = ref.linearTransformToParent;
    const fromWorld = toWorld.inverse();
    world = fromWorld ? toWorld.multiplyTransformTransform(local).multiplyTransformTransform(fromWorld) : local;
  }

  // A premultiplied transform is applied after the reference's placement, i.e. in the view's world space.
  if (displayTf?.premultiply)
    world = world ? displayTf.transform.multiplyTransformTransform(world) : displayTf.transform.clone();

  return world;
}

export function changeCategoryDisplay(ref: IModelDisplayReference, args: ChangeCategoryDisplayArgs): void {
  // args.categories may be a one-shot iterable (e.g., a generator) - materialize it exactly once.
  const categories = Id64.toIdSet(args.categories);
  if (!args.display) {
    if (args.noBatchNotify) {
      for (const id of categories)
        ref.viewedCategories.delete(id);
    } else {
      ref.viewedCategories.deleteAll(categories);
    }

    return;
  }

  if (args.noBatchNotify) {
    for (const id of categories)
      ref.viewedCategories.add(id);
  } else {
    ref.viewedCategories.addAll(categories);
  }

  ref.parent.subcategories.push(ref.iModel.subcategories, categories, (anySubCategoriesLoaded) => {
    if (args.enableAllSubCategories) {
      for (const catId of categories) {
        const subCatIds = ref.iModel.subcategories.getSubCategories(catId);
        if (subCatIds)
          for (const subCatId of subCatIds)
        ref.changeSubCategoryDisplay(subCatId, true);
      }
    }

    if (anySubCategoriesLoaded)
      ref.viewedCategories.onChanged.raiseEvent();
  });
}

export function isSubCategoryVisible(ref: IModelDisplayReference, id: Id64String): boolean {
  const app = ref.iModel.subcategories.getSubCategoryAppearance(id);
  if (!app)
    return false;

  const ovr = ref.subCategoryOverrides.get(id);
  if (!ovr || undefined === ovr.invisible)
    return !app.invisible;

  return !ovr.invisible;
}

export function changeSubCategoryDisplay(ref: IModelDisplayReference, id: Id64String, visible: boolean): boolean {
  const app = ref.iModel.subcategories.getSubCategoryAppearance(id);
  if (!app)
    return false; // category not enabled or not loaded

  const curOvr = ref.subCategoryOverrides.get(id);
  const isAlreadyVisible = undefined !== curOvr && undefined !== curOvr.invisible ? !curOvr.invisible : !app.invisible;
  if (isAlreadyVisible === visible)
    return false;

  // Preserve existing overrides - just flip the visibility flag.
  const json = undefined !== curOvr ? curOvr.toJSON() : {};
  json.invisible = !visible;
  ref.subCategoryOverrides.set(id, SubCategoryOverride.fromJSON(json));
  return true;
}

export function getSubCategoryAppearance(ref: IModelDisplayReference, id: Id64String): SubCategoryAppearance {
  const app = ref.iModel.subcategories.getSubCategoryAppearance(id);
  if (!app)
    return SubCategoryAppearance.defaults;

  const ovr = ref.subCategoryOverrides.get(id);
  return ovr?.override(app) ?? app;
}

export async function loadViewedCategories(ref: IModelDisplayReference): Promise<void> {
  const promise = ref.iModel.subcategories.load(ref.viewedCategories)?.promise;
  const anyLoaded = undefined !== promise && (await promise);
  if (anyLoaded) {
    ref.invalidateSymbologyOverrides();
    ref.onViewedCategoriesLoaded.raiseEvent();
  }
}

export async function loadViewedModels(ref: SpatialIModelDisplayReference): Promise<void> {
  await ref.iModel.models.load(ref.viewedModels);
  ref.onViewedModelsLoaded.raiseEvent();
}

export function isLoadingComplete(iModelRef: IModelDisplayReference): boolean {
  for (const ttRef of iModelRef.tileTreeRefs)
    if (!ttRef.isLoadingComplete)
      return false;

  return true;
}

export function listenForSubCategoryChanges(ref: IModelDisplayReference): () => void {
  return ref.iModel.subcategories.addChangedListener(() => {
    const categoryIds = Id64.toIdSet(ref.viewedCategories);
    for (const { categoryId } of ref.perModelCategoryVisibility)
      categoryIds.add(categoryId);

    ref.parent.subcategories.push(ref.iModel.subcategories, categoryIds, (anySubCategoriesLoaded) => {
      if (anySubCategoriesLoaded) {
        // Cached symbology overrides bake in subcategory visibility and priority - rebuild them from the reloaded cache.
        ref.invalidateSymbologyOverrides();
        ref.onViewedCategoriesLoaded.raiseEvent();
      }
    });
  });
}

export async function addAndLoadViewedModels(ref: SpatialIModelDisplayReference, modelIds: Iterable<Id64String>): Promise<void> {
  // modelIds may be a one-shot iterable (e.g., a generator) - materialize it exactly once.
  const ids = Id64.toIdSet(modelIds);
  ref.viewedModels.addAll(ids);
  const unloaded = ref.iModel.models.filterLoaded(ids);
  if (!unloaded)
    return;

  return ref.iModel.models.load(unloaded);
}
