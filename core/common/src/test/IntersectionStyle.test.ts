/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { ClipIntersectionStyle, ClipIntersectionStyleProps, ClipStyle } from "../ClipStyle";
import { DisplayStyleSettings, DisplayStyleSettingsProps } from "../DisplayStyleSettings";

describe("IntersectionStyle", () => {
  it("should round-trip through JSON", () => {
    const roundTrip = (props: ClipIntersectionStyleProps | undefined, expected: ClipIntersectionStyleProps | undefined | "input") => {
      if ("input" === expected)
        expected = props;

      const style = ClipIntersectionStyle.fromJSON(props);
      const actual = style.toJSON();
      expect(actual).to.deep.equal(expected);
      expect(style.matchesDefaults).to.equal(undefined === actual);
      expect(style === ClipIntersectionStyle.defaults).to.equal(style.matchesDefaults);
    };

    roundTrip(undefined, undefined);
    roundTrip(ClipIntersectionStyle.create().toJSON(), undefined);

    roundTrip({ color:{ r: 0, g: 100, b: 200 }, width: 3 }, "input");
  });

  it("should trigger changed events", () => {
    const props: DisplayStyleSettingsProps = {};
    const details = new DisplayStyleSettings({ styles: props });
    let eventHeard = false;

    details.onClipStyleChanged.addListener(() => {
      eventHeard = true;
    });

    details.clipStyle = ClipStyle.fromJSON({ colorizeIntersection: true, intersectionStyle: { color:{ r: 0, g: 100, b: 200 }, width: 3 }});
    expect(eventHeard).to.be.true;
  });
});
