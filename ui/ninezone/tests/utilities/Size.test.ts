/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import Size from "../../src/utilities/Size";

describe("Rectangle", () => {
  it("unspecified size should be 0", () => {
    const sut = new Size();
    sut.height.should.eq(0);
    sut.width.should.eq(0);
  });

  it("should specify size while constructing", () => {
    const sut = new Size(19, 94);
    sut.width.should.eq(19);
    sut.height.should.eq(94);
  });
});
