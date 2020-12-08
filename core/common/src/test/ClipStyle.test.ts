/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import {
  ClipAppearance,
  ClipAppearanceProps,
  ClipStyle,
  ClipStyleProps,
} from "../ClipStyle";
import { DisplayStyleSettings, DisplayStyleSettingsProps } from "../DisplayStyleSettings";
import { LinePixels } from "../LinePixels";
import { RgbColorProps } from "../RgbColor";

describe("ClipAppearance", () => {
  it("should round-trip through JSON", () => {
    const roundTrip = (props: ClipAppearanceProps | undefined, expected: ClipAppearanceProps | undefined | "input") => {
      if ("input" === expected)
        expected = props;

      const app = ClipAppearance.fromJSON(props);
      const actual = app.toJSON();
      expect(actual).to.deep.equal(expected);
    };

    roundTrip(undefined, undefined);
    roundTrip({}, undefined);
    roundTrip({ color: undefined, linePixels: undefined, nonLocatable: undefined }, undefined);

    roundTrip({ color: { r: 0xff, g: 0, b: 0x7f }, linePixels: LinePixels.HiddenLine, nonLocatable: true }, "input");
    roundTrip({ linePixels: LinePixels.HiddenLine }, "input");
    roundTrip({ nonLocatable: true }, "input");
    roundTrip({ color: { r: 0xff, g: 0, b: 0x7f } }, "input");
  });

  it("should compare", () => {
    const appearances = [
      ClipAppearance.create(),
      ClipAppearance.fromJSON({ color: { r: 0xff, g: 0, b: 0x7f } }),
      ClipAppearance.fromJSON({ color: { r: 0, g: 0x7f, b: 0xff } }),
      ClipAppearance.create(undefined, LinePixels.HiddenLine),
      ClipAppearance.create(undefined, LinePixels.Solid),
      ClipAppearance.create(undefined, undefined, true),
      ClipAppearance.fromJSON({ color: { r: 0, g: 0xff, b: 0 }, linePixels: LinePixels.Solid, nonLocatable: true }),
    ];

    for (let i = 0; i < appearances.length; i++)
      for (let j = 0; j < appearances.length; j++)
        expect(appearances[i].equals(appearances[j])).to.equal(i === j);
  });

  it("should use defaults where appropriate", () => {
    const isDefault = (app: ClipAppearance) => {
      expect(app.matchesDefaults).to.be.true;
      return app === ClipAppearance.defaults;
    };

    expect(isDefault(ClipAppearance.create())).to.be.true;
    expect(isDefault(ClipAppearance.create(undefined, undefined, false))).to.be.true;

    expect(isDefault(ClipAppearance.fromJSON())).to.be.true;
    expect(isDefault(ClipAppearance.fromJSON({}))).to.be.true;
    expect(isDefault(ClipAppearance.fromJSON({ color: undefined, linePixels: undefined, nonLocatable: undefined }))).to.be.true;
    expect(isDefault(ClipAppearance.fromJSON({ dummy: "ignored" } as unknown as ClipAppearanceProps))).to.be.true;
  });
});

/*
describe("ClipStyle", () => {
  it("should round-trip through JSON", () => {
    const roundTrip = (props: ClipStyleProps | undefined, expected: ClipStyleProps) => {
      const style = ClipStyle.fromJSON(props);
      const actual = style.toJSON();
      expect(actual).to.deep.equal(expected);
    };

    roundTrip(undefined, {});
    roundTrip({}, {});
    roundTrip({ produceCutGeometry: false }, {});
    roundTrip({ produceCutGeometry: true }, { produceCutGeometry: true });
  });

  it("should compare", () => {
    const compare = (a: ClipStyle, b: ClipStyle, expectEqual: boolean) => {
      expect(a === b).to.equal(expectEqual);
      expect(a.equals(b)).to.equal(expectEqual);
      expect(b.equals(a)).to.equal(expectEqual);
    };

    const def1 = ClipStyle.fromJSON();
    const def2 = ClipStyle.fromJSON({ produceCutGeometry: false });
    const cut1 = ClipStyle.fromJSON({ produceCutGeometry: true });
    const cut2 = ClipStyle.fromJSON({ produceCutGeometry: true });

    compare(def1, def2, true);
    compare(cut1, cut2, true);
    compare(def1, cut1, false);
    compare(def2, cut2, false);
  });

  it("compares to defaults", () => {
    expect(ClipStyle.fromJSON().matchesDefaults).to.be.true;
    expect(ClipStyle.fromJSON({ produceCutGeometry: true }).matchesDefaults).to.be.false;
  });

  it("should serialize to DisplayStyleSettings", () => {
    const props: DisplayStyleSettingsProps = {};
    const details = new DisplayStyleSettings({ styles: props });
    expect(details.clipStyle.matchesDefaults).to.be.true;
    expect(props.hasOwnProperty("clipStyle")).to.be.false;

    details.clipStyle = ClipStyle.fromJSON({ produceCutGeometry: false });
    expect(details.clipStyle.matchesDefaults).to.be.true;
    expect(props.hasOwnProperty("clipStyle")).to.be.false;

    details.clipStyle = ClipStyle.fromJSON({ produceCutGeometry: true });
    expect(details.clipStyle.matchesDefaults).to.be.false;
    expect(props.hasOwnProperty("clipStyle")).to.be.true;
    expect(props.clipStyle).to.deep.equal({ produceCutGeometry: true });
  });
});
*/
