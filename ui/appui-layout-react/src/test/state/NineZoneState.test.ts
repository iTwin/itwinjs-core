/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect, should } from "chai";
import { produce } from "immer";
import { Point, Rectangle } from "@itwin/core-react";
import {
  addFloatingWidget, addPanelWidget, addPopoutWidget, addTab, convertAllPopupWidgetContainersToFloating, createNineZoneState, dockWidgetContainer, floatWidget, isTabDragDropTargetState, isWidgetDragDropTargetState,
  NineZoneStateReducer, popoutWidgetToChildWindow, toolSettingsTabId,
} from "../../appui-layout-react";
import { addTabs } from "../Utils";
import {
  convertFloatingWidgetContainerToPopout, convertPopoutWidgetContainerToFloating,
} from "../../appui-layout-react/state/internal/NineZoneStateHelpers";
import { createDraggedTabState } from "../../appui-layout-react/state/internal/TabStateHelpers";

describe("isWidgetDragDropTargetState", () => {
  it("returns `true`", () => {
    isWidgetDragDropTargetState({ type: "tab", tabIndex: 0, widgetId: "w1" }).should.true;
  });

  it("returns `false`", () => {
    isWidgetDragDropTargetState({ type: "floatingWidget", newFloatingWidgetId: "", size: { height: 0, width: 0 } }).should.false;
  });
});

describe("isTabDragDropTargetState", () => {
  it("returns `true`", () => {
    isTabDragDropTargetState({ type: "tab", tabIndex: 0, widgetId: "w1" }).should.true;
  });

  it("returns `false`", () => {
    isTabDragDropTargetState({ type: "window" }).should.false;
  });
});

