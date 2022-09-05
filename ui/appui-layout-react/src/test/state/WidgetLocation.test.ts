/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { should } from "chai";
import { createNineZoneState, getWidgetLocation } from "../../appui-layout-react";

describe("getWidgetLocation", () => {
  it("should return `undefined` if widget is not found", () => {
    const state = createNineZoneState();
    const location = getWidgetLocation(state, "w1");
    should().not.exist(location);
  });
});
