/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect, use } from "chai";
import { ClipVector, Transform } from "@itwin/core-geometry";
import { PlanProjectionSettings } from "@itwin/core-common";
import { ModelDisplayTransformProvider, RenderClipVolume } from "@itwin/core-frontend";
import { ModelGroupingContext } from "../ModelGroup";
import { Id64String } from "@itwin/core-bentley";

class GroupingContext implements ModelGroupingContext {
  private _modelClips = new Map<Id64String, RenderClipVolume | undefined>();
  public modelDisplayTransformProvider?: ModelDisplayTransformProvider;
  public displayStyle: {
    settings: {
      getPlanProjectionSettings: (modelId: Id64String) => PlanProjectionSettings | undefined;
    };
  };
  public getModelClip(modelId: Id64String) {
    return this._modelClips.get(modelId);
  }

  public constructor(args: {
    clips?: Array<[Id64String[], ClipVector | undefined]>;
    transforms?: Array<[Id64String[], Transform, true | undefined]>;
    planProjections?: Array<[Id64String[], PlanProjectionSettings]>;
  }) {
    const { clips, transforms, planProjections } = args;
    if (transforms) {
      this.modelDisplayTransformProvider = {
        getModelDisplayTransform: (modelId: Id64String) => {
          const entry = transforms.find((x) => x[0].includes(modelId));
          return entry ? { transform: entry[1], premultiply: entry[2] } : undefined;
        }
      };
    }

    if (clips) {
      for (const entry of clips) {
        const clip: RenderClipVolume | undefined = entry[1] ? { clipVector: entry[1] } : undefined;
        for (const modelId of entry[0]) {
          this._modelClips.set(modelId, clip);
        }
      }
    }

    this.displayStyle = {
      settings: {
        getPlanProjectionSettings: (modelId: Id64String) => {
          const entry = planProjections?.find((x) => x[0].includes(modelId));
          return entry ? entry[1] : undefined;
        }
      }
    }
  }
}

describe.only("groupModels", () => {
  it("groups all models together if no special settings", () => {
  });

  it("only groups models specified", () => {
  });

  it("groups all models together if all settings match", () => {
  });

  it("produces one group per unique plan projection settings", () => {
  });

  it("produces one group per unique display transform", () => {
  });

  it("produces one group per unique clip volume", () => {
  });

  it("produces one group per unique combination of plan projection settings, clip volume, and display transform", () => {
  });

  it("associates each animation transform node with corresponding model group", () => {
  });
});
