/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import {
  ClipStyle,
  ClipStyleProps,
  CutStyle,
} from "../ClipStyle";
import { DisplayStyleSettings, DisplayStyleSettingsProps } from "../DisplayStyleSettings";

describe("ClipStyle", () => {
  it("should round-trip through JSON", () => {
    const roundTrip = (props: ClipStyleProps | undefined, expected: ClipStyleProps | undefined | "input") => {
      if ("input" === expected)
        expected = props;

      const style = ClipStyle.fromJSON(props);
      const actual = style.toJSON();
      expect(actual).to.deep.equal(expected);
      expect(style.matchesDefaults).to.equal(undefined === actual);
      expect(style === ClipStyle.defaults).to.equal(style.matchesDefaults);
    };

    roundTrip(undefined, undefined);
    roundTrip({}, undefined);
    roundTrip({ produceCutGeometry: false }, undefined);
    roundTrip({ cutStyle: undefined, produceCutGeometry: false }, undefined);
    roundTrip(ClipStyle.create(false, CutStyle.defaults).toJSON(), undefined);
    roundTrip({
      cutStyle: CutStyle.defaults.toJSON(),
      produceCutGeometry: false,
    }, undefined);

    roundTrip({ produceCutGeometry: true }, "input");
    roundTrip({ cutStyle: { appearance: { weight: 5 } } }, "input");
    roundTrip({ produceCutGeometry: true, cutStyle: { appearance: { weight: 5 } } }, "input");
  });

  it("should serialize to DisplayStyleSettings", () => {
    const props: DisplayStyleSettingsProps = {};
    const details = new DisplayStyleSettings({ styles: props });
    expect(details.clipStyle.matchesDefaults).to.be.true;
    expect(props.hasOwnProperty("clipStyle")).to.be.false;

    details.clipStyle = ClipStyle.fromJSON({ produceCutGeometry: false });
    expect(details.clipStyle.matchesDefaults).to.be.true;
    expect(props.hasOwnProperty("clipStyle")).to.be.false;

    const styleProps = { produceCutGeometry: true, cutStyle: { appearance: { transparency: 0.5 } } };
    details.clipStyle = ClipStyle.fromJSON(styleProps);
    expect(details.clipStyle.matchesDefaults).to.be.false;
    expect(props.hasOwnProperty("clipStyle")).to.be.true;
    expect(props.clipStyle).to.deep.equal(styleProps);
  });
});
