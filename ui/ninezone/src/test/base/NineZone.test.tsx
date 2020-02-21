/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as sinon from "sinon";
import produce from "immer";
import { render } from "@testing-library/react";
import { NineZoneProvider } from "../../ui-ninezone";
import {
  createNineZoneState, isHorizontalPanelState, createHorizontalPanelState, createVerticalPanelState,
  NineZoneStateReducer, TOGGLE_PANEL_COLLAPSED, TOGGLE_PANEL_SPAN, TOGGLE_PANEL_PINNED, RESIZE_PANEL, INITIALIZE_PANEL, WIDGET_TAB_CLICK, addPanelWidget, addTab, WIDGET_TAB_DOUBLE_CLICK,
} from "../../ui-ninezone/base/NineZone";

describe("<NineZoneProvider />", () => {
  it("renders correctly", () => {
    const nineZone = createNineZoneState();
    const { container } = render(<NineZoneProvider
      state={nineZone}
      dispatch={sinon.spy()}
    >
      9-Zone
    </NineZoneProvider>);
    container.firstChild!.should.matchSnapshot();
  });
});

describe("isHorizontalPanelState", () => {
  it("returns true based on side property", () => {
    isHorizontalPanelState(createHorizontalPanelState("top")).should.true;
  });

  it("returns false based on side property", () => {
    isHorizontalPanelState(createVerticalPanelState("left")).should.false;
  });
});

