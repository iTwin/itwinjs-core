/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { describe, expect, it } from "vitest";
import { ColorDef, HiddenLine, LinePixels, RenderMode, ViewFlags } from "@itwin/core-common";
import { EdgeSettings } from "../../../render/webgl/EdgeSettings";
import { RenderPass } from "../../../render/webgl/RenderFlags";
import { LineCode } from "../../../render/webgl/LineCode";
import { OvrFlags } from "../../../common/internal/render/OvrFlags";

describe("EdgeSettings", () => {
  it("defaults to overriding nothing", () => {
    const es = EdgeSettings.create(undefined);
    for (const renderMode of [ RenderMode.Wireframe, RenderMode.SmoothShade ]) {
      const vf = ViewFlags.fromJSON({ renderMode });
      for (const pass of [ RenderPass.OpaqueLinear, RenderPass.HiddenEdge ]) {
        expect(es.computeOvrFlags(pass, vf)).toEqual(OvrFlags.None);
        es.init(undefined);
        expect(es.computeOvrFlags(pass, vf)).toEqual(OvrFlags.None);
      }
    }
  });

  it("initializes correctly based on HiddenLine.Settings", () => {
    function makeStyle(color?: ColorDef, width?: number, pattern?: LinePixels): HiddenLine.StyleProps {
      return { ovrColor: undefined !== color, color: color?.toJSON(), width, pattern };
    }

    function makeSettings(visible?: HiddenLine.StyleProps, hidden?: HiddenLine.StyleProps): HiddenLine.Settings {
      return HiddenLine.Settings.fromJSON({ visible, hidden });
    }

    interface Expected {
      color?: ColorDef;
      visCode?: LinePixels;
      visWeight?: number;
      hidCode?: LinePixels;
      hidWeight?: number;
    }

    function makeExpected(color?: ColorDef, visWeight?: number, visPix?: LinePixels, hidWeight?: number, hidPix?: LinePixels): Expected {
      const visCode = undefined !== visPix ? LineCode.valueFromLinePixels(visPix) : undefined;
      const hidCode = undefined !== hidPix ? LineCode.valueFromLinePixels(hidPix) : undefined;
      return { color, visCode, visWeight, hidCode, hidWeight };
    }

    function expectSettings(es: EdgeSettings, exp: Expected): void {
      const vf = ViewFlags.fromJSON({ renderMode: RenderMode.HiddenLine });
      expect(es.getColor(vf)?.tbgr).toEqual(exp.color?.tbgr);
      expect(es.getLineCode(RenderPass.OpaqueLinear, vf)).toEqual(exp.visCode);
      expect(es.getWeight(RenderPass.OpaqueLinear, vf)).toEqual(exp.visWeight);
      expect(es.getLineCode(RenderPass.HiddenEdge, vf)).toEqual(exp.hidCode);
      expect(es.getWeight(RenderPass.HiddenEdge, vf)).toEqual(exp.hidWeight);
    }

    const testCases = [
      {
        settings: makeSettings(makeStyle(ColorDef.red, 4, LinePixels.Code2), makeStyle(ColorDef.green, 2, LinePixels.Code3)),
        expected: makeExpected(ColorDef.red, 4, LinePixels.Code2, 2, LinePixels.Code3),
      },
      {
        // Width of 0 and LinePixels.Invalid => not overridden
        settings: makeSettings(makeStyle(undefined, 0, LinePixels.Invalid), makeStyle(undefined, 4, LinePixels.Invalid)),
        expected: makeExpected(undefined, undefined, undefined, 4),
      },
      {
        // Nonsense LinePixels => solid
        settings: makeSettings(makeStyle(undefined, undefined, 1234321 as LinePixels), makeStyle(undefined, undefined, 4321234 as LinePixels)),
        expected: makeExpected(undefined, undefined, LinePixels.Solid, undefined, LinePixels.Solid),
      },
      {
        settings: makeSettings(undefined, makeStyle(ColorDef.green, 2, LinePixels.Code3)),
        expected: makeExpected(undefined, undefined, undefined, 2, LinePixels.Code3),
      },
      {
        settings: makeSettings(makeStyle(undefined, 40, undefined), makeStyle(undefined, -10, undefined)),
        expected: makeExpected(undefined, 32, undefined, 1, LinePixels.HiddenLine),
      },
    ];

    let prevES = EdgeSettings.create(undefined);
    for (const testCase of testCases) {
      const es = EdgeSettings.create(testCase.settings);
      expectSettings(es, testCase.expected);

      prevES.init(testCase.settings);
      expectSettings(prevES, testCase.expected);

      prevES = es;
    }
  });

  it("overrides nothing if view flags do not enable visible edges", () => {
    const es = EdgeSettings.create(HiddenLine.Settings.fromJSON({
      visible: { ovrColor: true, color: 0xff00ff, width: 3, pattern: LinePixels.Solid },
      hidden: { ovrColor: true, color: 0xff00ff, width: 3, pattern: LinePixels.Solid },
    }));

    const vfs = [
      ViewFlags.fromJSON({ renderMode: RenderMode.Wireframe }),
      ViewFlags.fromJSON({ renderMode: RenderMode.Wireframe, visEdges: true, hidEdges: true }),
      ViewFlags.fromJSON({ renderMode: RenderMode.SmoothShade }),
      ViewFlags.fromJSON({ renderMode: RenderMode.SmoothShade, hidEdges: true }),
    ];

    for (const vf of vfs)
      for (const pass of [ RenderPass.OpaqueLinear, RenderPass.HiddenEdge ])
        expect(es.computeOvrFlags(pass, vf)).toEqual(OvrFlags.None);
  });

  it("overrides defaults for certain render modes", () => {
    const es = EdgeSettings.create(undefined);
    for (const renderMode of [ RenderMode.HiddenLine, RenderMode.SolidFill ])
      for (const pass of [ RenderPass.OpaqueLinear, RenderPass.HiddenEdge ]) {
        const vf = ViewFlags.fromJSON({ renderMode });

        // If color is not explicitly overridden in solid fill mode, the shader will compute a contrasting shade of grey for each element.
        expect(es.wantContrastingColor(renderMode)).toEqual(RenderMode.SolidFill === renderMode);

        expect(es.computeOvrFlags(pass, vf)).toEqual(OvrFlags.Alpha | OvrFlags.LineAlpha);
      }
  });

  it("clamps and inverts transparency threshold", () => {
    const inputsOutputs = [
      [ 0, 1 ], [ 1, 0 ], [ 0.75, 0.25 ], [ -1, 1 ], [ 2, 0 ],
    ];

    for (const inputOutput of inputsOutputs) {
      const es = EdgeSettings.create(HiddenLine.Settings.fromJSON({ transThreshold: inputOutput[0] }));
      expect(es.transparencyThreshold).toEqual(inputOutput[1]);
    }
  });

  it("uses expected defaults for hidden edges if hidden edges unspecified", () => {
    // Defaults for hidden edges: same width as visible edges; LinePixels.HiddenLine
    const hiddenPattern = LineCode.valueFromLinePixels(LinePixels.HiddenLine);
    const vf = ViewFlags.fromJSON({ renderMode: RenderMode.HiddenLine, hidEdges: true });

    const es = EdgeSettings.create(HiddenLine.Settings.fromJSON({ visible: { width: 3, pattern: LinePixels.Code4 } }));
    expect(es.getWeight(RenderPass.HiddenEdge, vf)).toEqual(es.getWeight(RenderPass.OpaqueLinear, vf));
    expect(es.getLineCode(RenderPass.HiddenEdge, vf)).toEqual(hiddenPattern);

    es.init(HiddenLine.Settings.fromJSON({ visible: { width: 4, pattern: LinePixels.Code3 }, hidden: { } }));
    expect(es.getWeight(RenderPass.HiddenEdge, vf)).toEqual(es.getWeight(RenderPass.OpaqueLinear, vf));
    expect(es.getLineCode(RenderPass.HiddenEdge, vf)).toEqual(hiddenPattern);
  });

  it("does not permit hidden edges to be wider than visible edges", () => {
    const es = EdgeSettings.create(HiddenLine.Settings.fromJSON({
      visible: { width: 2 },
      hidden: { width: 5 },
    }));

    expect(es.getWeight(RenderPass.HiddenEdge, ViewFlags.fromJSON({ renderMode: RenderMode.SolidFill }))).toEqual(2);
  });
});
