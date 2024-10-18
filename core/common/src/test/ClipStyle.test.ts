/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { describe, expect, it } from "vitest";
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
    roundTrip(ClipStyle.create({produceCutGeometry: false, colorizeIntersection: false, cutStyle: CutStyle.defaults}).toJSON(), undefined);
    roundTrip({
      cutStyle: CutStyle.defaults.toJSON(),
      produceCutGeometry: false,
    }, undefined);

    roundTrip({ produceCutGeometry: true }, "input");
    roundTrip({ cutStyle: { appearance: { weight: 5 } } }, "input");
    roundTrip({ produceCutGeometry: true, cutStyle: { appearance: { weight: 5 } } }, "input");

    roundTrip({ insideColor: { r: 0, g: 127, b: 255 } }, "input");
    roundTrip({ outsideColor: { r: 255, g: 127, b: 0 } }, "input");
    roundTrip({ insideColor: { r: 1, g: 2, b: 3 }, outsideColor: { r: 254, g: 253, b: 252 } }, "input");
    roundTrip({ insideColor: undefined, outsideColor: undefined }, undefined);

    roundTrip({ colorizeIntersection: undefined, intersectionStyle: undefined }, undefined);
    roundTrip({ colorizeIntersection: true, intersectionStyle: { color:{ r: 255, g: 0, b: 0 }, width: 5 }}, "input");
  });

  it("should serialize to DisplayStyleSettings", () => {
    const props: DisplayStyleSettingsProps = {};
    const details = new DisplayStyleSettings({ styles: props });
    expect(details.clipStyle.matchesDefaults).to.be.true;
    expect(props.hasOwnProperty("clipStyle")).to.be.false;

    details.clipStyle = ClipStyle.fromJSON({ produceCutGeometry: false });
    expect(details.clipStyle.matchesDefaults).to.be.true;
    expect(props.hasOwnProperty("clipStyle")).to.be.false;

    const styleProps = {
      produceCutGeometry: true,
      insideColor: { r: 10, g: 20, b: 0 },
      outsideColor: { r: 100, g: 255, b: 1 },
      cutStyle: { appearance: { transparency: 0.5 } },
      colorizeIntersection: true,
      intersectionStyle: { color:{ r: 0, g: 100, b: 200 }, width: 3 },
    };
    details.clipStyle = ClipStyle.fromJSON(styleProps);
    expect(details.clipStyle.matchesDefaults).to.be.false;
    expect(props.hasOwnProperty("clipStyle")).to.be.true;
    expect(props.clipStyle).to.deep.equal(styleProps);
  });

  it("should trigger changed events", () => {
    const props: DisplayStyleSettingsProps = {};
    const details = new DisplayStyleSettings({ styles: props });
    let eventHeard = false;

    details.onClipStyleChanged.addListener(() => {
      eventHeard = true;
    });

    const styleProps = {
      produceCutGeometry: true,
      insideColor: { r: 10, g: 20, b: 0 },
      outsideColor: { r: 100, g: 255, b: 1 },
      cutStyle: { appearance: { transparency: 0.5 } },
      colorizeIntersection: true,
      intersectionStyle: { color:{ r: 0, g: 100, b: 200 }, width: 3 },
    };

    details.clipStyle = ClipStyle.fromJSON(styleProps);
    expect(eventHeard).to.be.true;
  });
});
