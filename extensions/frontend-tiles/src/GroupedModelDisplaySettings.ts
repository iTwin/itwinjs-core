/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ModelGroupDisplayTransforms } from "./ModelGroupDisplayTransforms";
import { groupModels, ModelGroup, ModelGroupingContext } from "./ModelGroup";
import { ModelDisplayTransformProvider, RenderClipVolume } from "@itwin/core-frontend";
import { CompressedId64Set, Id64Set, Id64String } from "@itwin/core-bentley";
import { PlanProjectionSettings } from "@itwin/core-common";

/** Arguments supplied to the constructor of [[GroupedModelDisplaySettings]].
 * @internal
 */
export interface GroupedModelDisplaySettingsArgs {
  /** The set of all models to be grouped. Its contents should not change during the lifetime of the GroupedModelDisplaySettings object. */
  includedModelIds: Id64Set;
  modelDisplayTransformProvider?: ModelDisplayTransformProvider;
  getModelClip(modelId: Id64String): RenderClipVolume | undefined;
  getPlanProjectionSettings(modelId: Id64String): PlanProjectionSettings | undefined;
  getAnimationTransformNodeIds(modelId: Id64String): ReadonlySet<number> | undefined;
}

/** Groups models that have equivalent display settings.
 * @internal
 */
export class GroupedModelDisplaySettings implements ModelGroupingContext {
  private _guid: string = "";
  private _transformsValid = false;
  private _groupsValid = false;
  private readonly _args: GroupedModelDisplaySettingsArgs;
  private _groups: ModelGroup[] = [];
  public modelGroupDisplayTransforms: ModelGroupDisplayTransforms;

  public constructor(args: GroupedModelDisplaySettingsArgs) {
    this._args = args;
    this.modelGroupDisplayTransforms = new ModelGroupDisplayTransforms(args.includedModelIds, args.modelDisplayTransformProvider);

    this.update();
  }

  public getModelClip(modelId: Id64String): RenderClipVolume | undefined {
    return this._args.getModelClip(modelId);
  }

  public getPlanProjectionSettings(modelId: Id64String): PlanProjectionSettings | undefined {
    return this._args.getPlanProjectionSettings(modelId);
  }

  public getAnimationTransformNodeIds(modelId: Id64String): ReadonlySet<number> | undefined {
    return this._args.getAnimationTransformNodeIds(modelId);
  }

  /** A string uniquely identifying the current model groupings. This changes when (and only when) the groupings change. */
  public get guid(): string { return this._guid; }

  /** The current groups with their display settings. */
  public get groups(): ReadonlyArray<ModelGroup> { return this._groups; }

  /** Call this when the display transforms might have changed - e.g., if the ModelDisplayTransformProvider changed. */
  public invalidateTransforms() { 
    this._transformsValid = false;
  }

  /** Call this when the groupings might have changed - e.g., if the model clip groups or plan projection settings changed. */
  public invalidateGroups() {
    this._groupsValid = false;
  }

  /** Call this to ensure the groupings and their display settings are up to date - e.g., before drawing.
   * Returns true if the groupings changed as a result.
   */
  public update(): boolean {
    if (!this._transformsValid && this.modelGroupDisplayTransforms.update(this._args.modelDisplayTransformProvider))
      this._groupsValid = false;

    this._transformsValid = true;
    if (this._groupsValid)
      return false;

    this._groupsValid = true;
    this._groups = groupModels(this, this._args.includedModelIds);
    const guid = this._groups.map((x) => CompressedId64Set.compressSet(x.modelIds)).join("_");
    if (guid === this._guid)
      return false;

    this._guid = guid;
    return true;
  }
}
