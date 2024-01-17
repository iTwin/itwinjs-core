/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ModelClipGroup, ModelClipGroups } from "@itwin/core-common";
import { IModelApp, Tool } from "@itwin/core-frontend";

export class ApplyModelClipTool extends Tool {
  public static override toolId = "ApplyModelClip";

  public override async run(): Promise<boolean> {
    const vp = IModelApp.viewManager.selectedView;
    if (!vp || !vp.view.isSpatialView())
      return false;

    const viewedModels = vp.view.modelSelector.models;
    if (viewedModels.size === 0)
      return true;

    // Remove existing clips for all viewed models.
    let groups = vp.view.details.modelClipGroups.groups.map((group) => {
      let models = group.models;
      if (models)
        models = models.filter((modelId) => !viewedModels.has(modelId));

      return ModelClipGroup.create(group.clip, models);
    });

    groups = groups.filter((group) => group.models?.length);

    if (vp.view.details.clipVector) {
      // Add clip group for viewed models, remove view clip.
      groups.push(ModelClipGroup.create(vp.view.details.clipVector, Array.from(viewedModels)));
      vp.view.details.clipVector = undefined;
    }

    vp.view.details.modelClipGroups = new ModelClipGroups(groups);
    return true;
  }
}
