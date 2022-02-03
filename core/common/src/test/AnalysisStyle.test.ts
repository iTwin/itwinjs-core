/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { ThematicGradientSettings } from "../ThematicDisplay";
import type { AnalysisStyleProps, LegacyAnalysisStyleProps } from "../AnalysisStyle";
import { AnalysisStyle } from "../AnalysisStyle";

describe("AnalysisStyle", () => {
  it("round-trips through JSON", () => {
    function roundTrip(props: AnalysisStyleProps | undefined, expected: AnalysisStyleProps | "input"): void {
      if ("input" === expected)
        expected = props ?? { };

      const style = AnalysisStyle.fromJSON(props);
      const actual = style.toJSON();
      expect(actual).to.deep.equal(expected);
      expect(style.equals(AnalysisStyle.fromJSON(actual))).to.be.true;
      if (style.equals(AnalysisStyle.defaults))
        expect(expected).to.deep.equal({});
      else
        expect(expected).not.to.deep.equal({});
    }

    roundTrip({ }, "input");
    roundTrip(undefined, { });

    roundTrip({ normalChannelName: "normals" }, "input");
    roundTrip({ normalChannelName: "" }, "input");

    roundTrip({ displacement: { channelName: "disp" } }, "input");
    roundTrip({ displacement: { channelName: "disp", scale: 4.2 } }, "input");
    roundTrip({ displacement: { channelName: "disp", scale: 1 } }, { displacement: { channelName: "disp" } });

    roundTrip({ scalar: { channelName: "scalars", range: [-2, 4] } }, "input");
    roundTrip({ scalar: { channelName: "scalars", range: [1, 2], thematicSettings: { stepCount: 42, colorMix: 0.5 } } }, "input");
    roundTrip(
      { scalar: { channelName: "scalars", range: [0, 1], thematicSettings: ThematicGradientSettings.defaults.toJSON() } },
      { scalar: { channelName: "scalars", range: [0, 1] } }
    );
  });

  it("clones", () => {
    const props = {
      normalChannelName: "normals",
      displacement: { channelName: "displacements", scale: 42 },
      scalar: { channelName: "scalars", range: [-1, 1], thematicSettings: { stepCount: 42, colorMix: 0.5 } },
    };

    const src = AnalysisStyle.fromJSON(props);

    function expectClone(changed: AnalysisStyleProps, expected: AnalysisStyleProps): void {
      expect(src.clone(changed).toJSON()).to.deep.equal(expected);
    }

    expectClone({ }, props);
    expectClone({ normalChannelName: undefined }, { displacement: props.displacement, scalar: props.scalar });
    expectClone({ displacement: undefined, normalChannelName: undefined, scalar: undefined }, { });
    expectClone({ normalChannelName: "abnormals" }, { normalChannelName: "abnormals", displacement: props.displacement, scalar: props.scalar });
    expectClone({ displacement: { channelName: "disp" } }, { displacement: { channelName: "disp" }, normalChannelName: "normals", scalar: props.scalar });
    expectClone({ displacement: { channelName: "disp", scale: -2 } }, { displacement: { channelName: "disp", scale: -2 }, normalChannelName: "normals", scalar: props.scalar });
    expectClone(
      { scalar: { channelName: "s", range: [-5, 15] } },
      { scalar: { channelName: "s", range: [-5, 15] }, displacement: props.displacement, normalChannelName: "normals" }
    );
    expectClone(
      { scalar: { channelName: "s", range: [-5, 15], thematicSettings: ThematicGradientSettings.defaults.toJSON() } },
      { scalar: { channelName: "s", range: [-5, 15] }, displacement: props.displacement, normalChannelName: "normals" }
    );
    expectClone(
      { scalar: { channelName: "s", range: [-5, 15], thematicSettings: { stepCount: 1234 } } },
      { scalar: { channelName: "s", range: [-5, 15], thematicSettings: { stepCount: 1234 } }, displacement: props.displacement, normalChannelName: "normals" }
    );
  });

  it("accepts legacy JSON representation", () => {
    function roundTrip(props: LegacyAnalysisStyleProps, expected: AnalysisStyleProps): void {
      const style = AnalysisStyle.fromJSON(props as AnalysisStyleProps);
      const actual = style.toJSON();
      expect(actual).to.deep.equal(expected);
    }

    roundTrip({ }, { });
    roundTrip({ normalChannelName: "normals" }, { normalChannelName: "normals" });
    roundTrip(
      { displacementChannelName: "disp" },
      { displacement: { channelName: "disp" } }
    );
    roundTrip({ displacementScale: 42 }, { });
    roundTrip(
      { displacementChannelName: "disp", displacementScale: 42 },
      { displacement: { channelName: "disp", scale: 42 } }
    );
    roundTrip(
      { scalarChannelName: "scalar", scalarRange: [1, 2] },
      { scalar: { channelName: "scalar", range: [1, 2] } }
    );
    roundTrip(
      { scalarChannelName: "scalar", scalarRange: [1, 2], scalarThematicSettings: { stepCount: 6 } },
      { scalar: { channelName: "scalar", range: [1, 2], thematicSettings: { stepCount: 6 } } }
    );
    roundTrip({ scalarChannelName: "scalar" }, { });
    roundTrip({ scalarRange: [0, 1] }, { });
    roundTrip({ scalarThematicSettings: { stepCount: 6 } }, { });
  });
});
