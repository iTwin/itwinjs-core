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
import type { ViewState } from "../ViewState";
import type { SceneContext } from "../ViewContext";
import type { FeatureSymbology } from "../render/FeatureSymbology";
import { _backingView } from "../common/internal/Symbols";
import { modelLoadRequests, retireModelRequests } from "./ModelLoadRequests";

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

// The explicit operation, selector refresh and stale-cache listener can all observe the same publication.
const notifiedCategoryVersions = new WeakMap<IModelDisplayReference, number>();
function notifyCategoriesLoaded(ref: IModelDisplayReference, ids: Iterable<Id64String>): void {
  const cache = ref.iModel.subcategories;
  if (unlinked.has(ref) || !cache.loadedSince(ids, notifiedCategoryVersions.get(ref) ?? 0))
    return;
  notifiedCategoryVersions.set(ref, cache.loadVersion);
  ref.invalidateSymbologyOverrides();
  ref.onViewedCategoriesLoaded.raiseEvent();
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

  if (unlinked.has(ref))
    return; // A synchronous selector listener can unlink this reference during addAll.

  ref.parent.subcategories.push(ref.iModel.subcategories, categories, (anySubCategoriesLoaded) => {
    if (args.enableAllSubCategories) {
      for (const catId of categories) {
        const subCatIds = ref.iModel.subcategories.getSubCategories(catId);
        if (subCatIds)
          for (const subCatId of subCatIds)
            ref.changeSubCategoryDisplay(subCatId, true);
      }
    }

    if (anySubCategoriesLoaded) {
      ref.viewedCategories.onChanged.raiseEvent();
      notifyCategoriesLoaded(ref, categories);
    }
  }, { owner: ref.guid, retainOnRetry: args.enableAllSubCategories });
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

function differentOverrides(before?: SubCategoryOverride, after?: SubCategoryOverride): boolean {
  return before !== after && !(before && after && before.equals(after));
}

/** Notify all attached views sharing a custom style, even when its setter uses non-observable storage. */
export function updateSubCategoryOverride(view: ViewState, id: Id64String, override?: SubCategoryOverride): void {
  const style = view.displayStyle;
  const before = style.getSubCategoryOverride(id);
  const beforeView = view.getSubCategoryOverride(id);
  const event = style.settings.onSubCategoryOverridesChanged;
  let notified = false;
  const remove = event.addListener((changed) => { notified ||= changed === id; });
  try {
    if (override)
      style.overrideSubCategory(id, override);
    else
      style.dropSubCategoryOverride(id);
  } finally {
    remove();
  }
  if (!notified) {
    const after = style.getSubCategoryOverride(id);
    if (differentOverrides(before, after) || differentOverrides(beforeView, view.getSubCategoryOverride(id)))
      event.raiseEvent(id, after);
  }
}

export function changeSubCategoryDisplay(ref: IModelDisplayReference, id: Id64String, visible: boolean): boolean {
  const app = ref.iModel.subcategories.getSubCategoryAppearance(id);
  if (!app)
    return false; // category not enabled or not loaded

  const primaryView = ref === ref.parent.primary ? ref.parent[_backingView] : undefined;
  const curOvr = primaryView ? primaryView.getSubCategoryOverride(id) : ref.subCategoryOverrides.get(id);
  const isAlreadyVisible = undefined !== curOvr && undefined !== curOvr.invisible ? !curOvr.invisible : !app.invisible;
  if (isAlreadyVisible === visible)
    return false;

  // Preserve existing overrides - just flip the visibility flag.
  const stored = primaryView ? primaryView.displayStyle.getSubCategoryOverride(id) : curOvr;
  const json = stored?.toJSON() ?? {};
  json.invisible = !visible;
  const ovr = SubCategoryOverride.fromJSON(json);
  if (primaryView) {
    updateSubCategoryOverride(primaryView, id, ovr);
    return ref.isSubCategoryVisible(id) === visible;
  }

  ref.subCategoryOverrides.set(id, ovr);
  return true;
}

export function getSubCategoryAppearance(ref: IModelDisplayReference, id: Id64String): SubCategoryAppearance {
  const app = ref.iModel.subcategories.getSubCategoryAppearance(id);
  if (!app)
    return SubCategoryAppearance.defaults;

  const ovr = ref.subCategoryOverrides.get(id);
  return ovr?.override(app) ?? app;
}

// Scene selection fixes one snapshot per external primary, not one snapshot per tile tree or across frames.
const externalPrimarySnapshots = new WeakMap<SceneContext, Map<IModelDisplayReference, FeatureSymbology.Overrides>>();

/** Overrides to install on a tile branch, or undefined to inherit the drawing viewport's primary snapshot.
 * @internal
 */
export function getTileSymbologyOverrides(ref: IModelDisplayReference, context?: SceneContext): FeatureSymbology.Overrides | undefined {
  if (ref === context?.viewport.primaryIModelRef)
    return undefined;
  if (!context || ref !== ref.parent.primary)
    return ref.getSymbologyOverrides(); // Linked references already maintain their own snapshots.

  let snapshots = externalPrimarySnapshots.get(context);
  if (!snapshots)
    externalPrimarySnapshots.set(context, snapshots = new Map());

  let overrides = snapshots.get(ref);
  if (!overrides)
    snapshots.set(ref, overrides = ref.getSymbologyOverrides());

  return overrides;
}

const unlinked = new WeakSet<IModelDisplayReference>();
const scheduledCategoryLoads = new WeakMap<IModelDisplayReference, number>();
interface ModelBatch { ids: Set<Id64String>, dispatched: Promise<Map<Id64String, Promise<void>>> }
interface ModelLoads { active: Map<Promise<void>, Promise<void>>, next?: ModelBatch, refreshViewed: boolean }
const modelLoads = new WeakMap<SpatialIModelDisplayReference, ModelLoads>();

export function scheduleViewedCategoriesLoad(ref: IModelDisplayReference): void {
  if (unlinked.has(ref) || scheduledCategoryLoads.has(ref))
    return;

  const cache = ref.iModel.subcategories;
  const version = cache.loadVersion;
  scheduledCategoryLoads.set(ref, version);
  // Coalesce selector notifications and wait behind changeCategoryDisplay's own queued request.
  queueMicrotask(() => {
    if (scheduledCategoryLoads.get(ref) !== version)
      return; // Canceled or superseded before the microtask ran.
    scheduledCategoryLoads.delete(ref);

    const missing = cache.getMissing(ref.viewedCategories);
    if (missing) {
      ref.parent.subcategories.push(cache, missing, (anyLoaded) => {
        if (anyLoaded)
          notifyCategoriesLoaded(ref, missing);
        else
          ref.invalidateSymbologyOverrides();
      }, { owner: ref.guid });
    }
    // Publish independently loaded categories even if the remaining request fails. Register it before notifying listeners.
    if (cache.loadedSince(ref.viewedCategories, version))
      notifyCategoriesLoaded(ref, ref.viewedCategories);
  });
}

export function cancelSelectorRefresh(ref: IModelDisplayReference): void {
  scheduledCategoryLoads.delete(ref);
  const loads = ref.isSpatial() ? modelLoads.get(ref) : undefined;
  if (loads)
    loads.refreshViewed = false; // Do not cancel IDs promised to explicit addAndLoad callers.
}

export function unlinkDisplayReference(ref: IModelDisplayReference): void {
  unlinked.add(ref);
  cancelSelectorRefresh(ref);
  retireModelRequests(ref.iModel.models, ref.guid);
  ref.parent.subcategories.cancel(ref.guid);
}

function getModelLoads(ref: SpatialIModelDisplayReference): ModelLoads {
  let loads = modelLoads.get(ref);
  if (!loads)
    modelLoads.set(ref, loads = { active: new Map(), refreshViewed: false });
  return loads;
}

function finishModelBatch(ref: SpatialIModelDisplayReference, loads: ModelLoads): void {
  if (!loads.next && !loads.active.size) {
    if (loads.refreshViewed)
      nextModelBatch(ref, loads);
    else
      modelLoads.delete(ref);
  }
}

// eslint-disable-next-line @typescript-eslint/promise-function-async
function watchModelLoad(ref: SpatialIModelDisplayReference, loads: ModelLoads, request: Promise<void>, completion = request): Promise<void> {
  let ready = loads.active.get(request);
  if (!ready) {
    ready = completion.then(() => ref.onViewedModelsLoaded.raiseEvent()).finally(() => {
      loads.active.delete(request);
      finishModelBatch(ref, loads);
    });
    loads.active.set(request, ready);
    void ready.catch(() => {}); // Selector listeners don't await loads; explicit callers still receive the rejection.
  }
  return ready;
}

function nextModelBatch(ref: SpatialIModelDisplayReference, loads: ModelLoads): ModelBatch {
  if (loads.next)
    return loads.next;

  const ids = new Set<Id64String>();
  const dispatched = Promise.resolve().then(() => {
    loads.next = undefined;
    const requests = new Map<Id64String, Promise<void>>();
    const refresh = loads.refreshViewed;
    loads.refreshViewed = false;
    try {
      if (refresh || ids.size) {
        if (refresh)
          for (const id of ref.viewedModels)
            ids.add(id);
        const models = ref.iModel.models;
        const active = modelLoadRequests.get(models);
        for (const id of ids) {
          const request = active?.get(id);
          if (request) {
            requests.set(id, watchModelLoad(ref, loads, request.promise));
            ids.delete(id);
          } else if (models.getLoaded(id)) {
            ids.delete(id);
          }
        }
        if (ids.size || !requests.size) {
          const load = models.load(ids);
          const first = ids.values().next().value;
          const started = first ? modelLoadRequests.get(models)?.get(first) : undefined;
          if (started)
            started.owner = ref.guid;
          const ready = watchModelLoad(ref, loads, started?.promise ?? load, load);
          for (const id of ids)
            requests.set(id, ready);
          if (started && unlinked.has(ref))
            retireModelRequests(models, ref.guid);
        }
      }
      return requests;
    } finally {
      finishModelBatch(ref, loads);
    }
  });
  void dispatched.catch(() => {});
  return loads.next = { ids, dispatched };
}

export function scheduleViewedModelsLoad(ref: SpatialIModelDisplayReference): void {
  if (unlinked.has(ref))
    return;
  const loads = getModelLoads(ref);
  loads.refreshViewed = true;
  // Coalesce selector-only edits behind outstanding work; an explicit request can dispatch its missing IDs immediately.
  if (!loads.active.size)
    nextModelBatch(ref, loads);
}

export function isLoadingComplete(iModelRef: IModelDisplayReference): boolean {
  const cache = iModelRef.iModel.subcategories;
  const scheduledAt = scheduledCategoryLoads.get(iModelRef);
  if ((scheduledAt !== undefined && (cache.loadedSince(iModelRef.viewedCategories, scheduledAt) || cache.getMissing(iModelRef.viewedCategories))) || iModelRef.parent.subcategories.hasPending(iModelRef.guid)
    || (iModelRef.isSpatial() && modelLoads.has(iModelRef)))
    return false;

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
        notifyCategoriesLoaded(ref, categoryIds);
      }
    }, { owner: ref.guid });
  });
}

export async function addAndLoadViewedModels(ref: SpatialIModelDisplayReference, modelIds: Iterable<Id64String>): Promise<void> {
  // modelIds may be a one-shot iterable (e.g., a generator) - materialize it exactly once.
  const ids = Id64.toIdSet(modelIds);
  ref.viewedModels.addAll(ids);
  const unloaded = ref.iModel.models.filterLoaded(ids);
  if (!unloaded)
    return;

  const batch = nextModelBatch(ref, getModelLoads(ref));
  for (const id of unloaded)
    batch.ids.add(id); // Keep explicit IDs even if they leave the selector before dispatch.
  const dispatched = await batch.dispatched;
  const waitFor = new Set<Promise<void>>();
  for (const id of unloaded) {
    const request = dispatched.get(id);
    if (request)
      waitFor.add(request);
  }
  await Promise.all(waitFor);
}
