/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import type { CutStyleProps } from "../ClipStyle";
import { CutStyle } from "../ClipStyle";
import { HiddenLine } from "../HiddenLine";
import { FeatureAppearance } from "../FeatureSymbology";

describe("CutStyle", () => {
  it("should round-trip through JSON", () => {
    const roundTrip = (props: CutStyleProps | undefined, expected: CutStyleProps | undefined | "input") => {
      if ("input" === expected)
        expected = props;

      const style = CutStyle.fromJSON(props);
      const actual = style.toJSON();
      expect(actual).to.deep.equal(expected);
      expect(style.matchesDefaults).to.equal(undefined === actual);
      expect(style === CutStyle.defaults).to.equal(style.matchesDefaults);
    };

    roundTrip(undefined, undefined);
    roundTrip({}, undefined);
    roundTrip({ viewflags: undefined, hiddenLine: undefined, appearance: undefined }, undefined);
    roundTrip(CutStyle.create().toJSON(), undefined);
    roundTrip(CutStyle.create({ }, HiddenLine.Settings.defaults, FeatureAppearance.defaults).toJSON(), undefined);

    const hiddenLine = {
      ...HiddenLine.Settings.defaults.toJSON(),
      transThreshold: 0.5,
    };

    roundTrip({ viewflags: { transparency: false } }, "input");
    roundTrip({ hiddenLine }, "input");
    roundTrip({ appearance: { weight: 5 } }, "input");
    roundTrip({ viewflags: { transparency: false }, hiddenLine, appearance: { transparency: 0.25 } }, "input");
  });
});
