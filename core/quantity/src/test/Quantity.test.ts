/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { almostEqual } from "../Quantity";

describe("Quantity", () => {
  it("almost-equal", async () => {
    expect(almostEqual(1.0, 1.0)).to.be.true;
    expect(almostEqual(1.0, 1.1)).to.be.false;
    expect(almostEqual(1.0, 1.0000000000000002)).to.be.true;

    expect(almostEqual(1.0, 1.0000000001)).to.be.false;

    const tolerance = 0.0001;
    expect(almostEqual(1.0, 1.0001, tolerance)).to.be.true;
    expect(almostEqual(1.0, 1.0005, tolerance)).to.be.false;
    expect(almostEqual(10000.01, 10000.02, tolerance)).to.be.true;
  });
});
