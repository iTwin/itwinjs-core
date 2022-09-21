/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { updateTabState } from "../../../appui-layout-react/state/internal/TabStateHelpers";
import { createNineZoneState } from "../../../appui-layout-react";

describe("updateTabState", () => {
  it("should throw if tab does not exist", () => {
    const state = createNineZoneState();
    (() => updateTabState(state, "t1", { iconSpec: "test" })).should.throw("Tab does not exist");
  });
});
