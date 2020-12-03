/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { ClipStyle, ClipStyleProps } from "../ClipStyle";
import { DisplayStyleSettings, DisplayStyleSettingsProps } from "../DisplayStyleSettings";

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
