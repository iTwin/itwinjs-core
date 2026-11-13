/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dispose } from "@itwin/core-bentley";
import { Transform } from "@itwin/core-geometry";
import { EmptyLocalization, HiddenLine, RenderMode, ViewFlagOverrides } from "@itwin/core-common";
import { IModelApp } from "../../../IModelApp";
import { ViewRect } from "../../../common/ViewRect";
import { createEmptyRenderPlan } from "../../../internal/render/RenderPlan";
import { GraphicBranch } from "../../../render/GraphicBranch";
import { Branch } from "../../../internal/render/webgl/Graphic";
import { Target } from "../../../internal/render/webgl/Target";
import { RenderPass } from "../../../internal/render/webgl/RenderFlags";
import { IModelDisplayReference } from "../../../IModelDisplayReference";
import { SpatialViewState } from "../../../SpatialViewState";
import { IModelConnection } from "../../../IModelConnection";
import { createBlankConnection } from "../../createBlankConnection";

describe("BranchState", () => {
  let primaryIModel: IModelConnection;
  let linkedIModel: IModelConnection;
  let secondLinkedIModel: IModelConnection;

  beforeAll(async () => {
    await IModelApp.startup({ localization: new EmptyLocalization() });
    primaryIModel = createBlankConnection("primary");
    linkedIModel = createBlankConnection("linked");
    secondLinkedIModel = createBlankConnection("second-linked");
  });

  afterAll(async () => {
    await secondLinkedIModel.close();
    await linkedIModel.close();
    await primaryIModel.close();
    await IModelApp.shutdown();
  });

  function makeTarget(): Target {
    const target = IModelApp.renderSystem.createOffscreenTarget(new ViewRect(0, 0, 100, 50)) as Target;
    const plan = { ...createEmptyRenderPlan() };
    plan.viewFlags = plan.viewFlags.override({ renderMode: RenderMode.SmoothShade, transparency: true });
    target.changeRenderPlan(plan);
    return target;
  }

  function makeBranch(iModelRef: IModelDisplayReference | undefined, viewFlagOverrides?: ViewFlagOverrides, hline?: HiddenLine.Settings): Branch {
    const branch = new GraphicBranch();
    if (viewFlagOverrides)
      branch.setViewFlagOverrides(viewFlagOverrides);

    const graphic = IModelApp.renderSystem.createGraphicBranch(branch, Transform.identity, { iModelRef, hline });
    expect(graphic).toBeInstanceOf(Branch);
    return graphic as Branch;
  }

  it("applies each reference's view flag and hidden-line overrides at its rendering boundary", () => {
    const view = SpatialViewState.createBlank(primaryIModel, { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });
    const refs = view.iModelRefs;
    const hiddenLineRef = refs.link({
      iModel: linkedIModel,
      overrides: {
        viewFlags: { renderMode: RenderMode.HiddenLine },
        hiddenLineSettings: HiddenLine.Settings.fromJSON({ visible: { width: 3 } }),
      },
    });
    const wireframeRef = refs.link({
      iModel: secondLinkedIModel,
      overrides: { viewFlags: { renderMode: RenderMode.Wireframe } },
    });

    const target = makeTarget();
    try {
      const viewEdgeSettings = target.currentBranch.edgeSettings;
      expect(target.currentBranch.viewFlags.renderMode).toBe(RenderMode.SmoothShade);

      // The primary reference has no overrides - its branches inherit the view's state.
      target.pushBranch(makeBranch(refs.primary));
      expect(target.currentBranch.viewFlags.renderMode).toBe(RenderMode.SmoothShade);
      expect(target.currentBranch.edgeSettings).toBe(viewEdgeSettings);
      target.popBranch();

      // A linked reference's overrides apply to its branches...
      target.pushBranch(makeBranch(hiddenLineRef));
      let state = target.currentBranch;
      expect(state.viewFlags.renderMode).toBe(RenderMode.HiddenLine);
      expect(state.edgeSettings.getWeight(RenderPass.OpaqueGeneral, state.viewFlags)).toBe(3);
      target.popBranch();

      // ...and are restored when the branch is popped.
      state = target.currentBranch;
      expect(state.viewFlags.renderMode).toBe(RenderMode.SmoothShade);
      expect(state.edgeSettings).toBe(viewEdgeSettings);

      // Two references with different modes and styles each get their own state, including at nested boundaries.
      target.pushBranch(makeBranch(wireframeRef));
      expect(target.currentBranch.viewFlags.renderMode).toBe(RenderMode.Wireframe);
      expect(target.currentBranch.edgeSettings).toBe(viewEdgeSettings);

      target.pushBranch(makeBranch(hiddenLineRef));
      state = target.currentBranch;
      expect(state.viewFlags.renderMode).toBe(RenderMode.HiddenLine);
      expect(state.edgeSettings.getWeight(RenderPass.OpaqueGeneral, state.viewFlags)).toBe(3);
      target.popBranch();

      expect(target.currentBranch.viewFlags.renderMode).toBe(RenderMode.Wireframe);
      target.popBranch();

      refs.unlink(hiddenLineRef);
      refs.unlink(wireframeRef);
    } finally {
      dispose(target);
    }
  });

  it("applies the branch's own overrides on top of the reference's defaults", () => {
    const view = SpatialViewState.createBlank(primaryIModel, { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });
    const refs = view.iModelRefs;
    const linkedRef = refs.link({
      iModel: linkedIModel,
      overrides: {
        viewFlags: { renderMode: RenderMode.HiddenLine },
        hiddenLineSettings: HiddenLine.Settings.fromJSON({ visible: { width: 3 } }),
      },
    });

    const target = makeTarget();
    try {
      // Model/section overrides supplied by the branch itself take precedence over the reference's defaults.
      const sectionHline = HiddenLine.Settings.fromJSON({ visible: { width: 5 } });
      target.pushBranch(makeBranch(linkedRef, { renderMode: RenderMode.SolidFill }, sectionHline));
      const state = target.currentBranch;
      expect(state.viewFlags.renderMode).toBe(RenderMode.SolidFill);
      expect(state.edgeSettings.getWeight(RenderPass.OpaqueGeneral, state.viewFlags)).toBe(5);
      target.popBranch();

      refs.unlink(linkedRef);
    } finally {
      dispose(target);
    }
  });

  it("composes reference overrides with the previous state rather than replacing it", () => {
    const view = SpatialViewState.createBlank(primaryIModel, { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1 });
    const refs = view.iModelRefs;
    const linkedRef = refs.link({
      iModel: linkedIModel,
      overrides: { viewFlags: { renderMode: RenderMode.HiddenLine } },
    });

    const target = makeTarget();
    try {
      // Simulate a baseline established by an enclosing pass or branch - e.g., transparency forced off.
      target.pushBranch(makeBranch(undefined, { transparency: false }));
      expect(target.currentBranch.viewFlags.transparency).toBe(false);

      // Crossing a reference boundary applies only the flags the reference explicitly overrides.
      target.pushBranch(makeBranch(linkedRef));
      expect(target.currentBranch.viewFlags.renderMode).toBe(RenderMode.HiddenLine);
      expect(target.currentBranch.viewFlags.transparency).toBe(false);

      target.popBranch();
      target.popBranch();

      refs.unlink(linkedRef);
    } finally {
      dispose(target);
    }
  });
});
