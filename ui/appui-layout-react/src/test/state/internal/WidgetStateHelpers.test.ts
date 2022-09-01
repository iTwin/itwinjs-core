/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { addPanelWidget, createNineZoneState } from "../../../appui-layout-react";
import { addWidgetState, createWidgetState, removeFloatingWidget, removePanelWidget, removePopoutWidget, removeWidget, removeWidgetState, setWidgetActiveTabId, updateFloatingWidgetState, updateWidgetState } from "../../../appui-layout-react/state/internal/WidgetStateHelpers";
import { addTabs, handleMetaData } from "../../Utils";

describe("createWidgetState", () => {
  it("should throw w/o tabs", () => {
    (() => createWidgetState("w1", [])).should.throw();
  });
});

describe("updateWidgetState", () => {
  it("should throw if widget is not found", () => {
    const state = createNineZoneState();
    (() => updateWidgetState(state, "w1", { activeTabId: "t1" })).should.throw();
  });
});

describe("addWidgetState", () => {
  it("should throw if widget already exists", () => {
    let state = createNineZoneState();
    state = addTabs(state, ["t1", "t2"]);
    state = addWidgetState(state, "w1", ["t1"]);
    (() => addWidgetState(state, "w1", ["t2"])).should.throw("Widget already exists");
  });

  it("should throw if tab doesn't exist", () => {
    const state = createNineZoneState();
    handleMetaData(() => addWidgetState(state, "w1", ["t1"])).should.throw("Tab does not exist");
  });

  it("should throw if tab is already in another widget", () => {
    let state = createNineZoneState();
    state = addTabs(state, ["t1"]);
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    handleMetaData(() => addWidgetState(state, "w2", ["t1"])).should.throw("Tab is already in a widget");
  });
});

describe("removeWidget", () => {
  it("should throw if widget location is not found", () => {
    let state = createNineZoneState();
    state = addTabs(state, ["t1"]);
    state = addWidgetState(state, "w1", ["t1"]);
    (() => removeWidget(state, "w1")).should.throw("Widget not found");
  });
});

describe("removeWidgetState", () => {
  it("should throw if widget does not exist", () => {
    const state = createNineZoneState();
    (() => removeWidgetState(state, "w1")).should.throw("Widget does not exist");
  });
});

describe("updateFloatingWidgetState", () => {
  it("should throw if widget does not exist", () => {
    const state = createNineZoneState();
    (() => updateFloatingWidgetState(state, "fw1", { userSized: true })).should.throw("Floating widget does not exist");
  });
});

describe("removeFloatingWidget", () => {
  it("should throw if widget does not exist", () => {
    const state = createNineZoneState();
    (() => removeFloatingWidget(state, "w1")).should.throw("Floating widget does not exist");
  });
});

describe("removePopoutWidget", () => {
  it("should throw if widget does not exist", () => {
    const state = createNineZoneState();
    (() => removePopoutWidget(state, "w1")).should.throw("Popout widget does not exist");
  });
});

describe("removePanelWidget", () => {
  it("should throw if widget is not found", () => {
    const state = createNineZoneState();
    (() => removePanelWidget(state, "w1")).should.throw("Panel widget not found");
  });
});

describe("setWidgetActiveTabId", () => {
  it("should throw if tab is not in a widget", () => {
    let state = createNineZoneState();
    state = addTabs(state, ["t1", "t2"]);
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    (() => setWidgetActiveTabId(state, "w1", "t2")).should.throw("Tab is not in a widget");
  });
});
