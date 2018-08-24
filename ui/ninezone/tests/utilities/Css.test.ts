/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import Css from "../../src/utilities/Css";

describe("Css", () => {
  it("should convert number to css string", () => {
    Css.toPx(10).should.eq("10px");
  });
});
