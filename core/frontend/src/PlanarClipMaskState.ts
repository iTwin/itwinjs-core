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
import { Range3d } from "@itwin/core-geometry";

/** The State of Planar Clip Mask applied to a reality model or background map.
 * Handles loading models and their associated tiles for models that are used by masks but may not be otherwise loaded or displayed.
 * @beta
 */
export class PlanarClipMaskState {
  public readonly settings: PlanarClipMaskSettings;
  private _tileTreeRefs?: TileTreeReference[];
  private _allLoaded = false;
  private _usingViewportOverrides = false;
  private _maskRange: Range3d = Range3d.createNull();

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

  // Returns the TileTreeReferences for the models that need to be drawn to create the planar clip mask, and extend the maskRange if needed.
  public getTileTrees(context: SceneContext, classifiedModelId: Id64String, maskRange: Range3d): TileTreeReference[] | undefined {
    if (this.settings.mode === PlanarClipMaskMode.Priority) {
      // For priority mode we simply want refs for all viewed models if the priority is higher than the mask priority.
      // For this case, we don't need a maskRange so leave it as null.
      const viewTrees = new Array<TileTreeReference>();
      const thisPriority = this.settings.priority === undefined ? PlanarClipMaskPriority.RealityModel : this.settings.priority;
      context.viewport.forEachTileTreeRef((ref) => {
        const tree = ref.treeOwner.load();
        if (tree && tree.modelId !== classifiedModelId && ref.planarClipMaskPriority > thisPriority)
          viewTrees.push(ref);
      });

      return viewTrees;
    }

    // For all other modes we need to let the tree refs in the view state decide which refs need to be drawn
    // since batched tiles cannot turn on/off individual models just by their tile tree refs.
    // Keep calling this until loaded so that the range is valid.
    if (!this._allLoaded) {
      this._tileTreeRefs = new Array<TileTreeReference>();
      if (this.settings.modelIds && context.viewport.view.isSpatialView()) {
        context.viewport.view.collectMaskRefs(this.settings.modelIds, this._tileTreeRefs, maskRange);
      }
      this._allLoaded = this._tileTreeRefs.every((treeRef) => treeRef.treeOwner.load() !== undefined);
      maskRange.clone(this._maskRange);
    } else  // If already loaded, just set the maskRange to the saved maskRange.
      this._maskRange.clone(maskRange);

    return this._allLoaded ? this._tileTreeRefs : undefined;
  }

  // Returns any potential FeatureSymbology overrides for drawing the planar clip mask.
  public getPlanarClipMaskSymbologyOverrides(context: SceneContext, featureSymbologySource: FeatureSymbology.Source): FeatureSymbology.Overrides | undefined {
    this._usingViewportOverrides = false;
    // First obtain a list of models that will need to be turned off for drawing the planar clip mask (only used for batched tile trees).
    const overrideModels = context.viewport.view.isSpatialView() ? context.viewport.view.getModelsNotInMask(this.settings.modelIds, PlanarClipMaskMode.Priority === this.settings.mode) : undefined;

    const noSubCategoryOrElementIds = !this.settings.subCategoryOrElementIds;
    if (noSubCategoryOrElementIds && !overrideModels)
      return undefined;

    const ovrBasedOnContext = PlanarClipMaskMode.Priority === this.settings.mode || PlanarClipMaskMode.Models === this.settings.mode || noSubCategoryOrElementIds;
    const viewport = overrideModels && ovrBasedOnContext ? context.viewport : undefined;
    const overrides = FeatureSymbology.Overrides.withSource(featureSymbologySource, viewport);

    if (overrideModels) {
      // overrideModels is used for batched models.  For those, we need to create model overrides to turn off models that are
      // not wanted in the mask (using transparency) no matter what mask mode is being used.
      const appOff = FeatureAppearance.fromTransparency(1.0);
      // For Priority or Models mode, we need to start with the current overrides and modify them
      if (ovrBasedOnContext) {
        this._usingViewportOverrides = true; // Set flag to use listener since context.viewport might change afterwards.
        overrides.addInvisibleElementOverridesToNeverDrawn();  // need this for fully trans element overrides to not participate in mask
        overrideModels.forEach((modelId: string) => {
          overrides.override({ modelId, appearance: appOff, onConflict: "replace" });
        });
        return overrides;
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
