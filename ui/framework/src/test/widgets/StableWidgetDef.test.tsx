/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { createStableWidgetDef } from "../../ui-framework.js";
import { WidgetDef } from "../../ui-framework/widgets/WidgetDef.js";

describe("createStableWidgetDef", () => {
  it("should return stableId", () => {
    const sut = createStableWidgetDef(new WidgetDef({}), "w1");
    sut.id.should.eq("w1");
  });
});
