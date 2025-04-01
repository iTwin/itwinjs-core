/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dispose } from "@itwin/core-bentley";
import { ClipVector, Point3d, Transform, Vector3d } from "@itwin/core-geometry";
import { IModelApp } from "../../../IModelApp.js";
import { ViewRect } from "../../../common/ViewRect.js";
import { createEmptyRenderPlan } from "../../../internal/render/RenderPlan.js";
import { GraphicBranch } from "../../../render/GraphicBranch.js";
import { Branch } from "../../../internal/render/webgl/Graphic.js";
import { ClipVolume } from "../../../internal/render/webgl/ClipVolume.js";
import { ClipStack } from "../../../internal/render/webgl/ClipStack.js";
import { Target } from "../../../internal/render/webgl/Target.js";
import { ClipStyle, EmptyLocalization } from "@itwin/core-common";
import { BranchUniforms } from "../../../internal/render/webgl/BranchUniforms.js";
import { ScreenViewport } from "../../../Viewport.js";
import { SpatialViewState } from "../../../core-frontend.js";
import { createBlankConnection } from "../../createBlankConnection.js";

function makeClipVolume(): ClipVolume {
  const vec = ClipVector.createEmpty();
  expect(vec.appendShape([Point3d.create(1, 1, 0), Point3d.create(2, 1, 0), Point3d.create(2, 2, 0)])).toBe(true);
  const vol = ClipVolume.create(vec)!;
  expect(vol).toBeDefined();
  return vol;
}

interface ClipInfo {
  clip?: ClipVolume;
  noViewClip?: boolean; // undefined means inherit from parent on branch stack
  disableClipStyle?: true;
}

function makeBranch(info: ClipInfo): Branch {
  const branch = new GraphicBranch();
  if (undefined !== info.noViewClip)
    branch.viewFlagOverrides.clipVolume = !info.noViewClip;
  const graphic = IModelApp.renderSystem.createGraphicBranch(branch, Transform.identity, { clipVolume: info.clip, disableClipStyle: info.disableClipStyle });
  expect(graphic).toBeInstanceOf(Branch);
  return graphic as Branch;
}

function makeTarget(): Target {
  const rect = new ViewRect(0, 0, 100, 50);
  return IModelApp.renderSystem.createOffscreenTarget(rect) as Target;
}

function expectClipStack(target: Target, expected: Array<{ numRows: number }>): void {
  const actual = target.uniforms.branch.clipStack.clips;
  expect(actual.length).toEqual(expected.length);
  expect(actual.length).toBeGreaterThanOrEqual(1);

  const actualView = actual[0];
  const expectedView = expected[0];
  expect(actualView.numRows).toEqual(expectedView.numRows);
  expect(actualView instanceof ClipVolume).toEqual(expectedView instanceof ClipVolume);
  if (actualView instanceof ClipVolume && expectedView instanceof ClipVolume) // Needed to avoid type error
    expect(actualView.clipVector).toEqual(expectedView.clipVector);

  for (let i = 1; i < actual.length; i++)
    expect(actual[i]).toEqual(expected[i]);
}

function expectClipStyle(uniforms: BranchUniforms, expectedAlphas: number[]): void {
  expect(uniforms.clipStack.insideColor.alpha).to.equal(expectedAlphas[0]);
  expect(uniforms.clipStack.outsideColor.alpha).to.equal(expectedAlphas[1]);
  expect(uniforms.clipStack.intersectionStyle.alpha).to.equal(expectedAlphas[2]);
}

/** Inputs:
 * - The view clip and ViewFlags.clipVolume
 * - A stack of branches to be pushed
 * - The expected stack of ClipVolumes on the ClipStack, including the view clip, after pushing all branches.
 * - Whether we expect the view's clip to apply to the top branch.
 * - Optionally, the Clipstack's expected ClipStyle alpha values after the branches are pushed.
 * - Optionally, the viewport's ClipStyle alpha values - what is expected after the branches are popped.
 */
function testBranches(viewClip: ClipInfo, branches: ClipInfo[], expectViewClip: boolean, expectedClips: Array<{ numRows: number }>, branchClipStyleAlphaValues?: number[], viewportClipStyleAlphaValues?: number[]): void {
  const plan = { ...createEmptyRenderPlan(), clip: viewClip.clip?.clipVector };
  plan.viewFlags = plan.viewFlags.with("clipVolume", true !== viewClip.noViewClip);

  const target = makeTarget();
  target.changeRenderPlan(plan);
  target.pushViewClip();

  const uniforms = target.uniforms.branch;
  expect(uniforms.length).toEqual(1);
  const prevClips = [...uniforms.clipStack.clips];
  const hadClip = uniforms.clipStack.hasClip;
  const hadViewClip = uniforms.clipStack.hasViewClip;

  for (const branch of branches)
    target.pushBranch(makeBranch(branch));

  expect(uniforms.clipStack.hasViewClip).toEqual(expectViewClip);
  expect(uniforms.clipStack.hasClip).toEqual(expectViewClip || expectedClips.length > 1);
  expectClipStack(target, expectedClips);

  if (branchClipStyleAlphaValues)
    expectClipStyle(uniforms, branchClipStyleAlphaValues);

  for (const _branch of branches)
    target.popBranch();

  if (viewportClipStyleAlphaValues)
    expectClipStyle(uniforms, viewportClipStyleAlphaValues);

  expect(uniforms.clipStack.hasViewClip).toEqual(hadViewClip);
  expect(uniforms.clipStack.hasClip).toEqual(hadClip);
  expectClipStack(target, prevClips);

  dispose(target);
}

