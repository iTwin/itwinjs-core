/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import { RenderMode, ViewFlagOverrides, ViewFlagOverridesProps, ViewFlags } from "../ViewFlags";

describe("ViewFlags", () => {
  it("should initialize to expected defaults", () => {
    const flags = new ViewFlags();
    assert(flags.acsTriad === false);
    assert(flags.grid === false);
    assert(flags.fill === true);
    assert(flags.renderMode === RenderMode.Wireframe);
  });

  it("should round-trip through JSON", () => {
    const flags = new ViewFlags();
    flags.renderMode = RenderMode.SmoothShade;
    flags.monochrome = true;
    const jsonstr = JSON.stringify(flags);
    const flags2 = ViewFlags.fromJSON(JSON.parse(jsonstr));
    assert(flags.acsTriad === flags2.acsTriad);
    assert(flags.renderMode === flags2.renderMode);
    assert(flags.monochrome === flags2.monochrome);
  });

  it("should compute whether edges are required", () => {
    const testCases: ViewFlags[] = [];
    for (const renderMode of [RenderMode.Wireframe, RenderMode.HiddenLine, RenderMode.SolidFill, RenderMode.SmoothShade]) {
      for (let i = 0; i < 2; i++) {
        const vf = new ViewFlags();
        vf.renderMode = renderMode;
        vf.visibleEdges = i > 0;
        testCases.push(vf);
      }
    }

    for (const viewflags of testCases) {
      const edgesRequired = RenderMode.SmoothShade !== viewflags.renderMode || viewflags.visibleEdges;
      expect(viewflags.edgesRequired()).to.equal(edgesRequired);
    }
  });
});

describe("ViewFlagOverrides", () => {
  it("should round-trip through JSON", () => {
    const testCases: ViewFlagOverridesProps[] = [
      { },
      { dimensions: true, transparency: false, renderMode: RenderMode.SolidFill },
      {
        dimensions: true,
        patterns: true,
        weights: true,
        styles: true,
        transparency: true,
        fill: true,
        textures: true,
        materials: true,
        lighting: true,
        visibleEdges: true,
        hiddenEdges: true,
        shadows: false,
        clipVolume: false,
        constructions: false,
        monochrome: false,
        noGeometryMap: false,
        backgroundMap: false,
        hLineMaterialColors: false,
        forceSurfaceDiscard: false,
        whiteOnWhiteReversal: false,
        edgeMask: 2,
        renderMode: RenderMode.HiddenLine,
        thematicDisplay: false,
      },
    ];

    for (const testCase of testCases) {
      const ovrs = ViewFlagOverrides.fromJSON(testCase);
      const json = ovrs.toJSON();
      expect(json).to.deep.equal(testCase);
    }

    expect(ViewFlagOverrides.fromJSON(undefined).toJSON()).to.deep.equal({ });
  });

  it("should compute whether edges are required", () => {
    const viewflagTestCases: ViewFlags[] = [];
    for (const renderMode of [RenderMode.Wireframe, RenderMode.HiddenLine, RenderMode.SolidFill, RenderMode.SmoothShade]) {
      for (let i = 0; i < 2; i++) {
        const vf = new ViewFlags();
        vf.renderMode = renderMode;
        vf.visibleEdges = i > 0;
        viewflagTestCases.push(vf);
      }
    }

    const ovrsTestCases: Array<[ViewFlagOverrides, RenderMode | undefined, boolean | undefined]> = [];
    for (const renderMode of [undefined, RenderMode.Wireframe, RenderMode.HiddenLine, RenderMode.SolidFill, RenderMode.SmoothShade]) {
      for (let i = 0; i < 3; i++) {
        const ovrs = new ViewFlagOverrides();
        if (undefined !== renderMode)
          ovrs.setRenderMode(renderMode);

        let visibleEdges;
        if (i > 0) {
          visibleEdges = i > 1;
          ovrs.setShowVisibleEdges(visibleEdges);
        }

        ovrsTestCases.push([ovrs, renderMode, visibleEdges]);
      }
    }

    for (const testCase of ovrsTestCases) {
      for (const viewflags of viewflagTestCases) {
        const renderMode = undefined !== testCase[1] ? testCase[1] : viewflags.renderMode;
        const edges = undefined !== testCase[2] ? testCase[2] : viewflags.visibleEdges;
        const edgesRequired = edges || RenderMode.SmoothShade !== renderMode;
        expect(testCase[0].edgesRequired(viewflags)).to.equal(edgesRequired);
      }
    }
  });
});