describe("NineZoneStateReducer", () => {
  it("should not update for unhandled action", () => {
    const state = createNineZoneState();
    const newState = NineZoneStateReducer(state, {
      type: "WIDGET_TAB_POPOUT",
      id: "t1",
    });
    newState.should.eq(state);
  });

  describe("RESIZE", () => {
    it("should resize", () => {
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
      state = addTabs(state, ["t1"]);
      state = addFloatingWidget(state, "fw1", ["t1"], {
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

  describe("PANEL_SET_COLLAPSED", () => {
    it("should collapse panel", () => {
      const state = createNineZoneState();
      const newState = NineZoneStateReducer(state, {
        type: "PANEL_SET_COLLAPSED",
        side: "left",
        collapsed: true,
      });
      newState.panels.left.collapsed.should.true;
    });
  });

  describe("PANEL_SET_SIZE", () => {
    it("should set panel size", () => {
      const state = createNineZoneState();
      const newState = NineZoneStateReducer(state, {
        type: "PANEL_SET_SIZE",
        side: "left",
        size: 400,
      });
      Number(400).should.eq(newState.panels.left.size);
    });
  });

  describe("PANEL_SET_SPLITTER_VALUE", () => {
    it("should set panel split percent", () => {
      const state = createNineZoneState();
      const newState = NineZoneStateReducer(state, {
        type: "PANEL_SET_SPLITTER_VALUE",
        side: "left",
        percent: 40,
      });
      Number(40).should.eq(newState.panels.left.splitterPercent);
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
      state = addTabs(state, ["t1"]);
      state = addPanelWidget(state, "left", "w1", ["t1"]);
      const newState = NineZoneStateReducer(state, {
        type: "WIDGET_TAB_CLICK",
        side: "left",
        widgetId: "w1",
        id: "t1",
      });
      newState.widgets.w1.activeTabId.should.eq("t1");
    });

    it("should set tab active", () => {
      let state = createNineZoneState();
      state = addTabs(state, ["t1", "t2", "t3"]);
      state = addPanelWidget(state, "left", "w1", ["t1", "t3"]);
      state = addPanelWidget(state, "left", "w2", ["t2"]);
      const newState = NineZoneStateReducer(state, {
        type: "WIDGET_TAB_CLICK",
        side: "left",
        widgetId: "w1",
        id: "t1",
      });
      newState.widgets.w1.minimized.should.false;
      expect(newState.widgets.w1.activeTabId).to.be.eql("t1");

      const newState2 = NineZoneStateReducer(newState, {
        type: "WIDGET_TAB_CLICK",
        side: "left",
        widgetId: "w1",
        id: "t3",
      });
      expect(newState2.widgets.w1.activeTabId).to.be.eql("t3");
    });

    it("should maximize minimized floating widget", () => {
      let state = createNineZoneState();
      state = addTabs(state, ["t1"]);
      state = addFloatingWidget(state, "w1", ["t1"], undefined, { minimized: true });
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
      state = addTabs(state, ["t1"]);
      state = addFloatingWidget(state, "w1", ["t1"], {
        bounds: new Rectangle(0, 100, 200, 400).toProps(),
      });
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
    it("should not minimize panel section", () => {
      let state = createNineZoneState();
      state = addTabs(state, ["t1"]);
      state = addPanelWidget(state, "left", "w1", ["t1"]);
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
      state = addTabs(state, ["t1"]);
      state = addFloatingWidget(state, "fw1", ["t1"]);
      const newState = NineZoneStateReducer(state, {
        type: "WIDGET_TAB_DOUBLE_CLICK",
        id: "t1",
        side: undefined,
        widgetId: "fw1",
        floatingWidgetId: "fw1",
      });
      newState.widgets.fw1.minimized.should.true;
    });

    it("should activate tab in floating widget", () => {
      let state = createNineZoneState();
      state = addTabs(state, ["t1", "t2"]);
      state = addFloatingWidget(state, "fw1", ["t1", "t2"]);
      const newState = NineZoneStateReducer(state, {
        type: "WIDGET_TAB_DOUBLE_CLICK",
        id: "t2",
        side: undefined,
        widgetId: "fw1",
        floatingWidgetId: "fw1",
      });
      newState.widgets.fw1.activeTabId.should.eq("t2");
    });
  });

  describe("PANEL_WIDGET_DRAG_START", () => {
    it("should move widget to floating state", () => {
      let state = createNineZoneState();
      state = addTabs(state, ["t1"]);
      state = addPanelWidget(state, "left", "w1", ["t1"]);
      const newState = NineZoneStateReducer(state, {
        type: "PANEL_WIDGET_DRAG_START",
        bounds: new Rectangle().toProps(),
        id: "w1",
        newFloatingWidgetId: "newId",
        side: "left",
      });
      should().exist(newState.floatingWidgets.byId.newId);
      newState.panels.left.widgets.should.length(0);
    });

    it("should keep one widget expanded", () => {
      let state = createNineZoneState();
      state = addTabs(state, ["t1", "t2"]);
      state = addPanelWidget(state, "left", "w1", ["t1"]);
      state = addPanelWidget(state, "left", "w2", ["t2"], { minimized: true });
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
      let state = createNineZoneState({ size: { height: 1000, width: 1600 } });
      state = addTabs(state, ["t1"]);
      state = addFloatingWidget(state, "fw1", ["t1"], {
        bounds: new Rectangle(0, 100, 200, 400),
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
        let state = createNineZoneState({ size: { height: 1000, width: 1600 } });
        state = addTabs(state, ["t1"]);
        state = addFloatingWidget(state, "fw1", ["t1"]);
        const newState = NineZoneStateReducer(state, {
          type: "WIDGET_DRAG_END",
          floatingWidgetId: "fw1",
          target: {
            type: "window",
          },
        });
        (!!newState.floatingWidgets.byId.fw1).should.true;
      });

      it("should contain minimized", () => {
        let state = createNineZoneState({
          size: {
            height: 1000,
            width: 2000,
          },
        });
        state = addTabs(state, ["t1"]);
        state = addFloatingWidget(state, "w1", ["t1"], {
          bounds: {
            left: 2500,
            top: 990,
            right: 2700,
            bottom: 1100,
          },
        }, {
          minimized: true,
        });
        const newState = NineZoneStateReducer(state, {
          type: "WIDGET_DRAG_END",
          floatingWidgetId: "w1",
          target: {
            type: "window",
          },
        });
        newState.floatingWidgets.byId.w1.bounds.should.eql({
          left: 1800,
          top: 965,
          right: 2000,
          bottom: 1075,
        });
      });
    });

    describe("tab target", () => {
      it("should add dragged tab", () => {
        let state = createNineZoneState();
        state = addTabs(state, ["t1", "t2", "t3", "fwt1"]);
        state = addPanelWidget(state, "left", "w1", ["t1", "t2", "t3"]);
        state = addFloatingWidget(state, "fw1", ["fwt1"]);
        const newState = NineZoneStateReducer(state, {
          type: "WIDGET_DRAG_END",
          floatingWidgetId: "fw1",
          target: {
            type: "tab",
            tabIndex: 1,
            widgetId: "w1",
          },
        });
        newState.widgets.w1.tabs.should.eql(["t1", "fwt1", "t2", "t3"]);
      });

      it("should update home of tool settings floating widget", () => {
        let state = createNineZoneState();
        state = addTab(state, "t2");
        state = addFloatingWidget(state, "fw1", [toolSettingsTabId]);
        state = addFloatingWidget(state, "fw2", ["t2"], {
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

    describe("section target", () => {
      it("should add a section", () => {
        let state = createNineZoneState();
        state = addTabs(state, ["t1", "t2", "fwt1"]);
        state = addPanelWidget(state, "left", "w1", ["t1"]);
        state = addPanelWidget(state, "left", "w2", ["t2"]);
        state = addFloatingWidget(state, "fw1", ["fwt1"]);
        const newState = NineZoneStateReducer(state, {
          type: "WIDGET_DRAG_END",
          floatingWidgetId: "fw1",
          target: {
            type: "section",
            newWidgetId: "newId",
            side: "left",
            sectionIndex: 1,
          },
        });
        newState.panels.left.widgets.should.eql(["w1", "newId", "w2"]);
      });
    });

    describe("widget target", () => {
      it("should add tabs to a section widget", () => {
        let state = createNineZoneState();
        state = addTabs(state, ["t1", "t2", "fwt1"]);
        state = addPanelWidget(state, "left", "w1", ["t1"]);
        state = addPanelWidget(state, "left", "w2", ["t2"]);
        state = addFloatingWidget(state, "fw1", ["fwt1"]);
        const newState = NineZoneStateReducer(state, {
          type: "WIDGET_DRAG_END",
          floatingWidgetId: "fw1",
          target: {
            type: "widget",
            widgetId: "w2",
          },
        });
        newState.widgets.w2.tabs.should.eql(["t2", "fwt1"]);
      });

      it("should add tabs to a floating widget", () => {
        let state = createNineZoneState();
        state = addTabs(state, ["fwt1", "fwt2"]);
        state = addFloatingWidget(state, "fw1", ["fwt1"]);
        state = addFloatingWidget(state, "fw2", ["fwt2"]);
        const newState = NineZoneStateReducer(state, {
          type: "WIDGET_DRAG_END",
          floatingWidgetId: "fw1",
          target: {
            type: "widget",
            widgetId: "fw2",
          },
        });
        newState.widgets.fw2.tabs.should.eql(["fwt2", "fwt1"]);
      });
    });

    describe("panel target", () => {
      it("should add panel", () => {
        let state = createNineZoneState();
        state = addTab(state, "fwt1");
        state = addFloatingWidget(state, "fw1", ["fwt1"]);
        const newState = NineZoneStateReducer(state, {
          type: "WIDGET_DRAG_END",
          floatingWidgetId: "fw1",
          target: {
            type: "panel",
            newWidgetId: "leftStart",
            side: "left",
          },
        });
        newState.panels.left.widgets.should.eql(["leftStart"]);
      });
    });
  });

  describe("FLOATING_WIDGET_SEND_BACK", () => {
    it("should send back to specified `left` panel widget", () => {
      let state = createNineZoneState();
      state = addTabs(state, ["t1", "fwt1", "fwt2"]);
      state = addPanelWidget(state, "left", "leftStart", ["t1"]);
      state = addFloatingWidget(state, "fw1", ["fwt1", "fwt2"], {
        home: {
          side: "left",
          widgetId: "leftStart",
          widgetIndex: 0,
        },
      });
      const newState = NineZoneStateReducer(state, {
        type: "FLOATING_WIDGET_SEND_BACK",
        id: "fw1",
      });
      newState.widgets.leftStart.tabs.should.eql(["t1", "fwt1", "fwt2"]);
      should().not.exist(newState.widgets.fw1);
      should().not.exist(newState.floatingWidgets.byId.fw1);
    });

    it("should send back to specified `right` panel widget", () => {
      let state = createNineZoneState();
      state = addTabs(state, ["t0", "t1", "t2"]);
      state = addPanelWidget(state, "right", "w1", ["t0"]);
      state = addFloatingWidget(state, "fw1", ["t1", "t2"], {
        home: {
          side: "right",
          widgetId: "w1",
          widgetIndex: 0,
        },
      });
      const newState = NineZoneStateReducer(state, {
        type: "FLOATING_WIDGET_SEND_BACK",
        id: "fw1",
      });
      newState.widgets.w1.tabs.should.eql(["t0", "t1", "t2"]);
      should().not.exist(newState.widgets.fw1);
      should().not.exist(newState.floatingWidgets.byId.fw1);
    });

    it("should send back to widget container named same as floating widget when widgetId is undefined", () => {
      let state = createNineZoneState();
      state = addTabs(state, ["t1", "t2", "t3"]);
      state = addPanelWidget(state, "left", "leftStart", ["t1"]);
      state = addFloatingWidget(state, "fw1", ["t2", "t3"], {
        home: {
          side: "left",
          widgetId: undefined,
          widgetIndex: 1,
        },
      });

      state.panels.left.widgets.should.eql(["leftStart"]);

      const newState = NineZoneStateReducer(state, {
        type: "FLOATING_WIDGET_SEND_BACK",
        id: "fw1",
      });

      newState.panels.left.widgets.should.eql(["leftStart", "leftEnd"]);
      newState.widgets.leftStart.tabs.should.eql(["t1"]);
      newState.widgets.leftEnd.tabs.should.eql(["t2", "t3"]);
      should().not.exist(newState.widgets.fw1);
      should().not.exist(newState.floatingWidgets.byId.fw1);
    });

    it("should send back to widget container by index when widgetId is undefined", () => {
      let state = createNineZoneState();
      state = addTabs(state, ["t1", "t2", "t3"]);
      state = addPanelWidget(state, "left", "leftEnd", ["t1"]);
      state = addFloatingWidget(state, "fw1", ["t2", "t3"], {
        home: {
          side: "left",
          widgetId: undefined,
          widgetIndex: 0,
        },
      });

      state.panels.left.widgets.should.eql(["leftEnd"]);

      const newState = NineZoneStateReducer(state, {
        type: "FLOATING_WIDGET_SEND_BACK",
        id: "fw1",
      });

      newState.panels.left.widgets.should.eql(["leftStart", "leftEnd"]);
      newState.widgets.leftEnd.tabs.should.eql(["t1"]);
      newState.widgets.leftStart.tabs.should.eql(["t2", "t3"]);
      should().not.exist(newState.floatingWidgets.byId.fw1);
    });

    it("should send back to a newly created widget container if the container no longer exists because all widget tabs were floated", () => {
      let state = createNineZoneState();
      state = addTabs(state, ["t1", "t2"]);
      state = addPanelWidget(state, "left", "w2", ["t2"]);
      state = addFloatingWidget(state, "fw1", ["t1"], {
        home: {
          side: "left",
          widgetId: "w1",
          widgetIndex: 0,
        },
      });

      const newState = NineZoneStateReducer(state, {
        type: "FLOATING_WIDGET_SEND_BACK",
        id: "fw1",
      });

      newState.panels.left.widgets.should.eql(["w1", "w2"]);
      newState.widgets.w1.tabs.should.eql(["t1"]);
      newState.widgets.w2.tabs.should.eql(["t2"]);
      should().not.exist(newState.widgets.fw1);
      should().not.exist(newState.floatingWidgets.byId.fw1);
    });

    it("should re-dock floating insert to provided widgetIndex", () => {
      let state = createNineZoneState();
      state = addTabs(state, ["t1", "t2", "t3", "fwt1", "fwt2"]);
      state = addPanelWidget(state, "left", "leftStart", ["t1", "t2"]);
      state = addPanelWidget(state, "left", "leftEnd", ["t3"]);
      state = addFloatingWidget(state, "fw1", ["fwt1", "fwt2"], {
        home: {
          side: "left",
          widgetId: undefined,
          widgetIndex: 1,
        },
      });
      const newState = NineZoneStateReducer(state, {
        type: "FLOATING_WIDGET_SEND_BACK",
        id: "fw1",
      });

      newState.panels.left.widgets.should.eql(["leftStart", "leftEnd"]);
      newState.widgets.leftStart.tabs.should.eql(["t1", "t2"]);
      newState.widgets.leftEnd.tabs.should.eql(["t3", "fwt1", "fwt2"]);
      should().not.exist(newState.widgets.fw1);
      should().not.exist(newState.floatingWidgets.byId.fw1);
    });

    it("should send back to existing panel section", () => {
      let state = createNineZoneState();
      state = addTabs(state, ["t1", "t2"]);
      state = addFloatingWidget(state, "fw1", ["t1"], {
        home: {
          side: "left",
          widgetId: undefined,
          widgetIndex: 0,
        },
      });
      state = addFloatingWidget(state, "fw2", ["t2"], {
        home: {
          side: "left",
          widgetId: undefined,
          widgetIndex: 0,
        },
      });
      let newState = NineZoneStateReducer(state, {
        type: "FLOATING_WIDGET_SEND_BACK",
        id: "fw1",
      });
      newState = NineZoneStateReducer(newState, {
        type: "FLOATING_WIDGET_SEND_BACK",
        id: "fw2",
      });
      newState.panels.left.widgets.should.eql(["leftStart"]);
      newState.widgets.leftStart.tabs.should.eql(["t1", "t2"]);
    });

    it("should send back to existing panel section ('maxWidgetCount' limit)", () => {
      let state = createNineZoneState();
      state = addTabs(state, ["t1", "t2", "ft1"]);
      state = addPanelWidget(state, "left", "w1", ["t1"]);
      state = addPanelWidget(state, "left", "w2", ["t2"]);
      state = addFloatingWidget(state, "fw1", ["ft1"], {
        home: {
          side: "left",
          widgetId: undefined,
          widgetIndex: 0,
        },
      });
      const newState = NineZoneStateReducer(state, {
        type: "FLOATING_WIDGET_SEND_BACK",
        id: "fw1",
      });
      newState.widgets.w1.tabs.should.eql(["t1", "ft1"]);
      newState.widgets.w2.tabs.should.eql(["t2"]);
    });
  });

  describe("FLOATING_WIDGET_RESIZE", () => {
    it("should resize widget", () => {
      let state = createNineZoneState();
      state = addTabs(state, ["t1"]);
      state = addFloatingWidget(state, "fw1", ["t1"], {
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
      state = addTabs(state, ["t1"]);
      state = addFloatingWidget(state, "fw1", ["t1"], {
        bounds: new Rectangle(0, 100, 200, 400).toProps(),
      });
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

  describe("FLOATING_WIDGET_SET_BOUNDS", () => {
    it("should set floating widget bounds", () => {
      let state = createNineZoneState({ size: { height: 1000, width: 1600 } });
      state = addTabs(state, ["t1"]);
      state = addFloatingWidget(state, "fw1", ["t1"], {
        bounds: new Rectangle(0, 100, 200, 400).toProps(),
      });
      const newState = NineZoneStateReducer(state, {
        type: "FLOATING_WIDGET_SET_BOUNDS",
        id: "fw1",
        bounds: { top: 50, left: 30, bottom: 250, right: 350 },
      });
      newState.floatingWidgets.byId.fw1!.userSized?.should.eql(true);
      newState.floatingWidgets.byId.fw1!.bounds.should.eql({
        left: 30,
        top: 50,
        right: 350,
        bottom: 250,
      });
    });
  });

  describe("FLOATING_WIDGET_BRING_TO_FRONT", () => {
    it("should bring widget to front", () => {
      let state = createNineZoneState();
      state = addTabs(state, ["t1", "t2"]);
      state = addFloatingWidget(state, "fw1", ["t1"]);
      state = addFloatingWidget(state, "fw2", ["t2"]);
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
      state = addTabs(state, ["t1"]);
      state = addPanelWidget(state, "left", "w1", ["t1"]);
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
      state = addTabs(state, ["t1", "t2"]);
      state = addPanelWidget(state, "left", "w1", ["t1", "t2"]);
      const newState = NineZoneStateReducer(state, {
        type: "WIDGET_TAB_DRAG_START",
        floatingWidgetId: undefined,
        id: "t1",
        position: new Point(100, 200).toProps(),
        side: "left",
        widgetId: "w1",
      });
      newState.widgets.w1.tabs.should.eql(["t2"]);
    });

    it("should remove widget from panel", () => {
      let state = createNineZoneState();
      state = addTabs(state, ["t1"]);
      state = addPanelWidget(state, "left", "w1", ["t1"]);
      const newState = NineZoneStateReducer(state, {
        type: "WIDGET_TAB_DRAG_START",
        floatingWidgetId: undefined,
        id: "t1",
        position: new Point(100, 200).toProps(),
        side: "left",
        widgetId: "w1",
      });
      newState.panels.left.widgets.should.length(0);
    });

    it("should remove widget", () => {
      let state = createNineZoneState();
      state = addTabs(state, ["t1"]);
      state = addPanelWidget(state, "left", "w1", ["t1"]);
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
      state = addTabs(state, ["t1"]);
      state = addFloatingWidget(state, "fw1", ["t1"]);
      const newState = NineZoneStateReducer(state, {
        type: "WIDGET_TAB_DRAG_START",
        floatingWidgetId: "fw1",
        id: "t1",
        position: new Point(100, 200).toProps(),
        side: undefined,
        widgetId: "fw1",
      });
      should().not.exist(newState.floatingWidgets.byId.fw1);
    });

    it("should keep active tab", () => {
      let state = createNineZoneState();
      state = addTabs(state, ["t1", "t2"]);
      state = addFloatingWidget(state, "fw1", ["t1", "t2"], undefined, { activeTabId: "t2" });
      const newState = NineZoneStateReducer(state, {
        type: "WIDGET_TAB_DRAG_START",
        floatingWidgetId: "fw1",
        id: "t2",
        position: new Point(100, 200).toProps(),
        side: undefined,
        widgetId: "fw1",
      });
      newState.widgets.fw1.activeTabId.should.eq("t1");
    });

    it("should keep one widget expanded", () => {
      let state = createNineZoneState();
      state = addTabs(state, ["t1", "t2"]);
      state = addPanelWidget(state, "left", "w1", ["t1"]);
      state = addPanelWidget(state, "left", "w2", ["t2"], { minimized: true });
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
      state = addTabs(state, ["t1", "dt"]);
      state = addPanelWidget(state, "left", "w1", ["t1"]);
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
      it("should add tab to leftStart", () => {
        let state = createNineZoneState();
        state = addTabs(state, ["t1", "t2"]);
        state = addPanelWidget(state, "left", "leftStart", ["t1", "t2"]);
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
            widgetId: "leftStart",
          },
        });
        newState.widgets.leftStart.tabs.should.eql(["t1", "dt", "t2"]);
      });

      it("should add tab to leftEnd", () => {
        let state = createNineZoneState();
        state = addTabs(state, ["t1", "t2", "dt"]);
        state = addPanelWidget(state, "left", "leftEnd", ["t1", "t2"]);
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
            widgetId: "leftEnd",
          },
        });
        newState.widgets.leftEnd.tabs.should.eql(["t1", "dt", "t2"]);
      });

      it("should update home of tool settings floating widget", () => {
        let state = createNineZoneState();
        state = addTab(state, "dt");
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
        state = addFloatingWidget(state, "fw1", [toolSettingsTabId]);
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

    describe("section target", () => {
      it("should add widget", () => {
        let state = createNineZoneState();
        state = addTabs(state, ["t1", "dt"]);
        state = addPanelWidget(state, "left", "leftStart", ["t1"]);
        state = produce(state, (draft) => {
          draft.draggedTab = createDraggedTabState("dt", {
            position: new Point(100, 200).toProps(),
          });
        });
        const newState = NineZoneStateReducer(state, {
          type: "WIDGET_TAB_DRAG_END",
          id: "dt",
          target: {
            type: "section",
            newWidgetId: "leftEnd",
            side: "left",
            sectionIndex: 1,
          },
        });
        newState.panels.left.widgets.should.eql(["leftStart", "leftEnd"]);
      });

      it("should add widget to new end panel section", () => {
        let state = createNineZoneState();
        state = addTabs(state, ["t1", "dt"]);
        state = addPanelWidget(state, "left", "leftStart", ["t1"]);
        state = produce(state, (draft) => {
          draft.draggedTab = createDraggedTabState("dt", {
            position: new Point(100, 200).toProps(),
          });
        });
        const newState = NineZoneStateReducer(state, {
          type: "WIDGET_TAB_DRAG_END",
          id: "dt",
          target: {
            type: "section",
            newWidgetId: "nw1",
            side: "left",
            sectionIndex: 1,
          },
        });
        newState.panels.left.widgets.should.eql(["leftStart", "nw1"]);
      });

      it("should add widget to new panel start section", () => {
        let state = createNineZoneState();
        state = addTabs(state, ["dt", "t1"]);
        state = addPanelWidget(state, "left", "leftEnd", ["t1"]);
        state = produce(state, (draft) => {
          draft.draggedTab = createDraggedTabState("dt", {
            position: new Point(100, 200).toProps(),
          });
        });
        const newState = NineZoneStateReducer(state, {
          type: "WIDGET_TAB_DRAG_END",
          id: "dt",
          target: {
            type: "section",
            newWidgetId: "nw1",
            side: "left",
            sectionIndex: 0,
          },
        });
        newState.panels.left.widgets.should.eql(["nw1", "leftEnd"]);
      });
    });

    describe("widget target", () => {
      it("should add widget to existing end panel section", () => {
        let state = createNineZoneState();
        state = addTabs(state, ["dt", "t1"]);
        state = addPanelWidget(state, "left", "leftEnd", ["t1"]);
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
            widgetId: "leftEnd",
          },
        });
        newState.panels.left.widgets.should.eql(["leftEnd"]);
      });

      it("should add widget to existing panel start section", () => {
        let state = createNineZoneState();
        state = addTabs(state, ["t1", "dt"]);
        state = addPanelWidget(state, "left", "leftStart", ["t1"]);
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
            widgetId: "leftStart",
          },
        });
        newState.panels.left.widgets.should.eql(["leftStart"]);
      });

      it("should add tabs to a floating widget", () => {
        let state = createNineZoneState();
        state = addTabs(state, ["dt", "fwt1"]);
        state = addFloatingWidget(state, "fw1", ["fwt1"]);
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
            widgetId: "fw1",
          },
        });
        newState.widgets.fw1.tabs.should.eql(["fwt1", "dt"]);
      });
    });

    describe("panel target", () => {
      it("should add widget", () => {
        let state = createNineZoneState();
        state = addTab(state, "dt");
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
        newState.panels.left.widgets.should.eql(["newId"]);
      });
    });

    describe("floating widget target", () => {
      it("should add floating widget", () => {
        let state = createNineZoneState();
        state = addTab(state, "dt");
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
      state = addPanelWidget(state, "left", "w1", [toolSettingsTabId]);
      state = produce(state, (draft) => {
        draft.toolSettings = {
          type: "widget",
        };
      });
      const newState = NineZoneStateReducer(state, {
        type: "TOOL_SETTINGS_DOCK",
      });
      newState.toolSettings.type.should.eq("docked");
      should().not.exist(newState.widgets.w1);
    });

    it("should dock from floating widget", () => {
      let state = createNineZoneState();
      state = addFloatingWidget(state, "w1", [toolSettingsTabId]);
      state = produce(state, (draft) => {
        draft.toolSettings = {
          type: "widget",
        };
      });
      const newState = NineZoneStateReducer(state, {
        type: "TOOL_SETTINGS_DOCK",
      });
      newState.toolSettings.type.should.eq("docked");

      should().not.exist(newState.widgets.w1);
      should().not.exist(newState.floatingWidgets.byId.w1);
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

  describe("POPOUT_WIDGET_SEND_BACK", () => {
    it("should create multiple popout entries and then remove the last one (via reducer)", () => {
      let state = createNineZoneState({ size: { height: 1000, width: 1600 } });
      state = addTabs(state, ["t1", "ta", "tb"]);
      state = addPanelWidget(state, "right", "rightStart", ["t1", "ta", "tb"], { minimized: true });

      let newState = popoutWidgetToChildWindow(state, "t1", Rectangle.createFromSize({ height: 800, width: 600 }));
      expect(Object.entries(newState.popoutWidgets.byId).length).to.be.eql(1);
      const popoutWidgetContainerId1 = Object.keys(newState.popoutWidgets.byId)[0];

      newState = popoutWidgetToChildWindow(newState, "ta", Rectangle.createFromSize({ height: 800, width: 600 }));
      expect(Object.entries(newState.popoutWidgets.byId).length).to.be.eql(2);
      const popoutWidgetContainerId2 = Object.keys(newState.popoutWidgets.byId)[1];
      const latestState = NineZoneStateReducer(newState, {
        type: "POPOUT_WIDGET_SEND_BACK",
        id: popoutWidgetContainerId2,
      });
      expect(Object.entries(latestState.popoutWidgets.byId).length).to.be.eql(1);
      expect(Object.keys(latestState.popoutWidgets.byId)[0]).to.be.eql(popoutWidgetContainerId1);
    });

    it("should send back to proper start panel section via index and merge widgetTabs", () => {
      let state = createNineZoneState();
      state = addTabs(state, ["t1", "t2"]);
      state = addPanelWidget(state, "left", "leftStart", ["t1"]);
      state = addPopoutWidget(state, "fw1", ["t2"], {
        home: {
          side: "left",
          widgetId: undefined,
          widgetIndex: 0,
        },
      });
      const newState = NineZoneStateReducer(state, {
        type: "POPOUT_WIDGET_SEND_BACK",
        id: "fw1",
      });

      newState.panels.left.widgets.should.eql(["leftStart"]);
      newState.widgets.leftStart.tabs.should.eql(["t1", "t2"]);
      should().not.exist(newState.popoutWidgets.byId.fw1);
      newState.popoutWidgets.allIds.indexOf("fw1").should.eq(-1);
    });

    it("should send back to proper end panel section via index widgetId is undefined", () => {
      let state = createNineZoneState();
      state = addTabs(state, ["t1", "t2"]);
      state = addPanelWidget(state, "left", "leftStart", ["t1"]);
      state = addPopoutWidget(state, "fw1", ["t2"], {
        home: {
          side: "left",
          widgetId: undefined,
          widgetIndex: 1,
        },
      });
      const newState = NineZoneStateReducer(state, {
        type: "POPOUT_WIDGET_SEND_BACK",
        id: "fw1",
      });

      newState.panels.left.widgets.should.eql(["leftStart", "leftEnd"]);
      newState.widgets.leftStart.tabs.should.eql(["t1"]);
      newState.widgets.leftEnd.tabs.should.eql(["t2"]);
      should().not.exist(newState.popoutWidgets.byId.fw1);
      newState.popoutWidgets.allIds.indexOf("fw1").should.eq(-1);
    });

    it("should send back to proper start panel section via index widgetId is undefined", () => {
      let state = createNineZoneState();
      state = addTabs(state, ["t1", "t2"]);
      state = addPanelWidget(state, "left", "leftEnd", ["t1"]);
      state = addPopoutWidget(state, "fw1", ["t2"], {
        home: {
          side: "left",
          widgetId: undefined,
          widgetIndex: 0,
        },
      });
      const newState = NineZoneStateReducer(state, {
        type: "POPOUT_WIDGET_SEND_BACK",
        id: "fw1",
      });

      newState.panels.left.widgets.should.eql(["leftStart", "leftEnd"]);
      newState.widgets.leftEnd.tabs.should.eql(["t1"]);
      newState.widgets.leftStart.tabs.should.eql(["t2"]);
      should().not.exist(newState.popoutWidgets.byId.fw1);
      newState.popoutWidgets.allIds.indexOf("fw1").should.eq(-1);
    });

    it("should send back to a newly created widget container if the container no longer exists because all widget tabs were popped out", () => {
      let state = createNineZoneState();
      state = addTabs(state, ["t1", "t2"]);
      state = addPanelWidget(state, "left", "w2", ["t2"]);
      state = addPopoutWidget(state, "fw1", ["t1"], {
        home: {
          side: "left",
          widgetId: "w1",
          widgetIndex: 0,
        },
      });

      const newState = NineZoneStateReducer(state, {
        type: "POPOUT_WIDGET_SEND_BACK",
        id: "fw1",
      });

      newState.panels.left.widgets.should.eql(["w1", "w2"]);
      newState.widgets.w1.tabs.should.eql(["t1"]);
      newState.widgets.w2.tabs.should.eql(["t2"]);
      should().not.exist(newState.popoutWidgets.byId.fw1);
      newState.popoutWidgets.allIds.should.not.contain("fw1");
    });

    it("should insert to provided widgetIndex when maxWidgetCount is reached", () => {
      let state = createNineZoneState();
      state = addTabs(state, ["t1", "t2", "t3", "fwt1"]);
      state = addPanelWidget(state, "left", "leftStart", ["t1", "t2", "t3"]);
      state = addPopoutWidget(state, "fw1", ["fwt1"], {
        home: {
          side: "left",
          widgetId: undefined,
          widgetIndex: 1,
        },
      });
      const newState = NineZoneStateReducer(state, {
        type: "POPOUT_WIDGET_SEND_BACK",
        id: "fw1",
      });

      newState.panels.left.widgets.should.eql(["leftStart", "leftEnd"]);
      newState.widgets.leftStart.tabs.should.eql(["t1", "t2", "t3"]);
      newState.widgets.leftEnd.tabs.should.eql(["fwt1"]);
      should().not.exist(newState.popoutWidgets.byId.fw1);
      newState.popoutWidgets.allIds.indexOf("fw1").should.eq(-1);
      should().not.exist(newState.widgets.fw1);
    });

  });
});

describe("floatWidget", () => {
  it("should not update if already floating", () => {
    let state = createNineZoneState();
    state = addTabs(state, ["t1"]);
    state = addFloatingWidget(state, "fw1", ["t1"]);
    const newState = floatWidget(state, "t1");
    newState.should.eq(state);
  });

  it("should throw if tab does not exist", () => {
    let state = createNineZoneState({ size: { height: 1000, width: 1600 } });
    state = addTabs(state, ["t1", "t2"]);
    state = addPanelWidget(state, "right", "rightStart", ["t1"]);
    state = addPanelWidget(state, "right", "rightEnd", ["t2"]);

    (() => floatWidget(state, "t0")).should.throw();
  });

  it("should apply position and size", () => {
    let state = createNineZoneState({ size: { height: 1000, width: 1600 } });
    state = addTabs(state, ["t1", "t2"]);
    state = addPanelWidget(state, "right", "rightStart", ["t1"], { minimized: true });
    state = addPanelWidget(state, "right", "rightEnd", ["t2"]);

    const newState = floatWidget(state, "t1", { x: 55, y: 105 }, { height: 200, width: 200 });

    newState.floatingWidgets.allIds.should.length(1);
    const floatingWidgetContainerId = newState.floatingWidgets.allIds[0];
    newState.floatingWidgets.byId[floatingWidgetContainerId].bounds.should.eql({
      left: 55,
      top: 105,
      bottom: 105 + 200,
      right: 55 + 200,
    });
    newState.floatingWidgets.byId[floatingWidgetContainerId].home.should.eql({
      side: "right",
      widgetId: "rightStart",
      widgetIndex: 0,
    });

    // restore widget tab "t1" back to original "rightStart" location
    const dockedState = dockWidgetContainer(newState, "t1");
    dockedState.panels.right.widgets.should.eql(["rightStart", "rightEnd"]);
    dockedState.widgets.rightStart.tabs.should.eql(["t1"]);
  });

  it("should apply position and preferred size", () => {
    let state = createNineZoneState({ size: { height: 1000, width: 1600 } });
    state = addTab(state, "t1", { preferredFloatingWidgetSize: { height: 222, width: 222 } });
    state = addTab(state, "t2");
    state = addPanelWidget(state, "right", "rightStart", ["t1"], { minimized: true });
    state = addPanelWidget(state, "right", "rightEnd", ["t2"]);

    const newState = floatWidget(state, "t1", { x: 55, y: 105 });
    newState.floatingWidgets.allIds.should.length(1);
    const floatingWidgetContainerId = Object.keys(newState.floatingWidgets.byId)[0];
    newState.floatingWidgets.byId[floatingWidgetContainerId].bounds.should.eql({
      left: 55,
      top: 105,
      bottom: 105 + 222,
      right: 55 + 222,
    });
    newState.floatingWidgets.byId[floatingWidgetContainerId].home.should.eql({
      side: "right",
      widgetId: "rightStart",
      widgetIndex: 0,
    });

    // restore widget tab "t1" back to original "rightStart" location
    const dockedState = dockWidgetContainer(newState, "t1");
    dockedState.widgets.rightEnd.tabs.should.eql(["t2"]);
  });

  it("should apply default position {x:50, y:100} and size {height:400, width:400}", () => {
    let state = createNineZoneState({ size: { height: 1000, width: 1600 } });
    state = addTabs(state, ["t1", "t2"]);
    state = addPanelWidget(state, "right", "rightStart", ["t1"], { minimized: true });
    state = addPanelWidget(state, "right", "rightEnd", ["t2"]);

    const newState = floatWidget(state, "t1");

    Object.entries(newState.floatingWidgets.byId).should.length(1);
    const floatingWidgetContainerId = Object.keys(newState.floatingWidgets.byId)[0];
    newState.floatingWidgets.byId[floatingWidgetContainerId].bounds.should.eql({
      left: 50,
      top: 100,
      bottom: 100 + 400,
      right: 50 + 400,
    });
    newState.floatingWidgets.byId[floatingWidgetContainerId].home.should.eql({
      side: "right",
      widgetId: "rightStart",
      widgetIndex: 0,
    });

    // restore widget tab "t1" back to original "rightStart" location
    const dockedState = dockWidgetContainer(newState, "t1");
    dockedState.widgets.rightEnd.tabs.should.eql(["t2"]);
  });

  it("should apply position and default size of (400,400)", () => {
    let state = createNineZoneState({ size: { height: 1000, width: 1600 } });
    state = addTabs(state, ["t1", "t2"]);
    state = addPanelWidget(state, "right", "rightStart", ["t1"], { minimized: true });
    state = addPanelWidget(state, "right", "rightEnd", ["t2"]);

    const newState = floatWidget(state, "t1", { x: 55, y: 105 });
    Object.entries(newState.floatingWidgets.byId).should.length(1);
    const floatingWidgetContainerId = Object.keys(newState.floatingWidgets.byId)[0];
    newState.floatingWidgets.byId[floatingWidgetContainerId].bounds.should.eql({
      left: 55,
      top: 105,
      bottom: 105 + 400,
      right: 55 + 400,
    });
    newState.floatingWidgets.byId[floatingWidgetContainerId].home.should.eql({
      side: "right",
      widgetId: "rightStart",
      widgetIndex: 0,
    });

    // restore widget tab "t1" back to original "rightStart" location
    const dockedState = dockWidgetContainer(newState, "t1");
    dockedState.widgets.rightEnd.tabs.should.eql(["t2"]);
  });

  it("should properly handle multiple widget tabs", () => {
    let state = createNineZoneState({ size: { height: 1000, width: 1600 } });
    state = addTabs(state, ["t1", "t2", "ta", "tb"]);
    state = addPanelWidget(state, "right", "rightStart", ["t1", "ta", "tb"], { minimized: true });
    state = addPanelWidget(state, "right", "rightEnd", ["t2"]);

    const newState = floatWidget(state, "t1", { x: 55, y: 105 });
    newState.floatingWidgets.allIds.should.length(1);
    const floatingWidgetContainerId = newState.floatingWidgets.allIds[0];
    newState.floatingWidgets.byId[floatingWidgetContainerId].bounds.should.eql({
      left: 55,
      top: 105,
      bottom: 105 + 400,
      right: 55 + 400,
    });
    newState.floatingWidgets.byId[floatingWidgetContainerId].home.should.eql({
      side: "right",
      widgetId: "rightStart",
      widgetIndex: 0,
    });

    // Restore "t1" back to original "rightStart" location
    const dockedState = dockWidgetContainer(newState, "t1");
    dockedState.widgets.rightStart.tabs.should.contain("t1");
    dockedState.floatingWidgets.allIds.should.length(0);
  });

  it("should create popout entries with default size and location", () => {
    let state = createNineZoneState({ size: { height: 1000, width: 1600 } });
    state = addTabs(state, ["t1", "ta", "tb"]);
    state = addPanelWidget(state, "right", "rightStart", ["t1", "ta", "tb"], { minimized: true });
    const newState = popoutWidgetToChildWindow(state, "t1", Rectangle.createFromSize({ height: 800, width: 600 }));
    expect(Object.entries(newState.popoutWidgets.byId).length).to.be.eql(1);
    const popoutWidgetContainerId = Object.keys(newState.popoutWidgets.byId)[0];

    newState.popoutWidgets.byId[popoutWidgetContainerId].bounds.should.eql({
      left: 0,
      top: 0,
      bottom: 800,
      right: 600,
    });
  });

  it("should create popout entries with specified size and location", () => {
    let state = createNineZoneState({ size: { height: 1000, width: 1600 } });
    state = addTabs(state, ["t1", "ta", "tb"]);
    state = addPanelWidget(state, "right", "rightStart", ["t1", "ta", "tb"], { minimized: true });
    const newState = popoutWidgetToChildWindow(state, "t1", Rectangle.createFromSize({ width: 100, height: 200 }).offset({ x: 5, y: 10 }));
    expect(Object.entries(newState.popoutWidgets.byId).length).to.be.eql(1);
    const popoutWidgetContainerId = Object.keys(newState.popoutWidgets.byId)[0];

    newState.popoutWidgets.byId[popoutWidgetContainerId].bounds.should.eql({
      left: 5,
      top: 10,
      bottom: 10 + 200,
      right: 5 + 100,
    });
  });

  it("should create popout entries with specified size and location (given initial state with no popout data)", () => {
    let state = createNineZoneState({
      size: {
        height: 1000,
        width: 1600,
      },
    });
    state = addTabs(state, ["t1", "ta", "tb"]);
    state = addPanelWidget(state, "right", "rightStart", ["t1", "ta", "tb"], { minimized: true });

    const newState = popoutWidgetToChildWindow(state, "t1", Rectangle.createFromSize({ width: 100, height: 200 }).offset({ x: 5, y: 10 }));
    expect(Object.entries(newState.popoutWidgets.byId).length).to.be.eql(1);
    const popoutWidgetContainerId = Object.keys(newState.popoutWidgets.byId)[0];

    newState.popoutWidgets.byId[popoutWidgetContainerId].bounds.should.eql({
      left: 5,
      top: 10,
      bottom: 10 + 200,
      right: 5 + 100,
    });
  });

  it("should create multiple popout entries and then remove the last one (via function)", () => {
    let state = createNineZoneState({ size: { height: 1000, width: 1600 } });
    state = addTabs(state, ["t1", "ta", "tb"]);
    state = addPanelWidget(state, "right", "rightStart", ["t1", "ta", "tb"], { minimized: true });

    let newState = popoutWidgetToChildWindow(state, "t1", Rectangle.createFromSize({ height: 800, width: 600 }));
    expect(Object.entries(newState.popoutWidgets.byId).length).to.be.eql(1);
    const popoutWidgetContainerId1 = Object.keys(newState.popoutWidgets.byId)[0];

    newState = popoutWidgetToChildWindow(newState, "ta", Rectangle.createFromSize({ height: 800, width: 600 }));
    expect(Object.entries(newState.popoutWidgets.byId).length).to.be.eql(2);
    const popoutWidgetContainerId2 = Object.keys(newState.popoutWidgets.byId)[1];
    let latestState = dockWidgetContainer(newState, popoutWidgetContainerId2, true);
    expect(Object.entries(latestState.popoutWidgets.byId).length).to.be.eql(1);
    expect(Object.keys(latestState.popoutWidgets.byId)[0]).to.be.eql(popoutWidgetContainerId1);

    latestState = dockWidgetContainer(latestState, "t1", false);
    expect(Object.entries(latestState.popoutWidgets.byId).length).to.be.eql(0);
  });

  it("should create multiple popout entries and then convert them to floating", () => {
    let state = createNineZoneState({ size: { height: 1000, width: 1600 } });
    state = addTabs(state, ["t1", "ta", "tb"]);
    state = addPanelWidget(state, "right", "rightStart", ["t1", "ta", "tb"], { minimized: true });
    let newState = popoutWidgetToChildWindow(state, "t1", Rectangle.createFromSize({ height: 800, width: 600 }));
    expect(Object.entries(newState.popoutWidgets.byId).length).to.be.eql(1);
    newState = popoutWidgetToChildWindow(newState, "ta", Rectangle.createFromSize({ height: 800, width: 600 }));
    expect(Object.entries(newState.popoutWidgets.byId).length).to.be.eql(2);
    newState = convertAllPopupWidgetContainersToFloating(newState);
    expect(Object.entries(newState.popoutWidgets.byId).length).to.be.eql(0);
  });

  it("should create multiple popout entries and then convert one of them to floating", () => {
    let state = createNineZoneState({ size: { height: 1000, width: 1600 } });
    state = addTabs(state, ["t1", "ta", "tb"]);
    state = addPanelWidget(state, "right", "rightStart", ["t1", "ta", "tb"], { minimized: true });
    let newState = popoutWidgetToChildWindow(state, "t1", Rectangle.createFromSize({ height: 800, width: 600 }));
    expect(Object.entries(newState.popoutWidgets.byId).length).to.be.eql(1);
    const popoutWidgetContainerId1 = Object.keys(newState.popoutWidgets.byId)[0];
    newState = popoutWidgetToChildWindow(newState, "ta", Rectangle.createFromSize({ height: 800, width: 600 }));
    expect(Object.entries(newState.popoutWidgets.byId).length).to.be.eql(2);
    newState = convertPopoutWidgetContainerToFloating(newState, popoutWidgetContainerId1);
    expect(Object.entries(newState.popoutWidgets.byId).length).to.be.eql(1);

    newState = convertFloatingWidgetContainerToPopout(newState, popoutWidgetContainerId1);
    expect(Object.entries(newState.popoutWidgets.byId).length).to.be.eql(2);
  });

  it("should set and clear user sized setting for floating widgets", () => {
    let state = createNineZoneState({ size: { height: 1000, width: 1600 } });
    state = addTabs(state, ["t1"]);
    state = addFloatingWidget(state, "fw1", ["t1"], {
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
    newState.floatingWidgets.byId.fw1!.userSized?.should.eql(true);
    const newState2 = NineZoneStateReducer(newState, {
      type: "FLOATING_WIDGET_CLEAR_USER_SIZED",
      id: "fw1",
    });
    newState2.floatingWidgets.byId.fw1!.userSized?.should.eql(false);
  });
});

describe("dockWidgetContainer", () => {
  it("should throw if tab does not exist", () => {
    let state = createNineZoneState({ size: { height: 1000, width: 1600 } });
    state = addTabs(state, ["t1", "t2"]);
    state = addPanelWidget(state, "right", "rightStart", ["t1"]);
    state = addPanelWidget(state, "right", "rightEnd", ["t2"]);

    (() => dockWidgetContainer(state, "t0")).should.throw();
  });

  it("should send back to specified `left` panel widget via function call", () => {
    let state = createNineZoneState();
    state = addTabs(state, ["t1", "fwt1", "fwt2"]);
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    state = addFloatingWidget(state, "fw1", ["fwt1", "fwt2"], {
      home: {
        side: "left",
        widgetId: "w1",
        widgetIndex: 0,
      },
    });

    const newState = dockWidgetContainer(state, "fw1", true);
    newState.widgets.w1.tabs.should.eql(["t1", "fwt1", "fwt2"]);
    should().not.exist(newState.widgets.fw1);
    should().not.exist(newState.floatingWidgets.byId.fw1);
  });

  it("should send back to specified `left` panel widget via tabId and function call", () => {
    let state = createNineZoneState();
    state = addTabs(state, ["t1", "fwt1", "fwt2"]);
    state = addPanelWidget(state, "left", "w1", ["t1"]);
    state = addFloatingWidget(state, "fw1", ["fwt1", "fwt2"], {
      home: {
        side: "left",
        widgetId: "w1",
        widgetIndex: 0,
      },
    });

    const newState = dockWidgetContainer(state, "fwt1", false);
    newState.widgets.w1.tabs.should.eql(["t1", "fwt1", "fwt2"]);
    should().not.exist(newState.widgets.fw1);
    should().not.exist(newState.floatingWidgets.byId.fw1);
  });
});