describe("BranchUniforms", async () => {
  beforeAll(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
  });

  afterAll(async () => {
    await IModelApp.shutdown();
  });

  it("should set view clip based on RenderPlan", () => {
    testBranches({}, [], false, [ClipStack.emptyViewClip]);
    testBranches({ noViewClip: true }, [], false, [ClipStack.emptyViewClip]);

    const clip = makeClipVolume();
    testBranches({ clip }, [], true, [clip]);
    testBranches({ clip, noViewClip: true }, [], false, [clip]);
  });

  it("should propagate view clip to branches based on view flags", () => {
    const clip = makeClipVolume();
    testBranches({ clip }, [{}], true, [clip]);
    testBranches({ clip, noViewClip: true }, [{}], false, [clip]);
    testBranches({ clip }, [{ noViewClip: true }], false, [clip]);
    testBranches({ clip }, [{ noViewClip: true }, { noViewClip: false }], true, [clip]);
    testBranches({ clip }, [{ noViewClip: false }, { noViewClip: true }], false, [clip]);
  });

  it("should apply branch clips regardless of view flags", () => {
    const viewClip = makeClipVolume();
    const branchClip = makeClipVolume();
    testBranches({ clip: viewClip }, [{ clip: branchClip }], true, [viewClip, branchClip]);
    testBranches({ clip: viewClip, noViewClip: true }, [{ clip: branchClip }], false, [viewClip, branchClip]);
    testBranches({ clip: viewClip }, [{ clip: branchClip, noViewClip: true }], false, [viewClip, branchClip]);
    testBranches({ clip: viewClip }, [{ clip: branchClip, noViewClip: true }, {}], false, [viewClip, branchClip]);
    testBranches({ clip: viewClip }, [{ clip: branchClip, noViewClip: true }, { noViewClip: true }], false, [viewClip, branchClip]);
  });

  it("should nest clip volumes", () => {
    const viewClip = makeClipVolume();
    const outerClip = makeClipVolume();
    const innerClip = makeClipVolume();

    testBranches({ clip: viewClip }, [{ clip: outerClip }, { clip: innerClip }], true, [viewClip, outerClip, innerClip]);
  });

  it ("should disable clip style", async () => {
    const viewClip = makeClipVolume();
    const branchClip = makeClipVolume();

    // create a viewport
    const imodel = createBlankConnection("imodel");
    const viewDiv = document.createElement("div");
    viewDiv.style.width = viewDiv.style.height = "100px";
    document.body.appendChild(viewDiv);
    const view = SpatialViewState.createBlank(imodel, new Point3d(), new Vector3d(1, 1, 1));
    const vp = ScreenViewport.create(viewDiv, view);
    IModelApp.viewManager.addViewport(vp);
    await IModelApp.viewManager.setSelectedView(vp);

    // create a clip style and assign it to the viewport
    const testStyle = ClipStyle.fromJSON({
      insideColor: {r: 255, g: 0, b: 0},
      outsideColor: {r: 0, g: 255, b: 0},
      intersectionStyle: {
        color: {r: 0, g: 0, b: 255},
        width: 1,
      },
    });
    vp.clipStyle = testStyle;

    // disableClipStyle is undefined, so we expect the inside color, outside color, and intersection style width to all be 1
    testBranches({ clip: viewClip }, [{ clip: branchClip }], true, [viewClip, branchClip], [1,1,1]);

    // disableClipStyle is true, so we expect the branch to have disabled the inside color, outside color, and intersection style width,
    // setting all of their alpha values to 0. After the branch is popped, we expect the viewport's clip style to be restored.
    testBranches({ clip: viewClip }, [{ clip: branchClip, disableClipStyle: true }], true, [viewClip, branchClip], [0,0,0], [1,1,1]);

    IModelApp.viewManager.dropViewport(vp);
  });

  it("should inherit clip style from the top of the stack",async  () => {
    const viewClip = makeClipVolume();
    const firstClip = makeClipVolume();
    const secondClip = makeClipVolume();
    const thirdClip = makeClipVolume();

    // create a viewport
    const imodel = createBlankConnection("imodel");
    const viewDiv = document.createElement("div");
    viewDiv.style.width = viewDiv.style.height = "100px";
    document.body.appendChild(viewDiv);
    const view = SpatialViewState.createBlank(imodel, new Point3d(), new Vector3d(1, 1, 1));
    const vp = ScreenViewport.create(viewDiv, view);
    IModelApp.viewManager.addViewport(vp);
    await IModelApp.viewManager.setSelectedView(vp);

    // create a clip style and assign it to the viewport
    const testStyle = ClipStyle.fromJSON({
      insideColor: {r: 255, g: 0, b: 0},
      outsideColor: {r: 0, g: 255, b: 0},
      intersectionStyle: {
        color: {r: 0, g: 0, b: 255},
        width: 1,
      },
    });
    vp.clipStyle = testStyle;

    testBranches({ clip: viewClip }, [{ clip: firstClip, disableClipStyle: true }, { clip: secondClip}, {clip: thirdClip}], true, [viewClip, firstClip, secondClip, thirdClip], [0,0,0], [1,1,1]);

    IModelApp.viewManager.dropViewport(vp);
  });

  it("should disable clip style in complex scene graphs", async () => {

    // create a viewport
    const imodel = createBlankConnection("imodel");
    const viewDiv = document.createElement("div");
    viewDiv.style.width = viewDiv.style.height = "100px";
    document.body.appendChild(viewDiv);
    const view = SpatialViewState.createBlank(imodel, new Point3d(), new Vector3d(1, 1, 1));
    const vp = ScreenViewport.create(viewDiv, view);
    IModelApp.viewManager.addViewport(vp);
    await IModelApp.viewManager.setSelectedView(vp);

    // create a clip style and assign it to the viewport
    const testStyle = ClipStyle.fromJSON({
      insideColor: {r: 255, g: 0, b: 0},
      outsideColor: {r: 0, g: 255, b: 0},
      intersectionStyle: {
        color: {r: 0, g: 0, b: 255},
        width: 1,
      },
    });
    vp.clipStyle = testStyle;

    // create target
    const viewClip = makeClipVolume();
    const plan = { ...createEmptyRenderPlan(), clip: viewClip.clipVector };
    plan.viewFlags = plan.viewFlags.with("clipVolume", true);
    const target = makeTarget();
    target.changeRenderPlan(plan);
    target.pushViewClip();

    const uniforms = target.uniforms.branch;

    /* scenario 1 scene graph:
    *  branch 1
    *    branch 1a: disableClipStyle = true;
    *       branch 1a1
    *       branch 1a2
    *
    * clip style should be disabled for branches 1a, 1a1, and 1a2
    */

    const branch1 = makeBranch({ clip: makeClipVolume() });
    const branch1a = makeBranch({ clip: makeClipVolume(), disableClipStyle: true });
    const branch1a1 = makeBranch({ clip: makeClipVolume() });
    const branch1a2 = makeBranch({ clip: makeClipVolume() });

    target.pushBranch(branch1);
    // expect clip style to be enabled
    expectClipStyle(uniforms, [1,1,1]);

    target.pushBranch(branch1a);
    // expect clip style to be disabled
    expectClipStyle(uniforms, [0,0,0]);

    target.pushBranch(branch1a1);
    expectClipStyle(uniforms, [0,0,0]);

    target.popBranch();
    expectClipStyle(uniforms, [0,0,0]);

    target.pushBranch(branch1a2);
    expectClipStyle(uniforms, [0,0,0]);

    target.popBranch();
    expectClipStyle(uniforms, [0,0,0]);

    target.popBranch();
    expectClipStyle(uniforms, [1,1,1]);

    // after this pop, all branches have been popped
    target.popBranch();
    expectClipStyle(uniforms, [1,1,1]);

    /* scenario 2 scene graph:
    *  branch 1
    *    branch 1a: disableClipStyle = true;
    *       branch 1a1
    *         branch 1a1a
    *       branch 1a2
    *    branch 1b
    * branch 2
    *    branch 2a
    *
    *  clip style should be disabled for branches 1a, 1a1, 1a1a, and 1a2
    */

    const branch1a1a = makeBranch({ clip: makeClipVolume() });
    const branch1b = makeBranch({ clip: makeClipVolume() });
    const branch2 = makeBranch({ clip: makeClipVolume() });
    const branch2a = makeBranch({ clip: makeClipVolume() });

    target.pushBranch(branch1);
    expectClipStyle(uniforms, [1,1,1]);

    target.pushBranch(branch1a);
    expectClipStyle(uniforms, [0,0,0]);

    target.pushBranch(branch1a1);
    expectClipStyle(uniforms, [0,0,0]);

    target.pushBranch(branch1a1a);
    expectClipStyle(uniforms, [0,0,0]);

    target.popBranch();
    expectClipStyle(uniforms, [0,0,0]);

    target.popBranch();
    expectClipStyle(uniforms, [0,0,0]);

    target.pushBranch(branch1a2);
    expectClipStyle(uniforms, [0,0,0]);

    target.popBranch();
    expectClipStyle(uniforms, [0,0,0]);

    target.popBranch();
    expectClipStyle(uniforms, [1,1,1]);

    target.pushBranch(branch1b);
    expectClipStyle(uniforms, [1,1,1]);

    target.popBranch();
    expectClipStyle(uniforms, [1,1,1]);

    target.popBranch();
    expectClipStyle(uniforms, [1,1,1]);

    target.pushBranch(branch2);
    expectClipStyle(uniforms, [1,1,1]);

    target.pushBranch(branch2a);
    expectClipStyle(uniforms, [1,1,1]);
  });
});
