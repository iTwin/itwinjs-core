/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ModelGroupDisplayTransforms } from "./ModelGroupDisplayTransforms";
import { groupModels, ModelGroup, ModelGroupingContext } from "./ModelGroup";
import { RenderClipVolume, SpatialViewState, Viewport } from "@itwin/core-frontend";
import { CompressedId64Set, Id64Set, Id64String } from "@itwin/core-bentley";
import { PlanProjectionSettings, RenderSchedule } from "@itwin/core-common";

export abstract class BatchedModelGroups {
  protected _script?: RenderSchedule.Script;
  protected _scriptValid = false;
  
  protected constructor(script: RenderSchedule.Script | undefined) {
    this._script = script;
  }

  public abstract get guid(): string;
  public abstract get groups(): ReadonlyArray<Readonly<ModelGroup>>;
  public abstract update(): boolean;
  public attachToViewport(_vp: Viewport): void { }
  public setScript(script: RenderSchedule.Script | undefined): void {
    this._script = script;
    this._scriptValid = false;
  }

  public static create(view: SpatialViewState, script: RenderSchedule.Script | undefined, includedModelIds: Id64Set | undefined): BatchedModelGroups {
    return includedModelIds?.size ? new Groups(view, script, includedModelIds) : new Group(view, script);
  }
}

/** Implementation of BatchedModelGroups for tilesets that do not disclose the set of included model Ids.
 * Only schedule animations are supported - no other per-model settings.
 * This exists to support tilesets that were published before the publisher was updated to include the set of included model Ids.
 * At some point, we will probably want to remove it.
 */
class Group extends BatchedModelGroups {
  private readonly _view: SpatialViewState;
  public readonly guid = "";
  public readonly groups: ModelGroup[] = [];

  public constructor(view: SpatialViewState, script: RenderSchedule.Script | undefined) {
    super(script);
    this._view = view;
    this.groups = [{ modelIds: new Set() }];

    this.update();
  }

  public update(): boolean {
    if (this._scriptValid)
      return false;

    this._scriptValid = true;
    const nodeIds = this._view.scheduleScript?.transformBatchIds;
    this.groups[0].animationTransformNodeIds = nodeIds ? new Set(nodeIds) : undefined;

    return true;
  }
}

/** Implementation of BatchedModelGroups for tilesets that disclose the set of included model Ids.
 * Per-model settings like clip, transform, and plan projections are supported in addition to schedule animations.
 */
class Groups extends BatchedModelGroups implements ModelGroupingContext {
  private readonly _view: SpatialViewState;
  private readonly _includedModelIds: Id64Set;
  private _transformsValid = false;
  private _groupsValid = false;
  public guid = "";
  public groups: ModelGroup[] = [];
  public modelGroupDisplayTransforms: ModelGroupDisplayTransforms;

  public constructor(view: SpatialViewState, script: RenderSchedule.Script | undefined, includedModelIds: Id64Set) {
    super(script);
    this._view = view;
    this._includedModelIds = includedModelIds;
    this.modelGroupDisplayTransforms = new ModelGroupDisplayTransforms(includedModelIds, view.modelDisplayTransformProvider);

    this._view.onModelDisplayTransformProviderChanged.addListener(() => this._transformsValid = false);
    this._view.details.onModelClipGroupsChanged.addListener(() => this._groupsValid = false);
    this.listenForDisplayStyleEvents();

    this.update();
  }

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

  public getAnimationTransformNodeIds(modelId: Id64String): ReadonlyArray<number> | undefined {
    return this._view.scheduleScript?.modelTimelines.find((x) => x.modelId === modelId)?.transformBatchIds;
  }

  public override attachToViewport(_vp: Viewport): void {
    // ###TODO listen for scene invalidation to potentially invalidate display transforms.
  }

  public update(): boolean {
    if (!this._transformsValid && this.modelGroupDisplayTransforms.update(this._view.modelDisplayTransformProvider)) {
      this._groupsValid = false;
    }

    this._transformsValid = true;
    if (this._groupsValid && this._scriptValid) {
      return true;
    }

    this.groups = groupModels(this, this._includedModelIds);
    const newGuid = this.groups.map((x) => CompressedId64Set.compressSet(x.modelIds)).join("_");

    const updated = newGuid !== this.guid || !this._scriptValid;

    this.guid = newGuid;
    this._groupsValid = this._scriptValid = true;

    return updated;
  }
}
