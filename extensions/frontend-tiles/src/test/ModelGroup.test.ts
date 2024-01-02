/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect, use } from "chai";
import { ClipVector, Transform } from "@itwin/core-geometry";
import { PlanProjectionSettings } from "@itwin/core-common";
import { ModelDisplayTransform, ModelDisplayTransformProvider, RenderClipVolume } from "@itwin/core-frontend";
import { groupModels, ModelGroupingContext } from "../ModelGroup";
import { Id64String } from "@itwin/core-bentley";

interface ModelSettings {
  transform?: ModelDisplayTransform;
  clip?: ClipVector;
  projection?: PlanProjectionSettings;
}

interface GroupingContextArgs {
  [modelId: Id64String]: ModelSettings | undefined;
}

class GroupingContext implements ModelGroupingContext {
  private _clips: Array<RenderClipVolume & { modelId: Id64String }> = [];
  public modelDisplayTransformProvider: ModelDisplayTransformProvider;
  public displayStyle: {
    settings: {
      getPlanProjectionSettings: (modelId: Id64String) => PlanProjectionSettings | undefined;
    };
  };

  public getModelClip(modelId: Id64String) {
    return this._clips.find((x) => x.modelId === modelId)
  }

  public constructor(args: GroupingContextArgs) {
    this.modelDisplayTransformProvider = {
      getModelDisplayTransform: (modelId: Id64String) => args[modelId]?.transform,
    };
    
    this.displayStyle = {
      settings: {
        getPlanProjectionSettings: (modelId: Id64String) => args[modelId]?.projection,
      },
    };

    for (const modelId of Object.keys(args)) {
      const clip = args[modelId]?.clip;
      if (!clip)
        continue;

      const clipVector = this._clips.find((x) => x.clipVector === clip)?.clipVector ?? clip;
      this._clips.push({ clipVector, modelId });
    }
  }
}

function expectGrouping(expected: Array<Id64String[]>, args: GroupingContextArgs, modelIds: Id64String[]): void {
  const context = new GroupingContext(args);
  const groups = groupModels(context, new Set(modelIds));
  const actual = groups.map((x) => Array.from(x.modelIds).sort());
  expect(actual).to.deep.equal(expected);
}

describe.only("groupModels", () => {
  it("groups all models together if no special settings", () => {
    expectGrouping([], {}, []);
    expectGrouping([["0x1"]], {}, ["0x1"])
    expectGrouping([["0x1", "0x2", "0x3"]], {}, ["0x1", "0x3", "0x2"]);
  });

  it("groups all models together if all settings match", () => {
    const clip = ClipVector.createEmpty();
    const args: GroupingContextArgs = { };
    for (const modelId of ["0x1", "0x2", "0x3"]) {
      args[modelId] = {
        clip,
        transform: { transform: Transform.createTranslationXYZ(1, 2, 3) },
        projection: PlanProjectionSettings.fromJSON({ elevation: 123 }),
      };
    }

    expectGrouping([["0x1", "0x2", "0x3"]], args, ["0x1", "0x2", "0x3"]);
  });

  it("produces one group per unique plan projection settings", () => {
    const e1 = PlanProjectionSettings.fromJSON({ elevation: 1 });
    const e2 = PlanProjectionSettings.fromJSON({ elevation: 2 });
    const e3 = PlanProjectionSettings.fromJSON({ elevation: 3 });

    expectGrouping(
      [["0x1"], ["0x2"], ["0x3"], ["0x4"]], {
        "0x1": { projection: e1 },
        "0x2": { projection: e2 },
        "0x3": { projection: e3 },
      },
      ["0x1", "0x2", "0x3", "0x4"]
    );

    expectGrouping(
      [["0x1", "0x3"], ["0x2", "0x4"], ["0x5"]], {
        "0x1": { projection: e1 },
        "0x2": { projection: e2 },
        "0x3": { projection: e1 },
        "0x4": { projection: e2 },
      },
      ["0x1,", "0x2", "0x3", "0x4", "0x5"]
    );
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
