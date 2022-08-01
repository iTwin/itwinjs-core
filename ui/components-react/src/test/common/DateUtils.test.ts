/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { toDateString, toTimeString } from "../../components-react/common/DateUtils";

describe("DateUtils", () => {
  // Cannot test string values because of different locales
  it("toDateString", () => {
    expect(toDateString(new Date(2021, 1, 1))).to.not.be.undefined;
    expect(toDateString(new Date(2021, 1, 1), 12)).to.not.be.undefined;
  });
  it("toTimeString", () => {
    expect(toTimeString(new Date(2021, 1, 1))).to.not.be.undefined;
    expect(toTimeString(new Date(2021, 1, 1), 12)).to.not.be.undefined;
  });
  it("toDateString", () => {
    expect(toDateString(new Date("June 30, 2016, 00:00:00 GMT -0000"), 0,
      { locales: "en-US", options: { year: "numeric", month: "short", day: "numeric" } } )).to.equal("Jun 30, 2016");
  });
  it("toTimeString", () => {
    expect(toTimeString(new Date("June 30, 2016, 00:00:00 GMT -0000"), 0,
      { locales: "en-US", options: { hour: "2-digit", minute: "numeric", second: "numeric", hour12: true } } )).to.equal("12:00:00 AM");
  });

});
