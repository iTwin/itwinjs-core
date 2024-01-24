/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ModelGroupDisplayTransforms } from "./ModelGroupDisplayTransforms";
import { groupModels, ModelGroup, ModelGroupingContext } from "./ModelGroup";
import { RenderClipVolume, SpatialViewState } from "@itwin/core-frontend";
import { assert, CompressedId64Set, Id64Set, Id64String } from "@itwin/core-bentley";
import { PlanProjectionSettings, RenderSchedule, ViewFlagOverrides } from "@itwin/core-common";
import { ModelMetadata } from "./BatchedTilesetReader";

/** Groups the set of spatial models included in a [[BatchedSpatialTileTreeReferences]] based on their display settings.
 * This ensures that models are displayed correctly, while using batching to reduce the number of draw calls to a minimum.
 * The groupings are re-evaluated only when there's a possibility that they may have changed (e.g., if the view's plan projection settings or model clip groups were modified).
 * Unfortunately, there is currently no way to know when the transforms supplied by a [ModelDisplayTransformProvider]($frontend) may have changed, so
 * display transforms are re-evaluated every time the Viewport's scene is invalidated. This may (but usually won't) affect the groupings.
 * The BatchedSpatialTileTreeReferences object allocates new [[BatchedTileTreeReferences]] whenever the groupings change.
 * @internal
 */
export class BatchedModelGroups implements ModelGroupingContext {
  private readonly _view: SpatialViewState;
  private readonly _includedModelIds: Id64Set;
  private readonly _metadata: Map<Id64String, ModelMetadata>;
  private _script?: RenderSchedule.Script;
  private _transformsValid = false;
  private _groupsValid = false;
  private _scriptValid = false;
  /** A stringified representation of the current groupings, of the format:
   * group1_group2_group3_..._groupN
   * where each group is a [CompressedId64Set]($bentley).
   * @see [[BatchedTileTreeId.modelGroups]].
   */
  public guid = "";
  public groups: ModelGroup[] = [];
  public modelGroupDisplayTransforms: ModelGroupDisplayTransforms;

  public constructor(view: SpatialViewState, script: RenderSchedule.Script | undefined, includedModelIds: Id64Set, metadata: Map<Id64String, ModelMetadata>) {
    this._script = script;
    this._view = view;
    this._includedModelIds = includedModelIds;
    this._metadata = metadata;
    this.modelGroupDisplayTransforms = new ModelGroupDisplayTransforms(includedModelIds, view.modelDisplayTransformProvider);

    this._view.onModelDisplayTransformProviderChanged.addListener(() => this._transformsValid = false);
    this._view.details.onModelClipGroupsChanged.addListener(() => this._groupsValid = false);
    this.listenForDisplayStyleEvents();

    this.update();
  }

  public setScript(script: RenderSchedule.Script | undefined): void {
    this._script = script;
    this._scriptValid = false;
  }

  public invalidateTransforms(): void { this._transformsValid = false; }

  private listenForDisplayStyleEvents(): void {
    const removeListener = this._view.displayStyle.settings.onPlanProjectionSettingsChanged.addListener(() => this._groupsValid = false);
    this._view.onDisplayStyleChanged.addListener(() => {
      this._groupsValid = false;
      removeListener();
      this.listenForDisplayStyleEvents();
    });
  }

  public getModelClip(modelId: Id64String): RenderClipVolume | undefined {
    return this._view.getModelClip(modelId);
  }

  public getPlanProjectionSettings(modelId: Id64String): PlanProjectionSettings | undefined {
    return this._view.displayStyle.settings.getPlanProjectionSettings(modelId);
  }

  public getModelTimeline(modelId: Id64String): RenderSchedule.ModelTimeline | undefined {
    return this._script?.modelTimelines.find((x) => x.modelId === modelId);
  }

  public getViewFlagOverrides(modelId: Id64String): ViewFlagOverrides | undefined {
    return this._metadata.get(modelId)?.viewFlags;
  }

  public getDefaultElevation(modelId: Id64String): number {
    const range = this._metadata.get(modelId)?.extents;
    if (range) {
      const low = range.low.z;
      const high = range.high.z;
      if (low <= high)
        return (low + high) / 2;
    }

    return 0;
  }

  /** Re-evaluate transforms and groupings if they may be out of date.
   * @returns true if the groupings changed as a result.
   */
  public update(): boolean {
    if (!this._transformsValid && this.modelGroupDisplayTransforms.update(this._view.modelDisplayTransformProvider)) {
      this._groupsValid = false;
    }

    this._transformsValid = true;
    if (this._groupsValid && this._scriptValid) {
      // Update the display transforms on the ModelGroups.
      const getFirstModelId = (ids: Id64Set) => {
        for (const id of ids)
          return id;

        return undefined;
      };

      for (const group of this.groups) {
        if (group.displayTransform) {
          const modelId = getFirstModelId(group.modelIds);
          assert(undefined !== modelId);
          group.displayTransform = this.modelGroupDisplayTransforms.getDisplayTransform(modelId);
          assert(undefined !== group.displayTransform);
        }
      }

      return false; // the groupings haven't changed.
    }

    this.groups = groupModels(this, this._includedModelIds);
    const newGuid = this.groups.map((x) => CompressedId64Set.compressSet(x.modelIds)).join("_");

    const updated = newGuid !== this.guid || !this._scriptValid;

    this.guid = newGuid;
    this._groupsValid = this._scriptValid = true;

    return updated;
  }
}
