/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { Id64Set, Id64String } from "@itwin/core-bentley";
import { ClipVector, Transform } from "@itwin/core-geometry";
import { PlanProjectionSettings, RenderSchedule, ViewFlagOverrides } from "@itwin/core-common";
import { ModelDisplayTransform,  RenderClipVolume } from "@itwin/core-frontend";
import { groupModels, ModelGroupingContext } from "../ModelGroup";
import { ModelGroupDisplayTransforms } from "../ModelGroupDisplayTransforms";

interface ModelSettings {
  transform?: ModelDisplayTransform;
  clip?: ClipVector;
  projection?: PlanProjectionSettings;
  nodeIds?: ReadonlyArray<number>;
  elevation?: number;
  viewFlags?: ViewFlagOverrides;
}

interface GroupingContextArgs {
  [modelId: Id64String]: ModelSettings | undefined;
}

class GroupingContext implements ModelGroupingContext {
  private _clips: Array<RenderClipVolume & { modelId: Id64String }> = [];
  public modelGroupDisplayTransforms: ModelGroupDisplayTransforms;
  public getPlanProjectionSettings: (modelId: Id64String) => PlanProjectionSettings | undefined;
  public getDefaultElevation: (modelId: Id64String) => number;
  public getModelTimeline: (modelId: Id64String) => RenderSchedule.ModelTimeline | undefined;
  public getViewFlagOverrides: (modelId: Id64String) => ViewFlagOverrides | undefined;

  public getModelClip(modelId: Id64String) {
    return this._clips.find((x) => x.modelId === modelId);
  }

  public constructor(args: GroupingContextArgs, modelIds: Id64Set) {
    this.modelGroupDisplayTransforms = new ModelGroupDisplayTransforms(modelIds, {
      getModelDisplayTransform: (modelId: Id64String) => args[modelId]?.transform,
    });

    this.getPlanProjectionSettings = (modelId: Id64String) => args[modelId]?.projection;
    this.getDefaultElevation = (modelId: Id64String) => args[modelId]?.elevation ?? 123;
    this.getViewFlagOverrides = (modelId: Id64String) => args[modelId]?.viewFlags;

    const timelines = new Map<Id64String, RenderSchedule.ModelTimeline>();
    this.getModelTimeline = (modelId: Id64String) => timelines.get(modelId);

    for (const modelId of Object.keys(args)) {
      const clip = args[modelId]?.clip;
      if (clip) {
        const clipVector = this._clips.find((x) => x.clipVector === clip)?.clipVector ?? clip;
        this._clips.push({ clipVector, modelId });
      }

      const nodeIds = args[modelId]?.nodeIds;
      if (nodeIds) {
        const timeline = RenderSchedule.ModelTimeline.fromJSON({ modelId, elementTimelines: [] });
        (timeline as any).transformBatchIds = nodeIds;
        timelines.set(modelId, timeline);
      }
    }
  }
}

function expectGrouping(expected: Array<Id64String[]>, args: GroupingContextArgs, modelIds: Id64String[], expectedNodeIds?: Array<number[] | undefined>): void {
  const modelIdSet = new Set(modelIds);
  const context = new GroupingContext(args, modelIdSet);
  const groups = groupModels(context, modelIdSet);
  const actual = groups.map((x) => Array.from(x.modelIds).sort());
  expect(actual).to.deep.equal(expected);

  if (expectedNodeIds) {
    const actualNodeIds = groups.map((x) => x.timeline ? Array.from(x.timeline.transformBatchIds) : undefined);
    expect(actualNodeIds).to.deep.equal(expectedNodeIds);
  } else {
    expect(groups.every((x) => undefined === x.timeline)).to.be.true;
  }
}

