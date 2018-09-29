/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import Css from "../../src/utilities/Css";

describe("Css", () => {
  it("should convert number to css string", () => {
    Css.toPx(10).should.eq("10px");
  });
});
