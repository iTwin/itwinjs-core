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

// This file contains glue code common to the primary and linked implementations of IModelDisplayReference.

export function changeCategoryDisplay(ref: IModelDisplayReference, args: ChangeCategoryDisplayArgs): void {
  const ids = Id64.iterable(args.categories);
  if (!args.display) {
    if (args.noBatchNotify) {
      for (const id of ids)
      ref.viewedCategories.delete(id);
    } else {
      ref.viewedCategories.deleteAll(ids);
    }

    return;
  }

  if (args.noBatchNotify) {
    for (const id of ids)
    ref.viewedCategories.add(id);
  } else {
    ref.viewedCategories.addAll(ids);
  }

  const categories = Id64.toIdSet(args.categories);
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
  await ref.iModel.subcategories.load(ref.viewedCategories)?.promise;
  ref.invalidateSymbologyOverrides();
  ref.onViewedCategoriesLoaded.raiseEvent();
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
