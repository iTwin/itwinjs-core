/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { should } from "chai";
import {
  addFloatingWidget, addPanelWidget, addPopoutWidget, createNineZoneState, getTabLocation, removeTabFromWidget,
} from "../../appui-layout-react";
import { addWidgetState } from "../../appui-layout-react/state/internal/WidgetStateHelpers";
import { addTabs } from "../Utils";

describe("getTabLocation", () => {
  it("should return floating tab location", () => {
    let state = createNineZoneState();
    state = addTabs(state, ["t1"]);
    state = addFloatingWidget(state, "w1", ["t1"]);
    const location = getTabLocation(state, "t1");
    location!.should.eql({
      widgetId: "w1",
      floatingWidgetId: "w1",
    });
  });

  it("should return floating tab location", () => {
    let state = createNineZoneState();
    state = addTabs(state, ["t1"]);
    state = addPanelWidget(state, "right", "w1", ["t1"]);
    const location = getTabLocation(state, "t1");
    location!.should.eql({
      widgetId: "w1",
      side: "right",
    });
  });

  it("should return popout tab location", () => {
    let state = createNineZoneState();
    state = addTabs(state, ["t1"]);
    state = addPopoutWidget(state, "w1", ["t1"]);
    const location = getTabLocation(state, "t1");
    location!.should.eql({
      widgetId: "w1",
      popoutWidgetId: "w1",
    });
  });

  it("should return FloatingTabLocation", () => {
    let state = createNineZoneState();
    state = addTabs(state, ["t1"]);
    state = addFloatingWidget(state, "w1", ["t1"]);
    const location = getTabLocation(state, "t1");
    location!.should.eql({
      widgetId: "w1",
      floatingWidgetId: "w1",
    });
  });

  it("should return 'undefined' if tab is not in a widget", () => {
    let state = createNineZoneState();
    state = addTabs(state, ["t1"]);
    state = addFloatingWidget(state, "w1", ["t1"]);
    state = removeTabFromWidget(state, "t1");
    const location = getTabLocation(state, "t1");
    should().equal(location, undefined);
  });

  it("should return 'undefined' if tab does not exist", () => {
    let state = createNineZoneState();
    state = addTabs(state, ["t1"]);
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    const location = getTabLocation(state, "t2");
    should().equal(location, undefined);
  });

  it("should return 'undefined' if widget is not displayed (not in a panel/popout or floating)", () => {
    let state = createNineZoneState();
    state = addTabs(state, ["t1", "t2"]);
    state = addWidgetState(state, "w1", ["t1"]);
    const location = getTabLocation(state, "t1");
    should().equal(location, undefined);
  });
});
