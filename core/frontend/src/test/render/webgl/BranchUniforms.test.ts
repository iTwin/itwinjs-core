/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { dispose } from "@bentley/bentleyjs-core";
import { ClipVector, Point3d, Transform } from "@bentley/geometry-core";
import { IModelApp } from "../../../IModelApp";
import { ViewRect } from "../../../ViewRect";
import { createEmptyRenderPlan, RenderPlan } from "../../../render/RenderPlan";
import { GraphicBranch } from "../../../render/GraphicBranch";
import { Branch } from "../../../render/webgl/Graphic";
import { ClipVolume } from "../../../render/webgl/ClipVolume";
import { Target } from "../../../render/webgl/Target";

function makeClipVolume(): ClipVolume {
  const vec = ClipVector.createEmpty();
  expect(vec.appendShape([ Point3d.create(1, 1, 0), Point3d.create(2, 1, 0), Point3d.create(2, 2, 0)])).to.be.true;
  const vol = ClipVolume.create(vec)!;
  expect(vol).not.to.be.undefined;
  return vol;
}

interface ClipInfo {
  clip?: ClipVolume;
  showClip?: boolean; // undefined means inherit from top of branch stack
}

function makeBranch(info: ClipInfo): Branch {
  const branch = new GraphicBranch();
  if (undefined !== info.showClip)
    branch.viewFlagOverrides.setShowClipVolume(info.showClip);

  const graphic = IModelApp.renderSystem.createGraphicBranch(branch, Transform.identity, { clipVolume: info.clip });
  expect(graphic instanceof Branch).to.be.true;
  return graphic as Branch;
}

function makeTarget(): Target {
  const rect = new ViewRect(0, 0, 100, 50);
  return IModelApp.renderSystem.createOffscreenTarget(rect) as Target;
}

function expectCurrentClipVolume(target: Target, volume: ClipVolume | undefined): void {
  expect(target.currentClipVolume?.clipVector).to.equal(volume?.clipVector);
}

// Inputs:
//  The clip info for the RenderPlan;
//  Clip info for any number of branches to be pushed;
//  Expected active ClipVolume when each branch is on the top of the stack.
function testClipVolumes(target: Target, viewClip: ClipVolume | undefined, enableViewClip: boolean, branches: ClipInfo[], expectedClips: Array<ClipVolume | undefined>): void {
  const plan: RenderPlan = { ...createEmptyRenderPlan(), clip: viewClip?.clipVector };
  plan.viewFlags.clipVolume = enableViewClip;
  target.changeRenderPlan(plan);

  expect(expectedClips.length).to.equal(branches.length + 1);

  expectCurrentClipVolume(target, undefined);
  target.pushViewClip();
  expect(target.uniforms.branch.length).to.equal(1);
  expectCurrentClipVolume(target, expectedClips[0]);

  for (let i = 0; i < branches.length; i++) {
    const branch = makeBranch(branches[i]);
    target.pushBranch(branch);
    expectCurrentClipVolume(target, expectedClips[i + 1]);
  }

  for (let i = branches.length - 1; i >= 0; i--) {
    target.popBranch();
    expectCurrentClipVolume(target, expectedClips[i]);
  }

  expect(target.uniforms.branch.length).to.equal(1);
  target.popViewClip();
  expectCurrentClipVolume(target, undefined);
}

describe("BranchUniforms", async () => {
  before(async () => {
    await IModelApp.startup();
  });

  after(async () => {
    await IModelApp.shutdown();
  });

  it("should set view clip based on RenderPlan", () => {
    const target = makeTarget();
    testClipVolumes(target, undefined, true, [], [ undefined ]);
    testClipVolumes(target, undefined, false, [], [ undefined ]);

    const viewClip = makeClipVolume();
    testClipVolumes(target, viewClip, true, [], [ viewClip ]);
    testClipVolumes(target, viewClip, false, [], [ undefined ]);

    dispose(target);
  });

  it("should propagate view clip to branches based on RenderPlan", () => {
    const target = makeTarget();
    const viewClip = makeClipVolume();
    testClipVolumes(target, viewClip, true, [ { } ], [ viewClip, viewClip ]);
    testClipVolumes(target, viewClip, false, [ { } ], [ undefined, undefined ]);

    dispose(target);
  });

  it("should propagate view clip to branches based on their view flags", () => {
    const target = makeTarget();
    const viewClip = makeClipVolume();
    testClipVolumes(target, viewClip, true, [ { showClip: false } ], [ viewClip, undefined ]);
    testClipVolumes(target, viewClip, true, [ { showClip: true } ], [ viewClip, viewClip ]);

    dispose(target);
  });

  it("should replace previous clip if branch has its own clip", () => {
    const target = makeTarget();
    const clip = makeClipVolume();
    testClipVolumes(target, undefined, false, [ { clip, showClip: true } ], [ undefined, clip ]);
    testClipVolumes(target, undefined, true, [ { clip, showClip: true } ], [ undefined, clip ]);

    const viewClip = makeClipVolume();
    testClipVolumes(target, viewClip, true, [ { clip, showClip: true } ], [ viewClip, clip ]);
    testClipVolumes(target, viewClip, false, [ { clip, showClip: true } ], [ undefined, clip ]);

    dispose(target);
  });

  it("should turn off clip if branch has its own clip but its view flags disable clipping", () => {
    const target = makeTarget();
    const clip = makeClipVolume();
    testClipVolumes(target, undefined, false, [ { clip, showClip: false } ], [ undefined, undefined ]);
    testClipVolumes(target, undefined, true, [ { clip, showClip: false } ], [ undefined, undefined ]);

    const viewClip = makeClipVolume();
    testClipVolumes(target, viewClip, true, [ { clip, showClip: false } ], [ viewClip, undefined ]);
    testClipVolumes(target, viewClip, false, [ { clip, showClip: false } ], [ undefined, undefined ]);

    dispose(target);
  });

  it("should apply grandparent clip only if parent view flags do not turn clip off", () => {
    const target = makeTarget();
    const viewClip = makeClipVolume();
    testClipVolumes(target, viewClip, true, [ { showClip: true }, { showClip: true } ], [ viewClip, viewClip, viewClip ]);
    testClipVolumes(target, viewClip, true, [ { showClip: false }, { showClip: true } ], [ viewClip, undefined, undefined ]);

    dispose(target);
  });
});
