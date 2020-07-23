/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { should } from "chai";
import { castDraft, produce } from "immer";
import { Point, Rectangle } from "@bentley/ui-core";
import {
  addFloatingWidget, addPanelWidget, addTab, createHorizontalPanelState, createNineZoneState, createVerticalPanelState,
  isHorizontalPanelState, NineZoneStateReducer,
} from "../../ui-ninezone";
import { createDraggedTabState, createFloatingWidgetState, createTabState, createWidgetState, findTab, toolSettingsTabId } from "../../ui-ninezone/base/NineZoneState";

describe("isHorizontalPanelState", () => {
  it("returns true based on side property", () => {
    isHorizontalPanelState(createHorizontalPanelState("top")).should.true;
  });

  it("returns false based on side property", () => {
    isHorizontalPanelState(createVerticalPanelState("left")).should.false;
  });
});

describe("NineZoneStateReducer", () => {
  describe("RESIZE", () => {
    it("should toggle collapsed property of panel", () => {
      const state = createNineZoneState();
      const newState = NineZoneStateReducer(state, {
        type: "RESIZE",
        size: {
          height: 200,
          width: 300,
        },
      });
      newState.size.should.eql({ height: 200, width: 300 });
    });

    it("should contain floating widgets", () => {
      let state = createNineZoneState({
        size: {
          height: 200,
          width: 300,
        },
      });
      state = addFloatingWidget(state, "fw1", {
        bounds: {
          top: 0,
          bottom: 150,
          left: 100,
          right: 200,
        },
      });
      const newState = NineZoneStateReducer(state, {
        type: "RESIZE",
        size: {
          height: 200,
          width: 160,
        },
      });
      newState.floatingWidgets.byId.fw1.bounds.should.eql({
        top: 0,
        bottom: 150,
        left: 60,
        right: 160,
      });
    });
  });

  describe("PANEL_TOGGLE_COLLAPSED", () => {
    it("should toggle collapsed property of panel", () => {
      const state = createNineZoneState();
      const newState = NineZoneStateReducer(state, {
        type: "PANEL_TOGGLE_COLLAPSED",
        side: "left",
      });
      newState.panels.left.collapsed.should.not.eq(state.panels.left.collapsed);
    });
  });

  describe("PANEL_TOGGLE_SPAN", () => {
    it("should toggle span property of panel", () => {
      const state = createNineZoneState();
      const newState = NineZoneStateReducer(state, {
        type: "PANEL_TOGGLE_SPAN",
        side: "top",
      });
      newState.panels.top.span.should.not.eq(state.panels.top.span);
    });
  });

  describe("PANEL_TOGGLE_PINNED", () => {
    it("should toggle pinned property of panel", () => {
      const state = createNineZoneState();
      const newState = NineZoneStateReducer(state, {
        type: "PANEL_TOGGLE_PINNED",
        side: "top",
      });
      newState.panels.top.pinned.should.not.eq(state.panels.top.pinned);
    });
  });

  describe("PANEL_RESIZE", () => {
    it("should not resize if panel size is not set", () => {
      const state = createNineZoneState();
      const newState = NineZoneStateReducer(state, {
        type: "PANEL_RESIZE",
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
        type: "PANEL_RESIZE",
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
        type: "PANEL_RESIZE",
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
        type: "PANEL_RESIZE",
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
        type: "PANEL_RESIZE",
        side: "left",
        resizeBy: 50,
      });
      newState.panels.left.size!.should.eq(250);
    });
  });

  describe("PANEL_INITIALIZE", () => {
    it("should initialize", () => {
      const state = createNineZoneState();
      const newState = NineZoneStateReducer(state, {
        type: "PANEL_INITIALIZE",
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
        type: "WIDGET_TAB_CLICK",
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
        type: "WIDGET_TAB_CLICK",
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
        type: "WIDGET_TAB_CLICK",
        side: "left",
        widgetId: "w1",
        id: "t1",
      });
      newState.widgets.w1.minimized.should.false;
      newState.widgets.w2.minimized.should.true;
      newState.widgets.w3.minimized.should.true;
    });

    it("should not expand clicked tab is not active", () => {
      let state = createNineZoneState();
      state = addPanelWidget(state, "left", "w1", { activeTabId: "t1" });
      state = addPanelWidget(state, "left", "w2");
      state = addPanelWidget(state, "left", "w3");
      state = addTab(state, "w1", "t1");
      state = addTab(state, "w1", "t2");
      state = addTab(state, "w2", "t2");
      state = addTab(state, "w3", "t3");
      const newState = NineZoneStateReducer(state, {
        type: "WIDGET_TAB_CLICK",
        side: "left",
        widgetId: "w1",
        id: "t2",
      });
      newState.widgets.w1.minimized.should.false;
      newState.widgets.w2.minimized.should.false;
      newState.widgets.w3.minimized.should.false;
    });

    it("should maximize minimized floating widget", () => {
      let state = createNineZoneState();
      state = addFloatingWidget(state, "w1", undefined, { activeTabId: "t1", minimized: true });
      state = addTab(state, "w1", "t1");
      const newState = NineZoneStateReducer(state, {
        type: "WIDGET_TAB_CLICK",
        side: undefined,
        widgetId: "w1",
        id: "t1",
      });
      newState.widgets.w1.minimized.should.false;
    });

    it("should update preferredFloatingWidgetSize of a tab", () => {
      let state = createNineZoneState();
      state = addFloatingWidget(state, "w1", {
        bounds: new Rectangle(0, 100, 200, 400).toProps(),
      }, { activeTabId: "t1" });
      state = addTab(state, "w1", "t1");
      const newState = NineZoneStateReducer(state, {
        type: "WIDGET_TAB_CLICK",
        side: undefined,
        widgetId: "w1",
        id: "t1",
      });
      newState.tabs.t1.preferredFloatingWidgetSize!.should.eql({ height: 300, width: 200 });
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
        type: "WIDGET_TAB_DOUBLE_CLICK",
        side: "left",
        widgetId: "w1",
        id: "t1",
        floatingWidgetId: undefined,
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
        type: "WIDGET_TAB_DOUBLE_CLICK",
        side: "left",
        widgetId: "w1",
        id: "t1",
        floatingWidgetId: undefined,
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
        type: "WIDGET_TAB_DOUBLE_CLICK",
        side: "left",
        widgetId: "w1",
        id: "t1",
        floatingWidgetId: undefined,
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
        type: "WIDGET_TAB_DOUBLE_CLICK",
        side: "left",
        widgetId: "w1",
        id: "t1",
        floatingWidgetId: undefined,
      });
      newState.should.eq(state);
    });

    it("should minimize floating widget", () => {
      let state = createNineZoneState();
      state = addFloatingWidget(state, "fw1", undefined, { activeTabId: "t1" });
      state = addTab(state, "fw1", "t1");
      const newState = NineZoneStateReducer(state, {
        type: "WIDGET_TAB_DOUBLE_CLICK",
        id: "t1",
        side: undefined,
        widgetId: "fw1",
        floatingWidgetId: "fw1",
      });
      newState.widgets.fw1.minimized.should.true;
    });

    it("should activate tab", () => {
      let state = createNineZoneState();
      state = addFloatingWidget(state, "fw1", undefined, { activeTabId: "t1" });
      state = addTab(state, "fw1", "t1");
      state = addTab(state, "fw1", "t2");
      const newState = NineZoneStateReducer(state, {
        type: "WIDGET_TAB_DOUBLE_CLICK",
        id: "t2",
        side: undefined,
        widgetId: "fw1",
        floatingWidgetId: "fw1",
      });
      newState.widgets.fw1.activeTabId!.should.eq("t2");
    });
  });

  describe("PANEL_WIDGET_DRAG_START", () => {
    it("should move widget to floating state", () => {
      let state = createNineZoneState();
      state = addPanelWidget(state, "left", "w1");
      const newState = NineZoneStateReducer(state, {
        type: "PANEL_WIDGET_DRAG_START",
        bounds: new Rectangle().toProps(),
        id: "w1",
        newFloatingWidgetId: "newId",
        side: "left",
      });
      (!!newState.floatingWidgets.byId.newId).should.true;
      newState.panels.left.widgets.length.should.eq(0);
    });

    it("should keep one widget expanded", () => {
      let state = createNineZoneState();
      state = addPanelWidget(state, "left", "w1");
      state = addPanelWidget(state, "left", "w2", { minimized: true });
      const newState = NineZoneStateReducer(state, {
        type: "PANEL_WIDGET_DRAG_START",
        bounds: new Rectangle().toProps(),
        id: "w1",
        newFloatingWidgetId: "newId",
        side: "left",
      });
      newState.widgets.w2.minimized.should.false;
    });
  });

  describe("WIDGET_DRAG", () => {
    it("should move floating widget", () => {
      let state = createNineZoneState();
      state = produce(state, (draft) => {
        draft.floatingWidgets.byId.fw1 = createFloatingWidgetState("fw1", {
          bounds: new Rectangle(0, 100, 200, 400).toProps(),
        });
      });
      const newState = NineZoneStateReducer(state, {
        type: "WIDGET_DRAG",
        dragBy: new Point(10, 20).toProps(),
        floatingWidgetId: "fw1",
      });
      newState.floatingWidgets.byId.fw1!.bounds.should.eql({
        left: 10,
        top: 120,
        right: 210,
        bottom: 420,
      });
    });
  });

  describe("WIDGET_DRAG_END", () => {
    describe("no target", () => {
      it("should not remove floating widget", () => {
        let state = createNineZoneState();
        state = addFloatingWidget(state, "fw1");
        const newState = NineZoneStateReducer(state, {
          type: "WIDGET_DRAG_END",
          floatingWidgetId: "fw1",
          target: {
            type: "floatingWidget",
          },
        });
        (!!newState.floatingWidgets.byId.fw1).should.true;
      });
    });

    describe("tab target", () => {
      it("should add dragged tab", () => {
        let state = createNineZoneState();
        state = addPanelWidget(state, "left", "w1");
        state = addTab(state, "w1", "t1");
        state = addTab(state, "w1", "t2");
        state = addTab(state, "w1", "t3");
        state = addFloatingWidget(state, "fw1");
        state = addTab(state, "fw1", "fwt1");
        const newState = NineZoneStateReducer(state, {
          type: "WIDGET_DRAG_END",
          floatingWidgetId: "fw1",
          target: {
            type: "tab",
            tabIndex: 1,
            widgetId: "w1",
          },
        });
        newState.widgets.w1.tabs.length.should.eq(4);
        newState.widgets.w1.tabs[1].should.eq("fwt1");
      });

      it("should update home of tool settings floating widget", () => {
        let state = createNineZoneState();
        state = addFloatingWidget(state, "fw1", undefined, {
          activeTabId: toolSettingsTabId,
          tabs: [toolSettingsTabId],
        });
        state = addFloatingWidget(state, "fw2", {
          home: {
            side: "bottom",
            widgetId: undefined,
            widgetIndex: 0,
          },
        });
        const newState = NineZoneStateReducer(state, {
          type: "WIDGET_DRAG_END",
          floatingWidgetId: "fw2",
          target: {
            type: "tab",
            tabIndex: 0,
            widgetId: "fw1",
          },
        });
        newState.floatingWidgets.byId.fw1.home.should.not.eq(state.floatingWidgets.byId.fw1.home);
        newState.floatingWidgets.byId.fw1.home.should.eql({
          side: "bottom",
          widgetId: undefined,
          widgetIndex: 0,
        });
      });
    });

    describe("widget target", () => {
      it("should add widget", () => {
        let state = createNineZoneState();
        state = addPanelWidget(state, "left", "w1");
        state = addPanelWidget(state, "left", "w2");
        state = addFloatingWidget(state, "fw1");
        const newState = NineZoneStateReducer(state, {
          type: "WIDGET_DRAG_END",
          floatingWidgetId: "fw1",
          target: {
            type: "widget",
            newWidgetId: "newId",
            side: "left",
            widgetIndex: 1,
          },
        });
        newState.panels.left.widgets.length.should.eq(3);
        newState.panels.left.widgets[1].should.eq("newId");
      });
    });

    describe("panel target", () => {
      it("should add panel", () => {
        let state = createNineZoneState();
        state = addFloatingWidget(state, "fw1");
        const newState = NineZoneStateReducer(state, {
          type: "WIDGET_DRAG_END",
          floatingWidgetId: "fw1",
          target: {
            type: "panel",
            newWidgetId: "newId",
            side: "left",
          },
        });
        newState.panels.left.widgets.length.should.eq(1);
        newState.panels.left.widgets[0].should.eq("newId");
      });
    });
  });

  describe("FLOATING_WIDGET_SEND_BACK", () => {
    it("should send back to specified `left` panel widget", () => {
      let state = createNineZoneState();
      state = addPanelWidget(state, "left", "w1", {
        tabs: ["t0"],
      });
      state = addFloatingWidget(state, "fw1", {
        home: {
          side: "left",
          widgetId: "w1",
          widgetIndex: 0,
        },
      }, {
        tabs: ["t1", "t2"],
      });
      const newState = NineZoneStateReducer(state, {
        type: "FLOATING_WIDGET_SEND_BACK",
        id: "fw1",
      });
      newState.widgets.w1.tabs.should.eql(["t0", "t1", "t2"]);
      should().not.exist(newState.widgets.fw1);
      should().not.exist(newState.floatingWidgets.byId.fw1);
      newState.floatingWidgets.allIds.indexOf("fw1").should.eq(-1);
    });

    it("should send back to specified `right` panel widget", () => {
      let state = createNineZoneState();
      state = addPanelWidget(state, "right", "w1", {
        tabs: ["t0"],
      });
      state = addFloatingWidget(state, "fw1", {
        home: {
          side: "right",
          widgetId: "w1",
          widgetIndex: 0,
        },
      }, {
        tabs: ["t1", "t2"],
      });
      const newState = NineZoneStateReducer(state, {
        type: "FLOATING_WIDGET_SEND_BACK",
        id: "fw1",
      });
      newState.widgets.w1.tabs.should.eql(["t0", "t1", "t2"]);
      should().not.exist(newState.widgets.fw1);
      should().not.exist(newState.floatingWidgets.byId.fw1);
      newState.floatingWidgets.allIds.indexOf("fw1").should.eq(-1);
    });

    it("should send back by widgetIndex", () => {
      let state = createNineZoneState();
      state = addPanelWidget(state, "left", "w1");
      state = addFloatingWidget(state, "fw1", {
        home: {
          side: "left",
          widgetId: undefined,
          widgetIndex: 0,
        },
      }, {
        tabs: ["t1", "t2"],
      });
      const newState = NineZoneStateReducer(state, {
        type: "FLOATING_WIDGET_SEND_BACK",
        id: "fw1",
      });

      newState.panels.left.widgets.should.eql(["fw1", "w1"]);
      newState.widgets.fw1.tabs.should.eql(["t1", "t2"]);
      should().not.exist(newState.floatingWidgets.byId.fw1);
      newState.floatingWidgets.allIds.indexOf("fw1").should.eq(-1);
    });

    it("should send back by widgetIndex when there is no widget with specified widgetId", () => {
      let state = createNineZoneState();
      state = addPanelWidget(state, "left", "w2");
      state = addFloatingWidget(state, "fw1", {
        home: {
          side: "left",
          widgetId: "w1",
          widgetIndex: 0,
        },
      }, {
        tabs: ["t1", "t2"],
      });
      const newState = NineZoneStateReducer(state, {
        type: "FLOATING_WIDGET_SEND_BACK",
        id: "fw1",
      });

      newState.panels.left.widgets.should.eql(["fw1", "w2"]);
      newState.widgets.fw1.tabs.should.eql(["t1", "t2"]);
      should().not.exist(newState.floatingWidgets.byId.fw1);
      newState.floatingWidgets.allIds.indexOf("fw1").should.eq(-1);
    });

    it("should insert to provided widgetIndex when maxWidgetCount is reached", () => {
      let state = createNineZoneState();
      state = addPanelWidget(state, "left", "w1");
      state = addTab(state, "w1", "t1");
      state = addPanelWidget(state, "left", "w2");
      state = addTab(state, "w2", "t2");
      state = addPanelWidget(state, "left", "w3");
      state = addTab(state, "w3", "t3");
      state = addFloatingWidget(state, "fw1", {
        home: {
          side: "left",
          widgetId: undefined,
          widgetIndex: 1,
        },
      }, {
        tabs: ["ft1", "ft2"],
      });
      const newState = NineZoneStateReducer(state, {
        type: "FLOATING_WIDGET_SEND_BACK",
        id: "fw1",
      });

      newState.panels.left.widgets.should.eql(["w1", "w2", "w3"]);
      newState.widgets.w1.tabs.should.eql(["t1"]);
      newState.widgets.w2.tabs.should.eql(["t2", "ft1", "ft2"]);
      newState.widgets.w3.tabs.should.eql(["t3"]);
      should().not.exist(newState.floatingWidgets.byId.fw1);
      newState.floatingWidgets.allIds.indexOf("fw1").should.eq(-1);
      should().not.exist(newState.widgets.fw1);
    });
  });

  describe("FLOATING_WIDGET_RESIZE", () => {
    it("should resize widget", () => {
      let state = createNineZoneState();
      state = addFloatingWidget(state, "fw1", {
        bounds: new Rectangle(0, 100, 200, 400).toProps(),
      });
      const newState = NineZoneStateReducer(state, {
        type: "FLOATING_WIDGET_RESIZE",
        id: "fw1",
        resizeBy: new Rectangle(0, 10, 20, 40).toProps(),
      });
      newState.floatingWidgets.byId.fw1!.bounds.should.eql({
        left: 0,
        top: 90,
        right: 220,
        bottom: 440,
      });
    });

    it("should set preferredFloatingWidgetSize of active tab", () => {
      let state = createNineZoneState();
      state = addFloatingWidget(state, "fw1", {
        bounds: new Rectangle(0, 100, 200, 400).toProps(),
      }, { activeTabId: "t1" });
      state = addTab(state, "fw1", "t1");
      const newState = NineZoneStateReducer(state, {
        type: "FLOATING_WIDGET_RESIZE",
        id: "fw1",
        resizeBy: new Rectangle(0, 10, 20, 40).toProps(),
      });
      newState.tabs.t1.preferredFloatingWidgetSize!.should.eql({
        width: 220,
        height: 350,
      });
    });
  });

  describe("FLOATING_WIDGET_BRING_TO_FRONT", () => {
    it("should bring widget to front", () => {
      let state = createNineZoneState();
      state = addFloatingWidget(state, "fw1");
      state = addFloatingWidget(state, "fw2");
      const newState = NineZoneStateReducer(state, {
        type: "FLOATING_WIDGET_BRING_TO_FRONT",
        id: "fw1",
      });
      newState.floatingWidgets.allIds.should.eql(["fw2", "fw1"]);
    });
  });

  describe("WIDGET_TAB_DRAG_START", () => {
    it("should set dragged tab", () => {
      let state = createNineZoneState();
      state = addPanelWidget(state, "left", "w1");
      const newState = NineZoneStateReducer(state, {
        type: "WIDGET_TAB_DRAG_START",
        floatingWidgetId: undefined,
        id: "t1",
        position: new Point(100, 200).toProps(),
        side: "left",
        widgetId: "w1",
      });
      (!!newState.draggedTab).should.true;
    });

    it("should remove tab from widget", () => {
      let state = createNineZoneState();
      state = addPanelWidget(state, "left", "w1");
      state = addTab(state, "w1", "t1");
      state = addTab(state, "w1", "t2");
      const newState = NineZoneStateReducer(state, {
        type: "WIDGET_TAB_DRAG_START",
        floatingWidgetId: undefined,
        id: "t1",
        position: new Point(100, 200).toProps(),
        side: "left",
        widgetId: "w1",
      });
      newState.widgets.w1.tabs.length.should.eq(1);
    });

    it("should remove widget from panel", () => {
      let state = createNineZoneState();
      state = addPanelWidget(state, "left", "w1");
      state = addTab(state, "w1", "t1");
      const newState = NineZoneStateReducer(state, {
        type: "WIDGET_TAB_DRAG_START",
        floatingWidgetId: undefined,
        id: "t1",
        position: new Point(100, 200).toProps(),
        side: "left",
        widgetId: "w1",
      });
      newState.panels.left.widgets.length.should.eq(0);
    });

    it("should remove widget", () => {
      let state = createNineZoneState();
      state = addPanelWidget(state, "left", "w1");
      state = addTab(state, "w1", "t1");
      const newState = NineZoneStateReducer(state, {
        type: "WIDGET_TAB_DRAG_START",
        floatingWidgetId: undefined,
        id: "t1",
        position: new Point(100, 200).toProps(),
        side: "left",
        widgetId: "w1",
      });
      should().not.exist(newState.widgets.w1);
    });

    it("should remove floating widget", () => {
      let state = createNineZoneState();
      state = addFloatingWidget(state, "fw1");
      state = addTab(state, "fw1", "t1");
      const newState = NineZoneStateReducer(state, {
        type: "WIDGET_TAB_DRAG_START",
        floatingWidgetId: "fw1",
        id: "t1",
        position: new Point(100, 200).toProps(),
        side: undefined,
        widgetId: "fw1",
      });
      (!!newState.floatingWidgets.byId.fw1).should.false;
    });

    it("should keep active tab", () => {
      let state = createNineZoneState();
      state = addFloatingWidget(state, "fw1", undefined, { activeTabId: "t2" });
      state = addTab(state, "fw1", "t1");
      state = addTab(state, "fw1", "t2");
      const newState = NineZoneStateReducer(state, {
        type: "WIDGET_TAB_DRAG_START",
        floatingWidgetId: "fw1",
        id: "t2",
        position: new Point(100, 200).toProps(),
        side: undefined,
        widgetId: "fw1",
      });
      newState.widgets.fw1.activeTabId!.should.eq("t1");
    });

    it("should keep one widget expanded", () => {
      let state = createNineZoneState();
      state = addPanelWidget(state, "left", "w1", { activeTabId: "t1" });
      state = addPanelWidget(state, "left", "w2", { minimized: true });
      state = addTab(state, "w1", "t1");
      const newState = NineZoneStateReducer(state, {
        type: "WIDGET_TAB_DRAG_START",
        floatingWidgetId: undefined,
        id: "t1",
        position: new Point(100, 200).toProps(),
        side: "left",
        widgetId: "w1",
      });
      newState.widgets.w2.minimized.should.false;
    });
  });

  describe("WIDGET_TAB_DRAG", () => {
    it("should update tab position", () => {
      let state = createNineZoneState();
      state = addPanelWidget(state, "left", "w1");
      state = produce(state, (draft) => {
        draft.draggedTab = createDraggedTabState("dt", {
          position: new Point(100, 200).toProps(),
        });
      });
      const newState = NineZoneStateReducer(state, {
        type: "WIDGET_TAB_DRAG",
        dragBy: new Point(10, 20).toProps(),
      });
      newState.draggedTab!.position.should.eql({
        x: 110,
        y: 220,
      });
    });
  });

  describe("WIDGET_TAB_DRAG_END", () => {
    describe("tab target", () => {
      it("should add tab", () => {
        let state = createNineZoneState();
        state = addPanelWidget(state, "left", "w1");
        state = addTab(state, "w1", "t1");
        state = addTab(state, "w1", "t2");
        state = produce(state, (draft) => {
          draft.draggedTab = createDraggedTabState("dt", {
            position: new Point(100, 200).toProps(),
          });
        });
        const newState = NineZoneStateReducer(state, {
          type: "WIDGET_TAB_DRAG_END",
          id: "dt",
          target: {
            type: "tab",
            tabIndex: 1,
            widgetId: "w1",
          },
        });
        newState.widgets.w1.tabs.length.should.eq(3);
        newState.widgets.w1.tabs[1].should.eq("dt");
      });

      it("should update home of tool settings floating widget", () => {
        let state = createNineZoneState();
        state = produce(state, (draft) => {
          draft.draggedTab = createDraggedTabState("dt", {
            position: new Point(100, 200).toProps(),
            home: {
              side: "bottom",
              widgetId: undefined,
              widgetIndex: 0,
            },
          });
        });
        state = addFloatingWidget(state, "fw1", undefined, {
          activeTabId: toolSettingsTabId,
          tabs: [toolSettingsTabId],
        });
        const newState = NineZoneStateReducer(state, {
          type: "WIDGET_TAB_DRAG_END",
          id: "d2",
          target: {
            type: "tab",
            tabIndex: 0,
            widgetId: "fw1",
          },
        });
        newState.floatingWidgets.byId.fw1.home.should.not.eq(state.floatingWidgets.byId.fw1.home);
        newState.floatingWidgets.byId.fw1.home.should.eql({
          side: "bottom",
          widgetId: undefined,
          widgetIndex: 0,
        });
      });
    });

    describe("widget target", () => {
      it("should add widget", () => {
        let state = createNineZoneState();
        state = addPanelWidget(state, "left", "w1");
        state = produce(state, (draft) => {
          draft.draggedTab = createDraggedTabState("dt", {
            position: new Point(100, 200).toProps(),
          });
        });
        const newState = NineZoneStateReducer(state, {
          type: "WIDGET_TAB_DRAG_END",
          id: "dt",
          target: {
            type: "widget",
            newWidgetId: "newId",
            side: "left",
            widgetIndex: 0,
          },
        });
        newState.panels.left.widgets.length.should.eq(2);
        newState.panels.left.widgets[0].should.eq("newId");
      });
    });

    describe("panel target", () => {
      it("should add widget", () => {
        let state = createNineZoneState();
        state = produce(state, (draft) => {
          draft.draggedTab = createDraggedTabState("dt", {
            position: new Point(100, 200).toProps(),
          });
        });
        const newState = NineZoneStateReducer(state, {
          type: "WIDGET_TAB_DRAG_END",
          id: "dt",
          target: {
            type: "panel",
            newWidgetId: "newId",
            side: "left",
          },
        });
        newState.panels.left.widgets.length.should.eq(1);
        newState.panels.left.widgets[0].should.eq("newId");
      });
    });

    describe("floating widget target", () => {
      it("should add floating widget", () => {
        let state = createNineZoneState();
        state = produce(state, (draft) => {
          draft.tabs.dt = createTabState("dt");
        });
        state = produce(state, (draft) => {
          draft.draggedTab = createDraggedTabState("dt", {
            position: new Point(100, 200).toProps(),
          });
        });
        const newState = NineZoneStateReducer(state, {
          type: "WIDGET_TAB_DRAG_END",
          id: "dt",
          target: {
            type: "floatingWidget",
            newFloatingWidgetId: "newId",
            size: {
              height: 200,
              width: 200,
            },
          },
        });
        (!!newState.floatingWidgets.byId.newId).should.true;
      });
    });
  });

  describe("TOOL_SETTINGS_DOCK", () => {
    it("should dock from panel widget", () => {
      let state = createNineZoneState();
      state = addPanelWidget(state, "left", "w1", { activeTabId: toolSettingsTabId });
      state = produce(state, (draft) => {
        draft.toolSettings = {
          type: "widget",
        };
        draft.widgets.w1.tabs.push(toolSettingsTabId);
      });
      const newState = NineZoneStateReducer(state, {
        type: "TOOL_SETTINGS_DOCK",
      });
      newState.toolSettings.type.should.eq("docked");
      should().not.exist(newState.widgets.w1);
    });

    it("should dock from floating widget", () => {
      let state = createNineZoneState();
      state = addFloatingWidget(state, "w1", undefined, { activeTabId: toolSettingsTabId });
      state = produce(state, (draft) => {
        draft.toolSettings = {
          type: "widget",
        };
        draft.widgets.w1.tabs.push(toolSettingsTabId);
      });
      const newState = NineZoneStateReducer(state, {
        type: "TOOL_SETTINGS_DOCK",
      });
      newState.toolSettings.type.should.eq("docked");
      should().not.exist(newState.widgets.w1);
      should().not.exist(newState.floatingWidgets.byId.w1);
      newState.floatingWidgets.allIds.indexOf("w1").should.eq(-1);
    });
  });

  describe("TOOL_SETTINGS_DRAG_START", () => {
    it("should convert to floating widget", () => {
      const state = createNineZoneState();
      const newState = NineZoneStateReducer(state, {
        type: "TOOL_SETTINGS_DRAG_START",
        newFloatingWidgetId: "new-fw1",
      });
      newState.toolSettings.type.should.eq("widget");
      newState.floatingWidgets.byId["new-fw1"].id.should.eq("new-fw1");
    });

    it("should skip if not docked", () => {
      const state = produce(createNineZoneState(), (draft) => {
        draft.toolSettings.type = "widget";
      });
      const newState = NineZoneStateReducer(state, {
        type: "TOOL_SETTINGS_DRAG_START",
        newFloatingWidgetId: "new-fw1",
      });
      newState.should.eq(state);
    });

    it("should use preferredFloatingWidgetSize", () => {
      let state = createNineZoneState();
      state = produce(state, (draft) => {
        draft.tabs[toolSettingsTabId].preferredFloatingWidgetSize = { height: 400, width: 500 };
      });
      const newState = NineZoneStateReducer(state, {
        type: "TOOL_SETTINGS_DRAG_START",
        newFloatingWidgetId: "new-fw1",
      });

      newState.floatingWidgets.byId["new-fw1"].bounds.should.eql({
        left: 0,
        top: 0,
        bottom: 400,
        right: 500,
      });
    });
  });
});

describe("findTab", () => {
  it("should return undefined if widget is not found", () => {
    let nineZone = produce(createNineZoneState(), (draft) => {
      draft.widgets.w1 = castDraft(createWidgetState("w1"));
    });
    nineZone = addTab(nineZone, "w1", "t1");
    const tab = findTab(nineZone, "t1");
    should().not.exist(tab);
  });

  it("should return undefined if tab is not found", () => {
    let nineZone = createNineZoneState();
    nineZone = addPanelWidget(nineZone, "left", "w1");
    const tab = findTab(nineZone, "t1");
    should().not.exist(tab);
  });
});
