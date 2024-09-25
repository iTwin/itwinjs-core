/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { dispose } from "@itwin/core-bentley";
import { ClipVector, Point3d, Transform, Vector3d } from "@itwin/core-geometry";
import { IModelApp } from "../../../IModelApp";
import { ViewRect } from "../../../common/ViewRect";
import { createEmptyRenderPlan } from "../../../render/RenderPlan";
import { GraphicBranch } from "../../../render/GraphicBranch";
import { Branch } from "../../../render/webgl/Graphic";
import { ClipVolume } from "../../../render/webgl/ClipVolume";
import { ClipStack } from "../../../render/webgl/ClipStack";
import { Target } from "../../../render/webgl/Target";
import { ClipStyle, EmptyLocalization } from "@itwin/core-common";
import { BranchUniforms } from "../../../render/webgl/BranchUniforms";
import { ScreenViewport } from "../../../Viewport";
import { SpatialViewState } from "../../../core-frontend";
import { createBlankConnection } from "../../createBlankConnection";

function makeClipVolume(): ClipVolume {
  const vec = ClipVector.createEmpty();
  expect(vec.appendShape([Point3d.create(1, 1, 0), Point3d.create(2, 1, 0), Point3d.create(2, 2, 0)])).to.be.true;
  const vol = ClipVolume.create(vec)!;
  expect(vol).not.to.be.undefined;
  return vol;
}

interface ClipInfo {
  clip?: ClipVolume;
  noViewClip?: boolean; // undefined means inherit from parent on branch stack
  disableClipStyle?: boolean;
}

function makeBranch(info: ClipInfo): Branch {
  const branch = new GraphicBranch();
  if (undefined !== info.noViewClip)
    branch.viewFlagOverrides.clipVolume = !info.noViewClip;
  const graphic = IModelApp.renderSystem.createGraphicBranch(branch, Transform.identity, { clipVolume: info.clip, disableClipStyle: info.disableClipStyle });
  expect(graphic instanceof Branch).to.be.true;
  return graphic as Branch;
}

function makeTarget(): Target {
  const rect = new ViewRect(0, 0, 100, 50);
  return IModelApp.renderSystem.createOffscreenTarget(rect) as Target;
}

function expectClipStack(target: Target, expected: Array<{ numRows: number }>): void {
  const actual = target.uniforms.branch.clipStack.clips;
  expect(actual.length).to.equal(expected.length);
  expect(actual.length).least(1);

  const actualView = actual[0];
  const expectedView = expected[0];
  expect(actualView.numRows).to.equal(expectedView.numRows);
  expect(actualView instanceof ClipVolume).to.equal(expectedView instanceof ClipVolume);
  if (actualView instanceof ClipVolume && expectedView instanceof ClipVolume)
    expect(actualView.clipVector).to.equal(expectedView.clipVector);

  for (let i = 1; i < actual.length; i++)
    expect(actual[i]).to.equal(expected[i]);
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
 * - Optionally, the expected Alpha values of the ClipStack's ClipStyle.
 */
function testBranches(viewClip: ClipInfo, branches: ClipInfo[], expectViewClip: boolean, expectedClips: Array<{ numRows: number }>, expectedClipStyleAlphaValues?: number[]): void {
  const plan = { ...createEmptyRenderPlan(), clip: viewClip.clip?.clipVector };
  plan.viewFlags = plan.viewFlags.with("clipVolume", true !== viewClip.noViewClip);

  const target = makeTarget();
  target.changeRenderPlan(plan);
  target.pushViewClip();

  const uniforms = target.uniforms.branch;
  expect(uniforms.length).to.equal(1);
  const prevClips = [...uniforms.clipStack.clips];
  const hadClip = uniforms.clipStack.hasClip;
  const hadViewClip = uniforms.clipStack.hasViewClip;

  for (const branch of branches)
    target.pushBranch(makeBranch(branch));

  expect(uniforms.clipStack.hasViewClip).to.equal(expectViewClip);
  expect(uniforms.clipStack.hasClip).to.equal(expectViewClip || expectedClips.length > 1);
  expectClipStack(target, expectedClips);

  if (expectedClipStyleAlphaValues)
    expectClipStyle(uniforms, expectedClipStyleAlphaValues);

  for (const _branch of branches)
    target.popBranch();

  expect(uniforms.clipStack.hasViewClip).to.equal(hadViewClip);
  expect(uniforms.clipStack.hasClip).to.equal(hadClip);
  expectClipStack(target, prevClips);

  dispose(target);
}

describe("BranchUniforms", async () => {
  before(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
  });

  after(async () => {
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

    // disableClipStyle is false, so we expect the inside color, outside color, and intersection style width to all be 1
    testBranches({ clip: viewClip }, [{ clip: branchClip, disableClipStyle: false }], true, [viewClip, branchClip], [1,1,1]);

    // disableClipStyle is true, so we expect the branch to have disabled the inside color, outside color, and intersection style width,
    // setting all of their alpha values to 0
    testBranches({ clip: viewClip }, [{ clip: branchClip, disableClipStyle: true }], true, [viewClip, branchClip], [0,0,0]);

    IModelApp.viewManager.dropViewport(vp);
  });

  it("should inherit clip style from the top of the stack",async  () => {
    const viewClip = makeClipVolume();
    const firstClip = makeClipVolume();
    const secondClip = makeClipVolume();

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

    testBranches({ clip: viewClip }, [{ clip: firstClip, disableClipStyle: true }, { clip: secondClip}], true, [viewClip, firstClip, secondClip], [0,0,0]);
    IModelApp.viewManager.dropViewport(vp);
  });
});
