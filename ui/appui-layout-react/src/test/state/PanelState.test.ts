/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { createNineZoneState, insertPanelWidget, isHorizontalPanelState } from "../../appui-layout-react";
import { createHorizontalPanelState, createVerticalPanelState } from "../../appui-layout-react/state/internal/PanelStateHelpers";
import { addTabs, handleMetaData } from "../Utils";

describe("isHorizontalPanelState", () => {
  it("returns true based on side property", () => {
    isHorizontalPanelState(createHorizontalPanelState("top")).should.true;
  });

  it("returns false based on side property", () => {
    isHorizontalPanelState(createVerticalPanelState("left")).should.false;
  });
});

describe("insertPanelWidget", () => {
  it("should throw if `maxWidgetCount` is exceeded", () => {
    let state = createNineZoneState();
    state = addTabs(state, ["t1", "t2", "t3"]);
    state = insertPanelWidget(state, "left", "w1", ["t1"], 0);
    state = insertPanelWidget(state, "left", "w2", ["t2"], 1);
    handleMetaData(() => insertPanelWidget(state, "left", "w3", ["t3"], 2)).should.throw();
  });
});
