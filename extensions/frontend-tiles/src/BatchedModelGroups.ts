/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ModelGroupDisplayTransforms } from "./ModelGroupDisplayTransforms";
import { groupModels, ModelGroup, ModelGroupingContext } from "./ModelGroup";
import { RenderClipVolume, SpatialViewState, Viewport } from "@itwin/core-frontend";
import { assert, CompressedId64Set, Id64Set, Id64String } from "@itwin/core-bentley";
import { PlanProjectionSettings, RenderSchedule } from "@itwin/core-common";

export class BatchedModelGroups implements ModelGroupingContext {
  private readonly _view: SpatialViewState;
  private readonly _includedModelIds: Id64Set;
  private _script?: RenderSchedule.Script;
  private _transformsValid = false;
  private _groupsValid = false;
  private _scriptValid = false;
  public guid = "";
  public groups: ModelGroup[] = [];
  public modelGroupDisplayTransforms: ModelGroupDisplayTransforms;

  public constructor(view: SpatialViewState, script: RenderSchedule.Script | undefined, includedModelIds: Id64Set) {
    this._script = script;
    this._view = view;
    this._includedModelIds = includedModelIds;
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
