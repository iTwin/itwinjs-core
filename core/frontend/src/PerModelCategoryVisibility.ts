/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { compareStrings, Id64, Id64Arg, Id64String, SortedArray } from "@itwin/core-bentley";
import { IModelConnection } from "./IModelConnection";
import { FeatureSymbology } from "./render/FeatureSymbology";
import { Viewport } from "./Viewport";

/** Per-model category visibility permits the visibility of categories within a [[Viewport]] displaying a [[SpatialViewState]] to be overridden in
 * the context of individual [[GeometricModelState]]s.
 * If a category's visibility is overridden for a given model, then elements belonging to that category within that model will be displayed or hidden regardless of the category's inclusion in the Viewport's [[CategorySelectorState]].
 * The override affects geometry on all subcategories belonging to the overridden category. That is, if the category is overridden to be visible, then geometry on all subcategories of the category
 * will be visible, regardless of any [SubCategoryOverride]($common)s applied by the view's [[DisplayStyleState]].
 * @see [[Viewport.perModelCategoryVisibility]] to define the per-model category visibility for a viewport.
 * @public
 * @extensions
 */
export namespace PerModelCategoryVisibility {
  /** Describes whether and how a category's visibility is overridden. */
  export enum Override {
    /** The category's visibility is not overridden; its visibility is wholly controlled by the [[Viewport]]'s [[CategorySelectorState]]. */
    None,
    /** The category is overridden to be visible. */
    Show,
    /** The category is overridden to be invisible. */
    Hide,
  }

  /** Describes one visibility override in a [[PerModelCategoryVisibility.Overrides]]. */
  export interface OverrideEntry {
    /** The Id of the [[GeometricModelState]] in which the override applies. */
    readonly modelId: Id64String;
    /** The Id of the [SpatialCategory]($backend) whose visibility is overridden. */
    readonly categoryId: Id64String;
    /** Whether the category is visible in the context of the model. */
    readonly visible: boolean;
  }

  /** Describes a set of per-model category visibility overrides. Changes to these overrides invoke the [[Viewport.onViewedCategoriesPerModelChanged]] event.
   * @see [[Viewport.perModelCategoryVisibility]].
   */
  export interface Overrides {
    /** Returns the override state of the specified category within the specified model. */
    getOverride(modelId: Id64String, categoryId: Id64String): Override;
    /** Changes the override state of one or more categories for one or more models. */
    setOverride(modelIds: Id64Arg, categoryIds: Id64Arg, override: Override): void;
    /** Changes multiple overrides, given an array of overrides *
     * @beta
     */
    setOverrides(perModelCategoryVisibility: Props[], iModel?: IModelConnection): Promise<void>;
    /** Removes all overrides for the specified models, or for all models if `modelIds` is undefined. */
    clearOverrides(modelIds?: Id64Arg): void;
    /** An iterator over all of the visibility overrides. */
    [Symbol.iterator]: () => Iterator<OverrideEntry>;
    /** Populate the symbology overrides based on the per-model category visibility. */
    addOverrides(fs: FeatureSymbology.Overrides, ovrs: Id64.Uint32Map<Id64.Uint32Set>): void;
  }

  /** Describes a set of [[PerModelCategoryVisibility.Overrides]].
   * @see [[PerModelCategoryVisibility.Overrides.setOverrides]].
   * @beta
   */
  export interface Props {
    /** The id of the model to which the overrides apply. */
    modelId: string;
    /** The ids of the categories whose visibility are to be overridden within the context of the model. */
    categoryIds: Iterable<Id64String>;
    /** The visibility to be applied to the specified categories. */
    visOverride: PerModelCategoryVisibility.Override;
  }

