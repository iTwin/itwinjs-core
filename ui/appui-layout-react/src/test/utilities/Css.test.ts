/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { Css } from "../../appui-layout-react";

describe("Css", () => {
  it("should convert number to css string", () => {
    Css.toPx(10).should.eq("10px");
  });
});
