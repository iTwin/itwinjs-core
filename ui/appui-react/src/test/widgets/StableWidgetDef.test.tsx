/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { createStableWidgetDef } from "../../appui-react";
import { WidgetDef } from "../../appui-react/widgets/WidgetDef";

describe("createStableWidgetDef", () => {
  it("should return stableId", () => {
    const sut = createStableWidgetDef(new WidgetDef({}), "w1"); // eslint-disable-line deprecation/deprecation
    sut.id.should.eq("w1");
  });
});
