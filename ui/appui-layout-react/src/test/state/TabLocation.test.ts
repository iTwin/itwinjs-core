/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { should } from "chai";
import {
  addFloatingWidget, addPanelWidget, createNineZoneState, getTabLocation, removeTabFromWidget,
} from "../../appui-layout-react";
import { addWidgetState } from "../../appui-layout-react/state/internal/WidgetStateHelpers";
import { addTabs } from "../Utils";

describe("getTabLocation", () => {
  it("should return 'undefined' if widget is not found", () => {
    let state = createNineZoneState();
    state = addTabs(state, ["t1"]);
    state = addFloatingWidget(state, "w1", ["t1"]);
    state = removeTabFromWidget(state, "t1");
    const tab = getTabLocation(state, "t1");
    should().not.exist(tab);
  });

  it("should return 'undefined' if tab is not found", () => {
    let state = createNineZoneState();
    state = addTabs(state, ["t1"]);
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    const tab = getTabLocation(state, "t2");
    should().not.exist(tab);
  });

  it("should return 'undefined' if widget is not found", () => {
    let state = createNineZoneState();
    state = addTabs(state, ["t1", "t2"]);
    state = addWidgetState(state, "w1", ["t1"]);
    const tab = getTabLocation(state, "t1");
    should().not.exist(tab);
  });
});