describe("NineZoneStateReducer", () => {
  describe("TOGGLE_PANEL_COLLAPSED", () => {
    it("should toggle collapsed property of panel", () => {
      const state = createNineZoneState();
      const newState = NineZoneStateReducer(state, {
        type: TOGGLE_PANEL_COLLAPSED,
        side: "left",
      });
      newState.panels.left.collapsed.should.not.eq(state.panels.left.collapsed);
    });
  });

  describe("TOGGLE_PANEL_SPAN", () => {
    it("should toggle span property of panel", () => {
      const state = createNineZoneState();
      const newState = NineZoneStateReducer(state, {
        type: TOGGLE_PANEL_SPAN,
        side: "top",
      });
      newState.panels.top.span.should.not.eq(state.panels.top.span);
    });
  });

  describe("TOGGLE_PANEL_PINNED", () => {
    it("should toggle pinned property of panel", () => {
      const state = createNineZoneState();
      const newState = NineZoneStateReducer(state, {
        type: TOGGLE_PANEL_PINNED,
        side: "top",
      });
      newState.panels.top.pinned.should.not.eq(state.panels.top.pinned);
    });
  });

  describe("RESIZE_PANEL", () => {
    it("should not resize if panel size is not set", () => {
      const state = createNineZoneState();
      const newState = NineZoneStateReducer(state, {
        type: RESIZE_PANEL,
        side: "left",
        resizeBy: 50,
      });
      newState.should.eq(state);
    });

    it("should expand collapsed panel", () => {
      let state = createNineZoneState();
      state = produce(state, (stateDraft) => {
        stateDraft.panels.left.size = 300;
        stateDraft.panels.left.collapsed = true;
      });
      const newState = NineZoneStateReducer(state, {
        type: RESIZE_PANEL,
        side: "left",
        resizeBy: 150,
      });
      newState.panels.left.collapsed.should.false;
    });

    it("should not expand if collapseOffset is not reached", () => {
      let state = createNineZoneState();
      state = produce(state, (stateDraft) => {
        stateDraft.panels.left.size = 300;
        stateDraft.panels.left.collapsed = true;
      });
      const newState = NineZoneStateReducer(state, {
        type: RESIZE_PANEL,
        side: "left",
        resizeBy: 50,
      });
      newState.should.eq(state);
    });

    it("should collapse", () => {
      let state = createNineZoneState();
      state = produce(state, (stateDraft) => {
        stateDraft.panels.left.size = 200;
      });
      const newState = NineZoneStateReducer(state, {
        type: RESIZE_PANEL,
        side: "left",
        resizeBy: -100,
      });
      newState.panels.left.collapsed.should.true;
    });

    it("should resize", () => {
      let state = createNineZoneState();
      state = produce(state, (stateDraft) => {
        stateDraft.panels.left.size = 200;
      });
      const newState = NineZoneStateReducer(state, {
        type: RESIZE_PANEL,
        side: "left",
        resizeBy: 50,
      });
      newState.panels.left.size!.should.eq(250);
    });
  });

  describe("INITIALIZE_PANEL", () => {
    it("should initialize", () => {
      const state = createNineZoneState();
      const newState = NineZoneStateReducer(state, {
        type: INITIALIZE_PANEL,
        side: "left",
        size: 300,
      });
      newState.panels.left.size!.should.eq(300);
    });
  });

  describe("WIDGET_TAB_CLICK", () => {
    it("should activate tab", () => {
      let state = createNineZoneState();
      state = addPanelWidget(state, "left", "w1");
      state = addTab(state, "w1", "t1");
      const newState = NineZoneStateReducer(state, {
        type: WIDGET_TAB_CLICK,
        side: "left",
        widgetId: "w1",
        id: "t1",
      });
      newState.widgets.w1.activeTabId!.should.eq("t1");
    });

    it("should restore minimized widget", () => {
      let state = createNineZoneState();
      state = addPanelWidget(state, "left", "w1", { minimized: true });
      state = addTab(state, "w1", "t1");
      const newState = NineZoneStateReducer(state, {
        type: WIDGET_TAB_CLICK,
        side: "left",
        widgetId: "w1",
        id: "t1",
      });
      newState.widgets.w1.minimized.should.false;
    });

    it("should expand (minimize other widgets)", () => {
      let state = createNineZoneState();
      state = addPanelWidget(state, "left", "w1", { activeTabId: "t1" });
      state = addPanelWidget(state, "left", "w2");
      state = addPanelWidget(state, "left", "w3");
      state = addTab(state, "w1", "t1");
      state = addTab(state, "w2", "t2");
      state = addTab(state, "w3", "t3");
      const newState = NineZoneStateReducer(state, {
        type: WIDGET_TAB_CLICK,
        side: "left",
        widgetId: "w1",
        id: "t1",
      });
      newState.widgets.w1.minimized.should.false;
      newState.widgets.w2.minimized.should.true;
      newState.widgets.w3.minimized.should.true;
    });
  });

  describe("WIDGET_TAB_DOUBLE_CLICK", () => {
    it("should expand minimized widget", () => {
      let state = createNineZoneState();
      state = addPanelWidget(state, "left", "w1", { minimized: true });
      state = addPanelWidget(state, "left", "w2");
      state = addPanelWidget(state, "left", "w3");
      state = addTab(state, "w1", "t1");
      state = addTab(state, "w1", "t2");
      state = addTab(state, "w1", "t3");
      const newState = NineZoneStateReducer(state, {
        type: WIDGET_TAB_DOUBLE_CLICK,
        side: "left",
        widgetId: "w1",
        id: "t1",
      });
      newState.widgets.w1.minimized.should.false;
      newState.widgets.w2.minimized.should.true;
      newState.widgets.w3.minimized.should.true;
    });

    it("should activate inactive tab if widget is not minimized", () => {
      let state = createNineZoneState();
      state = addPanelWidget(state, "left", "w1");
      state = addPanelWidget(state, "left", "w2");
      state = addPanelWidget(state, "left", "w3");
      state = addTab(state, "w1", "t1");
      state = addTab(state, "w1", "t2");
      state = addTab(state, "w1", "t3");
      const newState = NineZoneStateReducer(state, {
        type: WIDGET_TAB_DOUBLE_CLICK,
        side: "left",
        widgetId: "w1",
        id: "t1",
      });
      newState.widgets.w1.activeTabId!.should.eq("t1");
    });

    it("should minimize", () => {
      let state = createNineZoneState();
      state = addPanelWidget(state, "left", "w1", { activeTabId: "t1" });
      state = addPanelWidget(state, "left", "w2");
      state = addPanelWidget(state, "left", "w3");
      state = addTab(state, "w1", "t1");
      state = addTab(state, "w1", "t2");
      state = addTab(state, "w1", "t3");
      const newState = NineZoneStateReducer(state, {
        type: WIDGET_TAB_DOUBLE_CLICK,
        side: "left",
        widgetId: "w1",
        id: "t1",
      });
      newState.widgets.w1.minimized.should.true;
    });

    it("should not minimize last non-minimized widget", () => {
      let state = createNineZoneState();
      state = addPanelWidget(state, "left", "w1", { activeTabId: "t1" });
      state = addPanelWidget(state, "left", "w2", { minimized: true });
      state = addPanelWidget(state, "left", "w3", { minimized: true });
      state = addTab(state, "w1", "t1");
      state = addTab(state, "w1", "t2");
      state = addTab(state, "w1", "t3");
      const newState = NineZoneStateReducer(state, {
        type: WIDGET_TAB_DOUBLE_CLICK,
        side: "left",
        widgetId: "w1",
        id: "t1",
      });
      newState.should.eq(state);
    });
  });
});
