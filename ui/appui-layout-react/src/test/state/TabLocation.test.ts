/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { should } from "chai";
import {
  addFloatingWidget, addPanelWidget, addTab, createNineZoneState, findTab, removeTabFromWidget,
} from "../../appui-layout-react";

describe("findTab", () => {
  it("should return undefined if widget is not found", () => {
    let state = createNineZoneState();
    state = addTab(state, "t1");
    state = addFloatingWidget(state, "w1", ["t1"]);
    state = removeTabFromWidget(state, "t1");
    const tab = findTab(state, "t1");
    should().not.exist(tab);
  });

  it("should return undefined if tab is not found", () => {
    let state = createNineZoneState();
    state = addTab(state, "t1");
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    const tab = findTab(state, "t2");
    should().not.exist(tab);
  });
});
