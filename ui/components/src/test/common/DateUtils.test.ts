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
});
