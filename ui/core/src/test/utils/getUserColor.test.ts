/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { getUserColor } from "../../ui-core";

describe("getUserColor", () => {
  it("should return correct color 1", () => {
    const email = "test1@bentley.com";
    expect(getUserColor(email)).to.eq("#c8c2b4");
  });
  it("should return correct color blank", () => {
    const email = "";
    expect(getUserColor(email)).to.eq("#6ab9ec");
  });
});
