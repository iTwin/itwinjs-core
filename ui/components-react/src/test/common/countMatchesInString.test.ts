/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { expect } from "chai";
import { countMatchesInString } from "../../components-react/common/countMatchesInString";

describe("countMatchesInString", () => {

  it("returns 1 when there's one match", () => {
    expect(countMatchesInString("abc", "b")).to.eq(1);
  });

  it("returns 2 when there're two consecutive matches", () => {
    expect(countMatchesInString("abbc", "b")).to.eq(2);
  });

  it("returns 2 when there're two non-consecutive matches", () => {
    expect(countMatchesInString("abcbd", "b")).to.eq(2);
  });

  it("returns 0 when `str` is empty", () => {
    expect(countMatchesInString("", "b")).to.eq(0);
  });

  it("returns 0 when `lookup` is empty", () => {
    expect(countMatchesInString("abc", "")).to.eq(0);
  });

});
