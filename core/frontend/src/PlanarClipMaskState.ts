/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Views
 */

import { Id64String } from "@itwin/core-bentley";
import { FeatureAppearance, PlanarClipMaskMode, PlanarClipMaskPriority, PlanarClipMaskProps, PlanarClipMaskSettings } from "@itwin/core-common";
import { FeatureSymbology } from "./render/FeatureSymbology";
import { DisclosedTileTreeSet, TileTreeReference } from "./tile/internal";
import { ViewState3d } from "./ViewState";
import { SceneContext } from "./ViewContext";

/** The State of Planar Clip Mask applied to a reality model or background map.
 * Handles loading models and their associated tiles for models that are used by masks but may not be otherwise loaded or displayed.
 * @beta
 */
export class PlanarClipMaskState {
  public readonly settings: PlanarClipMaskSettings;
  private _tileTreeRefs?: TileTreeReference[];
  private _allLoaded = false;

  private constructor(settings: PlanarClipMaskSettings) {
    this.settings = settings;
  }

  public static create(settings: PlanarClipMaskSettings): PlanarClipMaskState {
    return new PlanarClipMaskState(settings);
  }

  public static fromJSON(props: PlanarClipMaskProps): PlanarClipMaskState {
    return this.create(PlanarClipMaskSettings.fromJSON(props));
  }

  public discloseTileTrees(trees: DisclosedTileTreeSet): void {
    if (this._tileTreeRefs)
      this._tileTreeRefs.forEach((treeRef) => treeRef.discloseTileTrees(trees));
  }

  public getTileTrees(view: ViewState3d, classifiedModelId: Id64String): TileTreeReference[] | undefined {
    if (this.settings.mode === PlanarClipMaskMode.Priority) {
      const viewTrees = new Array<TileTreeReference>();
      const thisPriority = this.settings.priority === undefined ? PlanarClipMaskPriority.RealityModel : this.settings.priority;
      view.forEachTileTreeRef((ref) => {
        const tree = ref.treeOwner.load();
        if (tree && tree.modelId !== classifiedModelId && ref.planarclipMaskPriority > thisPriority)
          viewTrees.push(ref);
      });

      return viewTrees;
    }

    if (!this._tileTreeRefs) {
      this._tileTreeRefs = new Array<TileTreeReference>();
      if (this.settings.modelIds && view.isSpatialView())
        view.setMaskRefs(this.settings.modelIds, this._tileTreeRefs);
    }

    if (!this._allLoaded)
      this._allLoaded = this._tileTreeRefs.every((treeRef) => treeRef.treeOwner.load() !== undefined);

    return this._allLoaded ? this._tileTreeRefs : undefined;
  }

  public getPlanarClipMaskSymbologyOverrides(view: ViewState3d, context: SceneContext): FeatureSymbology.Overrides | undefined {
    let overrideModels;
    if (view.isSpatialView())
      overrideModels = view.getMaskModels(this.settings.modelIds, PlanarClipMaskMode.Priority === this.settings.mode);

    if (!this.settings.subCategoryOrElementIds && !overrideModels)
      return undefined;

    const overrides = new FeatureSymbology.Overrides();

    if (overrideModels) {
      // overrideModels is used for batched models.  For those, we need to create model overrides for visibility (using transparency).
      const appOn = FeatureAppearance.fromTransparency(0.0);
      const appOff = FeatureAppearance.fromTransparency(1.0);
      // For Priority or Models mode, we need to start with the current overrides and modify them
      if (PlanarClipMaskMode.Priority === this.settings.mode || PlanarClipMaskMode.Models === this.settings.mode) {
        const curOverrides = new FeatureSymbology.Overrides(context.viewport);
        curOverrides.addInvisibleElementOverridesToNeverDrawn();  // need this for fully trans element overrides to not participate in mask
        overrideModels.forEach((use: boolean, modelId: string) => {
          if (!use)
            curOverrides.addModelSubCategoryOverrides(modelId);  // need this for visible categories on unused models to not participate in mask
          curOverrides.override({ modelId, appearance: use ? appOn : appOff, onConflict: "replace" });
        });
        return curOverrides;
      }
      // Otherwise, we just start with a default overrides and modify it.
      overrideModels.forEach((use: boolean, modelId: string) => {
        overrides.override({ modelId, appearance: use ? appOn : appOff, onConflict: "replace" });
      });
    }

    if (!this.settings.subCategoryOrElementIds)
      return undefined;

    switch (this.settings.mode) {
      case PlanarClipMaskMode.IncludeElements: {
        overrides.setAlwaysDrawnSet(this.settings.subCategoryOrElementIds, true);
        return overrides;
      }
      case PlanarClipMaskMode.ExcludeElements: {
        overrides.ignoreSubCategory = true;
        overrides.setNeverDrawnSet(this.settings.subCategoryOrElementIds);
        return overrides;
      }
      case PlanarClipMaskMode.IncludeSubCategories: {
        for (const subCategoryId of this.settings.subCategoryOrElementIds)
          overrides.setVisibleSubCategory(subCategoryId);
        return overrides;
      }
    }

    return undefined;
  }
}