  export function createOverrides(viewport: Viewport): PerModelCategoryVisibility.Overrides {
    return new PerModelCategoryVisibilityOverrides(viewport);
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

/** The Viewport-specific implementation of PerModelCategoryVisibility.Overrides. */
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
    if (undefined !== ovr) return ovr.visible ? PerModelCategoryVisibility.Override.Show : PerModelCategoryVisibility.Override.Hide;
    else return PerModelCategoryVisibility.Override.None;
  }

  /**
   * set the overrides for multiple perModelCategoryVisibility props, loading categoryIds from the iModel if necessary.
   * @see [[PerModelCategoryVisibility]]
   * @param perModelCategoryVisibility array of model category visibility overrides @see [[PerModelCategoryVisibility.Props]]
   * @param iModel Optional param iModel. If no iModel is provided, then the iModel associated with the viewport (used to construct this class) is used.
   * This optional iModel param is useful for apps which may show multiple iModels at once. Passing in an iModel ensures that the subcategories cache for the provided iModel
   * is populated as opposed to the iModel associated with the viewport which may or may not be an empty iModel.
   * @returns a promise that resolves once the overrides have been applied.
   */
  public async setOverrides(perModelCategoryVisibility: PerModelCategoryVisibility.Props[], iModel?: IModelConnection): Promise<void> {
    let anyChanged = false;
    const catIdsToLoad: string[] = [];
    const iModelToUse = iModel ? iModel : this._vp.iModel;
    for (const override of perModelCategoryVisibility) {
      const modelId = override.modelId;
      // The caller may pass a single categoryId as a string, if we don't convert this to an array we will iterate
      // over each individual character of that string, which is not the desired behavior.
      const categoryIds = typeof override.categoryIds === "string" ? [override.categoryIds] : override.categoryIds;
      const visOverride = override.visOverride;
      for (const categoryId of categoryIds) {
        if (this.findAndUpdateOverrideInArray(modelId, categoryId, visOverride)) {
          anyChanged = true;
          if (PerModelCategoryVisibility.Override.None !== visOverride) {
            catIdsToLoad.push(categoryId);
          }
        }
      }
    }
    if (anyChanged) {
      this._vp.setViewedCategoriesPerModelChanged();
      if (catIdsToLoad.length !== 0) {
        this._vp.subcategories.push(iModelToUse.subcategories, catIdsToLoad, () => this._vp.setViewedCategoriesPerModelChanged());
      }
    }
    return;
  }

  /** Find and update the override in the array of overrides. If override not found, adds it to the array.
   *  If the array was changed, returns true. */
  private findAndUpdateOverrideInArray(modelId: Id64String, categoryId: Id64String, override: PerModelCategoryVisibility.Override): boolean {
    const ovr = this._scratch;
    ovr.reset(modelId, categoryId, false);
    let changed = false;
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
        this._array[index].visible = PerModelCategoryVisibility.Override.Show === override;
        changed = true;
      }
    }
    return changed;
  }

  public setOverride(modelIds: Id64Arg, categoryIds: Id64Arg, override: PerModelCategoryVisibility.Override): void {
    let changed = false;
    for (const modelId of Id64.iterable(modelIds)) {
      for (const categoryId of Id64.iterable(categoryIds)) {
        if (this.findAndUpdateOverrideInArray(modelId, categoryId, override)) changed = true;
      }
    }

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

    for (let i = 0; i < this.length; ) {
      const ovr = this._array[i];
      let removed = false;
      for (const modelId of Id64.iterable(modelIds)) {
        if (modelId === ovr.modelId) {
          this._array.splice(i, 1);
          this._vp.setViewedCategoriesPerModelChanged();
          removed = true;
          break;
        }
      }

      if (!removed) ++i;
    }
  }

  public addOverrides(fs: FeatureSymbology.Overrides, ovrs: Id64.Uint32Map<Id64.Uint32Set>): void {
    const cache = this._vp.iModel.subcategories;

    for (const ovr of this._array) {
      const subcats = cache.getSubCategories(ovr.categoryId);
      if (undefined === subcats) continue;

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
}
