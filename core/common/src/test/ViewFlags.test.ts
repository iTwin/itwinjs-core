/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { assert, expect } from "chai";
import {
  RenderMode, ViewFlagOverrides, ViewFlagProps, ViewFlags, ViewFlagsProperties,
} from "../ViewFlags";

function invertDefaults(): ViewFlags {
  const invertedProperties: Partial<ViewFlagsProperties> = { renderMode: RenderMode.SolidFill, edgeMask: 1 };
  for (const propname of Object.keys(ViewFlags.defaults)) {
    const key = propname as keyof ViewFlags;
    const value = ViewFlags.defaults[key];
    if (typeof value === "boolean")
      (invertedProperties as any)[key] = !value;
  }

  return new ViewFlags(invertedProperties);
}

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

    roundTrip(invertDefaults().toJSON(), {
      noDim: true,
      noPattern: true,
      noWeight: true,
      noStyle: true,
      noTransp: true,
      noFill: true,
      grid: true,
      acs: true,
      noTexture: true,
      noMaterial: true,
      visEdges: true,
      hidEdges: true,
      shadows: true,
      hlMatColors: true,
      monochrome: true,
      edgeMask: 1,
      renderMode: RenderMode.SolidFill,
      ambientOcclusion: true,
      thematicDisplay: true,
      backgroundMap: true,
      forceSurfaceDiscard: true,
      noWhiteOnWhiteReversal: true,
    });
  });

  it("should compute whether edges are required", () => {
    const testCases: ViewFlags[] = [];
    for (const renderMode of [RenderMode.Wireframe, RenderMode.HiddenLine, RenderMode.SolidFill, RenderMode.SmoothShade]) {
      for (let i = 0; i < 2; i++) {
        const vf = new ViewFlags({ renderMode, visibleEdges: i > 0 });
        testCases.push(vf);
      }
    }

    for (const viewflags of testCases) {
      const edgesRequired = RenderMode.SmoothShade !== viewflags.renderMode || viewflags.visibleEdges;
      expect(viewflags.edgesRequired()).to.equal(edgesRequired);
    }
  });

  it("copies", () => {
    const def = ViewFlags.defaults;
    expect(def.copy({})).to.deep.equal(def);

    const inv = invertDefaults();
    expect(def.copy(inv)).to.deep.equal(inv);
    expect(inv.copy(def)).to.deep.equal(def);

    expect(inv.copy({ ...inv, renderMode: undefined, transparency: undefined })).to.deep.equal({ ...inv, renderMode: RenderMode.Wireframe, transparency: true });
  });


  it("overrides", () => {
    const def = ViewFlags.defaults;
    expect(def.override({})).to.deep.equal(def);

    const inv = invertDefaults();
    expect(def.override(inv)).to.deep.equal(inv);
    expect(inv.override(def)).to.deep.equal(def);

    expect(inv.override({ ...inv, renderMode: undefined, transparency: undefined })).to.deep.equal(inv);
  });

  it("returns defaults if no properties supplied", () => {
    expect(ViewFlags.fromJSON()).to.equal(ViewFlags.defaults);
    expect(ViewFlags.create()).to.equal(ViewFlags.defaults);
    expect(ViewFlags.create({ })).to.equal(ViewFlags.defaults);
  });

  it("uses different defaults for undefined vs ViewFlagProps", () => {
    const def = ViewFlags.defaults;
    expect(ViewFlags.fromJSON(undefined)).to.deep.equal(def);

    expect(ViewFlags.fromJSON({ })).to.deep.equal({
      ...def,
      clipVolume: !def.clipVolume,
      sourceLights: !def.sourceLights,
      cameraLights: !def.cameraLights,
      solarLight: !def.solarLight,
      constructions: !def.constructions,
    });
  });
});

describe("ViewFlagOverrides", () => {
  it("should compute whether edges are required", () => {
    const viewflagTestCases: ViewFlags[] = [];
    for (const renderMode of [RenderMode.Wireframe, RenderMode.HiddenLine, RenderMode.SolidFill, RenderMode.SmoothShade]) {
      for (let i = 0; i < 2; i++) {
        const vf = new ViewFlags({ renderMode, visibleEdges: i > 0 });
        viewflagTestCases.push(vf);
      }
    }

    const ovrsTestCases: Array<[ViewFlagOverrides, RenderMode | undefined, boolean | undefined]> = [];
    for (const renderMode of [undefined, RenderMode.Wireframe, RenderMode.HiddenLine, RenderMode.SolidFill, RenderMode.SmoothShade]) {
      for (let i = 0; i < 3; i++) {
        const ovrs: ViewFlagOverrides = { };
        if (undefined !== renderMode)
          ovrs.renderMode = renderMode;

        let visibleEdges;
        if (i > 0)
          visibleEdges = ovrs.visibleEdges = i > 1;

        ovrsTestCases.push([ovrs, renderMode, visibleEdges]);
      }
    }

    for (const testCase of ovrsTestCases) {
      for (let viewflags of viewflagTestCases) {
        const renderMode = undefined !== testCase[1] ? testCase[1] : viewflags.renderMode;
        const edges = undefined !== testCase[2] ? testCase[2] : viewflags.visibleEdges;
        const edgesRequired = edges || RenderMode.SmoothShade !== renderMode;
        viewflags = viewflags.override(testCase[0]);
        expect(viewflags.edgesRequired()).to.equal(edgesRequired);
      }
    }
  });
});
