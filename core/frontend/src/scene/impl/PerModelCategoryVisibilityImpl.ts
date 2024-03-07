/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { compareStrings, Id64, Id64Arg, Id64String, SortedArray } from "@itwin/core-bentley";
import { IModelConnection } from "../../IModelConnection";
import { FeatureSymbology } from "../../render/FeatureSymbology";
import { SubCategoriesCache } from "../../SubCategoriesCache";
import { PerModelCategoryVisibility } from "../../PerModelCategoryVisibility";

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

export interface PerModelCategoryVisibilityOverridesArgs {
  readonly subcategories: SubCategoriesCache.Queue;
  readonly iModel: IModelConnection;
  setViewedCategoriesPerModelChanged(): void;
}

/** The Viewport-specific implementation of PerModelCategoryVisibility.Overrides. */
class PerModelCategoryVisibilityOverrides extends SortedArray<PerModelCategoryVisibilityOverride> implements PerModelCategoryVisibility.Overrides {
  private readonly _scratch = new PerModelCategoryVisibilityOverride("0", "0", false);
  private readonly _args: PerModelCategoryVisibilityOverridesArgs;

  public constructor(args: PerModelCategoryVisibilityOverridesArgs) {
    super(compareCategoryOverrides);
    this._args = args;
  }

  public getOverride(modelId: Id64String, categoryId: Id64String): PerModelCategoryVisibility.Override {
    this._scratch.reset(modelId, categoryId, false);
    const ovr = this.findEqual(this._scratch);
    if (undefined !== ovr)
      return ovr.visible ? PerModelCategoryVisibility.Override.Show : PerModelCategoryVisibility.Override.Hide;
    else
      return PerModelCategoryVisibility.Override.None;
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
    const iModelToUse = iModel ? iModel : this._args.iModel;
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
      this._args.setViewedCategoriesPerModelChanged();
      if (catIdsToLoad.length !== 0) {
        this._args.subcategories.push(iModelToUse.subcategories, catIdsToLoad, () => this._args.setViewedCategoriesPerModelChanged());
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
        this._array[index].visible = (PerModelCategoryVisibility.Override.Show === override);
        changed = true;
      }
    }
    return changed;
  }

  public setOverride(modelIds: Id64Arg, categoryIds: Id64Arg, override: PerModelCategoryVisibility.Override): void {
    let changed = false;
    for (const modelId of Id64.iterable(modelIds)) {
      for (const categoryId of Id64.iterable(categoryIds)) {
        if (this.findAndUpdateOverrideInArray(modelId, categoryId, override))
          changed = true;
      }
    }

    if (changed) {
      this._args.setViewedCategoriesPerModelChanged();

      if (PerModelCategoryVisibility.Override.None !== override) {
        // Ensure subcategories loaded.
        this._args.subcategories.push(this._args.iModel.subcategories, categoryIds, () => this._args.setViewedCategoriesPerModelChanged());
      }
    }
  }

  public clearOverrides(modelIds?: Id64Arg): void {
    if (undefined === modelIds) {
      if (0 < this.length) {
        this.clear();
        this._args.setViewedCategoriesPerModelChanged();
      }

      return;
    }

    for (let i = 0; i < this.length;) {
      const ovr = this._array[i];
      let removed = false;
      for (const modelId of Id64.iterable(modelIds)) {
        if (modelId === ovr.modelId) {
          this._array.splice(i, 1);
          this._args.setViewedCategoriesPerModelChanged();
          removed = true;
          break;
        }
      }

      if (!removed)
        ++i;
    }
  }

  public addOverrides(fs: FeatureSymbology.Overrides, ovrs: Id64.Uint32Map<Id64.Uint32Set>): void {
    const cache = this._args.iModel.subcategories;

    for (const ovr of this._array) {
      const subcats = cache.getSubCategories(ovr.categoryId);
      if (undefined === subcats)
        continue;

      // It's pointless to override for models which aren't displayed...except if we do this, and then someone enables that model,
      // we would need to regenerate our symbology overrides in response. Preferably people wouldn't bother overriding models that
      // they don't want us to draw...
      /* if (!this._args.view.viewsModel(ovr.modelId))
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

export function createPerModelCategoryVisibilityOverrides(args: PerModelCategoryVisibilityOverridesArgs): PerModelCategoryVisibility.Overrides {
  return new PerModelCategoryVisibilityOverrides(args);
}
