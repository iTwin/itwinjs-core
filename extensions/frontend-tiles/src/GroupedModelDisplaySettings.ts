/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ModelGroupDisplayTransforms } from "./ModelGroupDisplayTransforms";
import { ModelGroupingContext } from "./ModelGroup";
import { ModelDisplayTransformProvider, RenderClipVolume } from "@itwin/core-frontend";
import { Id64Set, Id64String } from "@itwin/core-bentley";
import { PlanProjectionSettings } from "@itwin/core-common";

export interface GroupedModelDisplaySettingsArgs {
  includedModelIds: Id64Set;
  modelDisplayTransformProvider?: ModelDisplayTransformProvider;
  getModelClip(modelId: Id64String): RenderClipVolume | undefined;
  getPlanProjectionSettings(modelId: Id64String): PlanProjectionSettings | undefined;
}
export class GroupedModelDisplaySettings implements ModelGroupingContext {
  private readonly _modelIds: Id64Set;
  public modelGroupDisplayTransforms: ModelGroupDisplayTransforms;
  public getModelClip: (modelId: Id64String) => RenderClipVolume | undefined;
  public getPlanProjectionSettings: (modelId: Id64String) => PlanProjectionSettings | undefined;

  public constructor(args: GroupedModelDisplaySettingsArgs) {
    this._modelIds = args.includedModelIds;
    this.modelGroupDisplayTransforms = new ModelGroupDisplayTransforms(this._modelIds, args.modelDisplayTransformProvider);
    this.getPlanProjectionSettings = (id) => args.getPlanProjectionSettings(id);
    this.getModelClip = (id) => args.getModelClip(id);
  }
}
