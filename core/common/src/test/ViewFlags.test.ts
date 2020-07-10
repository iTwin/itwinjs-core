/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import {
  RenderMode, ViewFlagOverrides, ViewFlagOverridesProps, ViewFlagProps, ViewFlags,
} from "../ViewFlags";

describe("ViewFlags", () => {
  it("should initialize to expected defaults", () => {
    const flags = new ViewFlags();
    assert(flags.acsTriad === false);
    assert(flags.grid === false);
    assert(flags.fill === true);
    assert(flags.renderMode === RenderMode.Wireframe);
  });

  it("should round-trip through JSON", () => {
    const roundTrip = (input: ViewFlagProps | undefined, expected: ViewFlagProps | "input") => {
      if ("input" === expected)
        expected = input ?? { };

      const vf = ViewFlags.fromJSON(input);
      const output = vf.toJSON();
      expect(output).to.deep.equal(expected);

      const fullOutput = vf.toFullyDefinedJSON();
      for (const key of Object.keys(output) as Array<keyof ViewFlagProps>)
        expect(fullOutput[key]).to.equal(output[key]);
    };

    roundTrip({ }, { renderMode: RenderMode.Wireframe });
    roundTrip({ acs: true, monochrome: true, renderMode: RenderMode.Wireframe }, "input");
    roundTrip({ acs: false, monochrome: false, renderMode: RenderMode.SmoothShade }, { renderMode: RenderMode.SmoothShade });

    const makeViewFlags = (on: boolean) => {
      const vfProps: Required<ViewFlagProps> = {
        noConstruct: on,
        noDim: on,
        noPattern: on,
        noWeight: on,
        noStyle: on,
        noTransp: on,
        noFill: on,
        grid: on,
        acs: on,
        noTexture: on,
        noMaterial: on,
        noCameraLights: on,
        noSourceLights: on,
        noSolarLight: on,
        visEdges: on,
        hidEdges: on,
        shadows: on,
        clipVol: on,
        hlMatColors: on,
        monochrome: on,
        backgroundMap: on,
        edgeMask: 1,
        ambientOcclusion: on,
        thematicDisplay: on,
        forceSurfaceDiscard: on,
        noWhiteOnWhiteReversal: on,
        renderMode: RenderMode.SolidFill,
      };

      return vfProps;
    };

    roundTrip(makeViewFlags(true), "input");
    roundTrip(makeViewFlags(false), { renderMode: RenderMode.SolidFill, edgeMask: 1 });

    const defaults = {
      clipVol: true,
      noCameraLights: true,
      noConstruct: true,
      noSolarLight: true,
      noSourceLights: true,
      renderMode: RenderMode.Wireframe,
    };

    roundTrip(undefined, defaults);
    roundTrip(new ViewFlags().toJSON(), defaults);
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
