/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { ClipAppearance, ClipAppearanceProps } from "../ClipStyle";
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