describe("groupModels", () => {
  it("groups all models together if no special settings", () => {
    expectGrouping([], {}, []);
    expectGrouping([["0x1"]], {}, ["0x1"]);
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
    expectGrouping(
      [["0x1"], ["0x2"], ["0x3"], ["0x4"]], {
        "0x1": { projection: PlanProjectionSettings.fromJSON({ elevation: 1 }) },
        "0x2": { projection: PlanProjectionSettings.fromJSON({ elevation: 2 }) },
        "0x3": { projection: PlanProjectionSettings.fromJSON({ elevation: 3 }) },
      },
      ["0x1", "0x2", "0x3", "0x4"],
    );

    expectGrouping(
      [["0x1", "0x3"], ["0x2", "0x4"], ["0x5"]], {
        "0x1": { projection: PlanProjectionSettings.fromJSON({ elevation: 1 }) },
        "0x2": { projection: PlanProjectionSettings.fromJSON({ elevation: 2 }) },
        "0x3": { projection: PlanProjectionSettings.fromJSON({ elevation: 1 }) },
        "0x4": { projection: PlanProjectionSettings.fromJSON({ elevation: 2 }) },
      },
      ["0x1", "0x2", "0x3", "0x4", "0x5"],
    );
  });

  it("groups plan projection models that resolve to the same elevation", () => {
    expectGrouping(
      [["0x1"], ["0x2", "0x3"], ["0x4", "0x5"]], {
        "0x1": { projection: PlanProjectionSettings.fromJSON({ overlay: true, elevation: 1 })},
        "0x2": { projection: PlanProjectionSettings.fromJSON({ overlay: true, elevation: 2 })},
        "0x3": { projection: PlanProjectionSettings.fromJSON({ overlay: true }), elevation: 2 },
        "0x4": { projection: PlanProjectionSettings.fromJSON({ overlay: true }), elevation: 4 },
        "0x5": { projection: PlanProjectionSettings.fromJSON({ overlay: true, elevation: 4 }), elevation: 1 },
      },
      ["0x1", "0x2", "0x3", "0x4", "0x5"],
    );
  });

  it("produces one group per unique display transform", () => {
    expectGrouping(
      [["0x1"], ["0x2"], ["0x3"], ["0x4"]], {
        "0x1": { transform: { transform: Transform.createTranslationXYZ(1) } },
        "0x2": { transform: { transform: Transform.createTranslationXYZ(2) } },
        "0x3": { transform: { transform: Transform.createTranslationXYZ(3) } },
      },
      ["0x1", "0x2", "0x3", "0x4"],
    );

    expectGrouping(
      [["0x1", "0x3"], ["0x2", "0x4"], ["0x5"]], {
        "0x1": { transform: { transform: Transform.createTranslationXYZ(1) } },
        "0x2": { transform: { transform: Transform.createTranslationXYZ(2) } },
        "0x3": { transform: { transform: Transform.createTranslationXYZ(1) } },
        "0x4": { transform: { transform: Transform.createTranslationXYZ(2) } },
      },
      ["0x1", "0x2", "0x3", "0x4", "0x5"],
    );
  });

  it("produces one group per unique clip volume", () => {
    // NB: Currently clip vectors are only compared by identity, not effective equality.
    const c1 = ClipVector.createEmpty();
    const c2 = ClipVector.createEmpty();
    const c3 = ClipVector.createEmpty();

    expectGrouping(
      [["0x1"], ["0x2"], ["0x3"], ["0x4"]], {
        "0x1": { clip: c1 },
        "0x2": { clip: c2 },
        "0x3": { clip: c3 },
      },
      ["0x1", "0x2", "0x3", "0x4"],
    );

    expectGrouping(
      [["0x1", "0x3"], ["0x2", "0x4"], ["0x5"]], {
        "0x1": { clip: c1 },
        "0x2": { clip: c2 },
        "0x3": { clip: c1 },
        "0x4": { clip: c2 },
      },
      ["0x1", "0x2", "0x3", "0x4", "0x5"],
    );
  });

  it("produces one group per unique combination of plan projection settings, clip volume, and display transform", () => {
    const p1 = PlanProjectionSettings.fromJSON({ elevation: 1 });
    const t1 = { transform: Transform.createTranslationXYZ(1) };
    const c1 = ClipVector.createEmpty();

    expectGrouping([["0x1", "0x2"], ["0x3"], ["0x4", "0x5", "0x6"], ["0x7"], ["0x8"], ["0x9"], ["0xa", "0xb"], ["0xc", "0xd"]], {
      "0x1": { projection: p1, transform: t1, clip: c1 },
      "0x2": { projection: p1, transform: t1, clip: c1 },
      "0x3": { projection: p1, clip: c1 },
      "0x4": { transform: t1, clip: c1 },
      "0x5": { transform: t1, clip: c1 },
      "0x6": { transform: t1, clip: c1 },
      "0x7": { projection: p1, transform: t1 },
      "0x8": { projection: p1 },
      "0x9": { clip: c1 },
      "0xa": { transform: t1 },
      "0xb": { transform: t1 },
    }, ["0x1", "0x2", "0x3", "0x4", "0x5", "0x6", "0x7", "0x8", "0x9", "0xa", "0xb", "0xc", "0xd"]);

    const p2 = PlanProjectionSettings.fromJSON({ elevation: 2 });
    const t2 = { transform: t1.transform, premultiply: true };
    const c2 = ClipVector.createEmpty();

    expectGrouping([["0x1", "0x2"], ["0x3"], ["0x4", "0x5"], ["0x6"], ["0x7", "0x8"]], {
      "0x1": { projection: p1, transform: t1 },
      "0x2": { projection: p1, transform: t1 },
      "0x3": { projection: p1, transform: t2 },
      "0x4": { projection: p2, transform: t2 },
      "0x5": { projection: p2, transform: t2 },
      "0x6": { projection: p2, transform: t2, clip: c1 },
      "0x7": { projection: p2, transform: t2, clip: c2 },
      "0x8": { projection: p2, transform: t2, clip: c2 },
    }, ["0x1", "0x2", "0x3", "0x4", "0x5", "0x6", "0x7", "0x8"]);
  });

  it("produces a single-model group for every model that has a timeline", () => {
    expectGrouping([["0x1"]], {
      "0x1": { nodeIds: [1, 2, 3, 4] },
    }, ["0x1"], [[1, 2, 3, 4]]);

    expectGrouping([["0x1"], ["0x2"]], {
      "0x1": { nodeIds: [1, 2] },
      "0x2": { nodeIds: [3, 4] },
    }, ["0x1", "0x2"], [[1, 2], [3, 4]]);

    expectGrouping([["0x1", "0x3"], ["0x2"]], {
      "0x1": { },
      "0x2": { nodeIds: [3, 4]},
      "0x3": { },
    }, ["0x1", "0x2", "0x3"], [undefined, [3, 4]]);

    expectGrouping([["0x1"], ["0x2"], ["0x3", "0x4"], ["0x5"]], {
      "0x1": { nodeIds: [1, 2]},
      "0x2": { nodeIds: [3, 4]},
      "0x3": { },
      "0x4": { },
      "0x5": { transform: { transform: Transform.createTranslationXYZ(5) } },
    }, ["0x1", "0x2", "0x3", "0x4", "0x5"], [[1, 2], [3, 4], undefined, undefined]);
  });
});
