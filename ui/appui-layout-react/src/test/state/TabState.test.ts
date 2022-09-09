/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { should } from "chai";
import { addPanelWidget, addPopoutWidget, addTab, addTabToWidget, createNineZoneState, insertTabToWidget, removeTab, removeTabFromWidget } from "../../appui-layout-react";
import { addTabs, handleMetaData } from "../Utils";

describe("addTab", () => {
  it("should add a tab", () => {
    let state = createNineZoneState();
    state = addTab(state, "t1");
    state.tabs.t1.should.exist;
  });

  it("should throw if tab is already added", () => {
    let state = createNineZoneState();
    state = addTab(state, "t1");
    (() => addTab(state, "t1")).should.throw();
  });
});

describe("addTabToWidget", () => {
  it("should add the tab", () => {
    let state = createNineZoneState();
    state = addTabs(state, ["t1", "t2"]);
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    state = addTabToWidget(state, "t2", "w1");
    state.widgets.w1.tabs.should.eql(["t1", "t2"]);
  });
});

describe("insertTabToWidget", () => {
  it("should throw if tab does not exist", () => {
    let state = createNineZoneState();
    state = addTabs(state, ["t1"]);
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    handleMetaData(() => insertTabToWidget(state, "t2", "w1", 1)).should.throw("Tab does not exist");
  });

  it("should throw if widget does not exist", () => {
    let state = createNineZoneState();
    state = addTabs(state, ["t1"]);
    handleMetaData(() => insertTabToWidget(state, "t1", "w1", 1)).should.throw("Widget does not exist");
  });

  it("should throw if tab is already in one of the widgets", () => {
    let state = createNineZoneState();
    state = addTabs(state, ["t1", "t2"]);
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    state = addPanelWidget(state, "left", "w2", ["t2"]);
    handleMetaData(() => insertTabToWidget(state, "t1", "w2", 1)).should.throw("Tab is already in a widget");
  });
});

describe("removeTab", () => {
  it("should throw if tab does not exist", () => {
    const state = createNineZoneState();
    (() => removeTab(state, "t1")).should.throw("Tab does not exist");
  });

  it("should update widget activeTabId", () => {
    let state = createNineZoneState();
    state = addTabs(state, ["t1", "t2"]);
    state = addPanelWidget(state, "left", "w1", ["t1", "t2"]);
    const newState = removeTab(state, "t1");
    newState.widgets.w1.activeTabId.should.eq("t2");
  });

  it("should not update widget activeTabId", () => {
    let state = createNineZoneState();
    state = addTabs(state, ["t1", "t2"]);
    state = addPanelWidget(state, "left", "w1", ["t1", "t2"]);
    const newState = removeTab(state, "t2");
    newState.widgets.w1.activeTabId.should.eq("t1");
    newState.widgets.w1.tabs.should.eql(["t1"]);
  });

  it("should remove popout widget", () => {
    let state = createNineZoneState();
    state = addTabs(state, ["t1"]);
    state = addPopoutWidget(state, "pow1", ["t1"]);
    const newState = removeTab(state, "t1");

    should().not.exist(newState.popoutWidgets.byId.pow1);
    should().not.exist(newState.tabs.t1);
  });
});

describe("removeTabFromWidget", () => {
  it("should not remove if tab is not in the widget", () => {
    let state = createNineZoneState();
    state = addTabs(state, ["t1"]);
    const newState = removeTabFromWidget(state, "t1");
    should().exist(newState.tabs.t1);
    newState.should.eq(state);
  });
});
