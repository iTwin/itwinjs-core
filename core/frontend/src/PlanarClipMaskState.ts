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
import { SceneContext } from "./ViewContext";
import { SpatialViewState } from "./SpatialViewState";

/** The State of Planar Clip Mask applied to a reality model or background map.
 * Handles loading models and their associated tiles for models that are used by masks but may not be otherwise loaded or displayed.
 * @beta
 */
export class PlanarClipMaskState {
  public readonly settings: PlanarClipMaskSettings;
  private _tileTreeRefs?: TileTreeReference[];
  private _allLoaded = false;
  private _usingViewportOverrides = false;

  private constructor(settings: PlanarClipMaskSettings) {
    this.settings = settings;
  }

  public static create(settings: PlanarClipMaskSettings): PlanarClipMaskState {
    return new PlanarClipMaskState(settings);
  }

  public static fromJSON(props: PlanarClipMaskProps): PlanarClipMaskState {
    return this.create(PlanarClipMaskSettings.fromJSON(props));
  }

  public get usingViewportOverrides(): boolean { return this._usingViewportOverrides; };

  public discloseTileTrees(trees: DisclosedTileTreeSet): void {
    if (this._tileTreeRefs)
      this._tileTreeRefs.forEach((treeRef) => treeRef.discloseTileTrees(trees));
  }

  // Returns the TileTreeReferences for the models that need to be drawn to create the planar clip mask.
  public getTileTrees(view: SpatialViewState, classifiedModelId: Id64String): TileTreeReference[] | undefined {
    if (this.settings.mode === PlanarClipMaskMode.Priority) {
      // For priority mode we simply want refs for all viewed models if the priority is higher than the mask priority.
      const viewTrees = new Array<TileTreeReference>();
      const thisPriority = this.settings.priority === undefined ? PlanarClipMaskPriority.RealityModel : this.settings.priority;
      view.forEachTileTreeRef((ref) => {
        const tree = ref.treeOwner.load();
        if (tree && tree.modelId !== classifiedModelId && ref.planarclipMaskPriority > thisPriority)
          viewTrees.push(ref);
      });

      return viewTrees;
    }

    // For all other modes we need to let the tree refs in the view state decide which refs need to be drawn
    // since batched tiles cannot turn on/off individual models just by their tile tree refs.
    if (!this._tileTreeRefs) {
      this._tileTreeRefs = new Array<TileTreeReference>();
      if (this.settings.modelIds)
        view.collectMaskRefs(this.settings.modelIds, this._tileTreeRefs);
    }

    if (!this._allLoaded)
      this._allLoaded = this._tileTreeRefs.every((treeRef) => treeRef.treeOwner.load() !== undefined);

    return this._allLoaded ? this._tileTreeRefs : undefined;
  }

  // Returns any potential FeatureSymbology overrides for drawing the planar clip mask.
  public getPlanarClipMaskSymbologyOverrides(view: SpatialViewState, context: SceneContext): FeatureSymbology.Overrides | undefined {
    this._usingViewportOverrides = false;
    // First obtain a list of models that will need to be turned off for drawing the planar clip mask (only used for batched tile trees).
    const overrideModels = view.getModelsNotInMask(this.settings.modelIds, PlanarClipMaskMode.Priority === this.settings.mode);

    const noSubCategoryOrElementIds = !this.settings.subCategoryOrElementIds;
    if (noSubCategoryOrElementIds && !overrideModels)
      return undefined;

    const overrides = new FeatureSymbology.Overrides();

    if (overrideModels) {
      // overrideModels is used for batched models.  For those, we need to create model overrides to turn off models that are
      // not wanted in the mask (using transparency) no matter what mask mode is being used.
      const appOff = FeatureAppearance.fromTransparency(1.0);
      // For Priority or Models mode, we need to start with the current overrides and modify them
      if (PlanarClipMaskMode.Priority === this.settings.mode || PlanarClipMaskMode.Models === this.settings.mode || noSubCategoryOrElementIds) {
        const curOverrides = new FeatureSymbology.Overrides(context.viewport);
        curOverrides.addInvisibleElementOverridesToNeverDrawn();  // need this for fully trans element overrides to not participate in mask
        overrideModels.forEach((modelId: string) => {
          curOverrides.override({ modelId, appearance: appOff, onConflict: "replace" });
        });
        this._usingViewportOverrides = true;
        return curOverrides;
      }
      // Otherwise, we just start with a default overrides and modify it.
      overrideModels.forEach((modelId: string) => {
        overrides.override({ modelId, appearance: appOff, onConflict: "replace" });
      });
    }

    // Add overrides to turn things on or off based on the subcategories or elements in the mask settings.
    switch (this.settings.mode) {
      case PlanarClipMaskMode.IncludeElements: {
        overrides.setAlwaysDrawnSet(this.settings.subCategoryOrElementIds!, true);
        return overrides;
      }
      case PlanarClipMaskMode.ExcludeElements: {
        overrides.ignoreSubCategory = true;
        overrides.setNeverDrawnSet(this.settings.subCategoryOrElementIds!);
        return overrides;
      }
      case PlanarClipMaskMode.IncludeSubCategories: {
        for (const subCategoryId of this.settings.subCategoryOrElementIds!)
          overrides.setVisibleSubCategory(subCategoryId);
        return overrides;
      }
    }

    return undefined;
  }
}
