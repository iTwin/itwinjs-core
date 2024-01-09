/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ModelGroupDisplayTransforms } from "./ModelGroupDisplayTransforms";
import { groupModels, ModelGroup, ModelGroupingContext } from "./ModelGroup";
import { ModelDisplayTransformProvider, RenderClipVolume, SpatialViewState, Viewport } from "@itwin/core-frontend";
import { CompressedId64Set, Id64Set, Id64String } from "@itwin/core-bentley";
import { PlanProjectionSettings } from "@itwin/core-common";

export interface BatchedModelGroups {
  readonly guid: string;
  readonly groups: ReadonlyArray<Readonly<ModelGroup>>;
  readonly update: () => boolean;
  readonly attachToViewport: (vp: Viewport) => void;
  readonly invalidateScheduleScript: () => void;
}

/** Implementation of BatchedModelGroups for tilesets that do not disclose the set of included model Ids.
 * Only schedule animations are supported - no other per-model settings.
 * This exists to support tilesets that were published before the publisher was updated to include the set of included model Ids.
 * At some point, we will probably want to remove it.
 */
class EmptyGroups implements BatchedModelGroups {
  private readonly _view: SpatialViewState;
  private _scriptValid = false;
  public readonly guid = "";
  public readonly groups: ModelGroup[] = [];

  public constructor(view: SpatialViewState) {
    this._view = view;
    this.groups = [{ modelIds: new Set() }];

    this.update();
  }

  public attachToViewport(): void { }

  public invalidateScheduleScript(): void {
    this._scriptValid = false;
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
class Groups implements BatchedModelGroups, ModelGroupingContext {
  private readonly _view: SpatialViewState;
  private readonly _includedModelIds: Id64Set;
  private _scriptValid = false;
  private _transformsValid = false;
  private _groupsValid = false;
  public guid = "";
  public groups: ModelGroup[] = [];
  public modelGroupDisplayTransforms: ModelGroupDisplayTransforms;

  public constructor(view: SpatialViewState, includedModelIds: Id64Set) {
    this._view = view;
    this._includedModelIds = includedModelIds;
    this.modelGroupDisplayTransforms = new ModelGroupDisplayTransforms(includedModelIds, view.modelDisplayTransformProvider);

    // ###TODO listen for invalidating events.
    
    this.update();
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

  public invalidateScheduleScript(): void {
    this._scriptValid = false;
  }
  
  public attachToViewport(_vp: Viewport): void {
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
