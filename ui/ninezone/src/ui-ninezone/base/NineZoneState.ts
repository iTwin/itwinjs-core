/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Base
 */

import { produce, castDraft, Draft } from "immer";
import { PanelSide, HorizontalPanelSide, VerticalPanelSide, isHorizontalPanelSide } from "../widget-panels/Panel";
import { RectangleProps, PointProps, Rectangle, Point } from "@bentley/ui-core";
import { assert } from "./assert";

/** @internal future */
export interface TabState {
  readonly id: string;
  readonly label: string;
}

/** @internal future */
export interface TabsState { readonly [id: string]: TabState; }

/** @internal future */
export interface WidgetState {
  readonly activeTabId: TabState["id"] | undefined;
  readonly id: string;
  readonly minimized: boolean;
  readonly tabs: ReadonlyArray<TabState["id"]>;
}

/** @internal future */
export interface FloatingWidgetState {
  readonly bounds: RectangleProps;
  readonly id: WidgetState["id"];
}

/** @internal future */
export interface DraggedTabState {
  readonly tabId: TabState["id"];
  readonly position: PointProps;
}

/** @internal future */
export interface WidgetsState { readonly [id: string]: WidgetState; }

/** @internal future */
export interface FloatingWidgetsState { readonly [id: string]: FloatingWidgetState | undefined; }

/** @internal future */
export interface TabTargetTabState {
  readonly widgetId: WidgetState["id"];
  readonly tabIndex: number;
  readonly type: "tab";
}

/** @internal future */
export interface TabTargetPanelState {
  readonly side: PanelSide;
  readonly newWidgetId: WidgetState["id"];
  readonly type: "panel";
}

/** @internal future */
export interface TabTargetWidgetState {
  readonly side: PanelSide;
  readonly newWidgetId: WidgetState["id"];
  readonly widgetIndex: number;
  readonly type: "widget";
}

/** @internal future */
export interface TabTargetFloatingWidgetState {
  readonly type: "floatingWidget";
  readonly newFloatingWidgetId: FloatingWidgetState["id"];
}

/** @internal future */
export type TabTargetState = TabTargetPanelState | TabTargetWidgetState | TabTargetTabState | TabTargetFloatingWidgetState;

/** @internal future */
export type WidgetTargetState = TabTargetPanelState | TabTargetWidgetState | TabTargetTabState;

/** @internal future */
export interface PanelsState {
  readonly bottom: HorizontalPanelState;
  readonly left: VerticalPanelState;
  readonly right: VerticalPanelState;
  readonly top: HorizontalPanelState;
}

/** @internal future */
export interface PanelState {
  readonly collapseOffset: number;
  readonly collapsed: boolean;
  readonly maxSize: number;
  readonly minSize: number;
  readonly pinned: boolean;
  readonly side: PanelSide;
  readonly size: number | undefined;
  readonly widgets: ReadonlyArray<WidgetState["id"]>;
}

/** @internal future */
export interface HorizontalPanelState extends PanelState {
  readonly span: boolean;
  readonly side: HorizontalPanelSide;
}

/** @internal future */
export interface VerticalPanelState extends PanelState {
  readonly side: VerticalPanelSide;
}

/** @internal future */
export interface NineZoneState {
  readonly draggedTab: DraggedTabState | undefined;
  readonly floatingWidgets: FloatingWidgetsState;
  readonly panels: PanelsState;
  readonly tabs: TabsState;
  readonly widgets: WidgetsState;
}

/** @internal future */
export const PANEL_TOGGLE_COLLAPSED = "PANEL_TOGGLE_COLLAPSED";
/** @internal future */
export const PANEL_TOGGLE_SPAN = "PANEL_TOGGLE_SPAN";
/** @internal future */
export const PANEL_TOGGLE_PINNED = "PANEL_TOGGLE_PINNED";
/** @internal future */
export const PANEL_RESIZE = "PANEL_RESIZE";
/** @internal future */
export const PANEL_INITIALIZE = "PANEL_INITIALIZE";
/** @internal future */
export const FLOATING_WIDGET_RESIZE = "FLOATING_WIDGET_RESIZE";
/** @internal future */
export const PANEL_WIDGET_DRAG_START = "PANEL_WIDGET_DRAG_START";
/** @internal future */
export const WIDGET_DRAG = "WIDGET_DRAG";
/** @internal future */
export const WIDGET_DRAG_END = "WIDGET_DRAG_END";
/** @internal future */
export const WIDGET_TAB_CLICK = "WIDGET_TAB_CLICK";
/** @internal future */
export const WIDGET_TAB_DOUBLE_CLICK = "WIDGET_TAB_DOUBLE_CLICK";
/** @internal future */
export const WIDGET_TAB_DRAG_START = "WIDGET_TAB_DRAG_START";
/** @internal future */
export const WIDGET_TAB_DRAG = "WIDGET_TAB_DRAG";
/** @internal future */
export const WIDGET_TAB_DRAG_END = "WIDGET_TAB_DRAG_END";

/** @internal future */
export interface PanelToggleCollapsedAction {
  readonly type: typeof PANEL_TOGGLE_COLLAPSED;
  readonly side: PanelSide;
}

/** @internal future */
export interface PanelToggleSpanAction {
  readonly type: typeof PANEL_TOGGLE_SPAN;
  readonly side: HorizontalPanelSide;
}

/** @internal future */
export interface PanelTogglePinnedAction {
  readonly type: typeof PANEL_TOGGLE_PINNED;
  readonly side: PanelSide;
}

/** @internal future */
export interface PanelResizeAction {
  readonly type: typeof PANEL_RESIZE;
  readonly side: PanelSide;
  readonly resizeBy: number;
}

/** @internal future */
export interface PanelInitializeAction {
  readonly type: typeof PANEL_INITIALIZE;
  readonly side: PanelSide;
  readonly size: number;
}

/** @internal future */
export interface FloatingWidgetResizeAction {
  readonly type: typeof FLOATING_WIDGET_RESIZE;
  readonly id: FloatingWidgetState["id"];
  readonly resizeBy: RectangleProps;
}

/** @internal future */
export interface PanelWidgetDragStartAction {
  readonly type: typeof PANEL_WIDGET_DRAG_START;
  readonly newFloatingWidgetId: FloatingWidgetState["id"];
  readonly id: WidgetState["id"];
  readonly bounds: RectangleProps;
  readonly side: PanelSide;
}

/** @internal future */
export interface WidgetDragAction {
  readonly type: typeof WIDGET_DRAG;
  readonly dragBy: PointProps;
  readonly floatingWidgetId: FloatingWidgetState["id"];
}

/** @internal future */
export interface WidgetDragEndAction {
  readonly type: typeof WIDGET_DRAG_END;
  readonly floatingWidgetId: FloatingWidgetState["id"];
  readonly target: WidgetTargetState | undefined;
}

/** @internal future */
export interface WidgetTabClickAction {
  readonly type: typeof WIDGET_TAB_CLICK;
  readonly side: PanelSide | undefined;
  readonly widgetId: WidgetState["id"];
  readonly id: TabState["id"];
}

/** @internal future */
export interface WidgetTabDoubleClickAction {
  readonly type: typeof WIDGET_TAB_DOUBLE_CLICK;
  readonly side: PanelSide | undefined;
  readonly widgetId: WidgetState["id"];
  readonly floatingWidgetId: FloatingWidgetState["id"] | undefined;
  readonly id: TabState["id"];
}

/** @internal future */
export interface WidgetTabDragStartAction {
  readonly type: typeof WIDGET_TAB_DRAG_START;
  readonly side: PanelSide | undefined;
  readonly widgetId: WidgetState["id"];
  readonly floatingWidgetId: FloatingWidgetState["id"] | undefined;
  readonly id: TabState["id"];
  readonly position: PointProps;
}

/** @internal future */
export interface WidgetTabDragAction {
  readonly type: typeof WIDGET_TAB_DRAG;
  readonly dragBy: PointProps;
}

/** @internal future */
export interface WidgetTabDragEndAction {
  readonly type: typeof WIDGET_TAB_DRAG_END;
  readonly id: TabState["id"];
  readonly target: TabTargetState;
}

/** @internal future */
export type NineZoneActionTypes =
  PanelToggleCollapsedAction |
  PanelToggleSpanAction |
  PanelTogglePinnedAction |
  PanelResizeAction |
  PanelInitializeAction |
  FloatingWidgetResizeAction |
  PanelWidgetDragStartAction |
  WidgetDragAction |
  WidgetDragEndAction |
  WidgetTabClickAction |
  WidgetTabDoubleClickAction |
  WidgetTabDragStartAction |
  WidgetTabDragAction |
  WidgetTabDragEndAction;

/** @internal future */
export const NineZoneStateReducer: (state: NineZoneState, action: NineZoneActionTypes) => NineZoneState = produce(( // tslint:disable-line: variable-name
  state: Draft<NineZoneState>,
  action: NineZoneActionTypes,
) => {
  switch (action.type) {
    case PANEL_TOGGLE_COLLAPSED: {
      const panel = state.panels[action.side];
      state.panels[action.side].collapsed = !panel.collapsed;
      return;
    }
    case PANEL_TOGGLE_SPAN: {
      const panel = state.panels[action.side];
      state.panels[action.side].span = !panel.span;
      return;
    }
    case PANEL_TOGGLE_PINNED: {
      const panel = state.panels[action.side];
      state.panels[action.side].pinned = !panel.pinned;
      return;
    }
    case PANEL_RESIZE: {
      const panel = state.panels[action.side];
      if (panel.size === undefined)
        return;

      const requestedSize = panel.size + action.resizeBy;
      if (panel.collapsed) {
        if (action.resizeBy >= panel.collapseOffset) {
          state.panels[action.side].collapsed = false;
          return;
        }
        return;
      }

      const collapseThreshold = Math.max(panel.minSize - panel.collapseOffset, 0);
      if (requestedSize <= collapseThreshold) {
        state.panels[action.side].collapsed = true;
        state.panels[action.side].size = panel.minSize;
        return;
      }

      const size = Math.min(Math.max(requestedSize, panel.minSize), panel.maxSize);
      state.panels[action.side].size = size;
      return;
    }
    case PANEL_INITIALIZE: {
      const panel = state.panels[action.side];
      const newSize = Math.min(Math.max(action.size, panel.minSize), panel.maxSize);
      state.panels[action.side].size = newSize;
      return;
    }
    case PANEL_WIDGET_DRAG_START: {
      state.floatingWidgets[action.newFloatingWidgetId] = {
        bounds: action.bounds,
        id: action.newFloatingWidgetId,
      };
      state.widgets[action.newFloatingWidgetId] = state.widgets[action.id];
      state.widgets[action.newFloatingWidgetId].id = action.newFloatingWidgetId;
      delete state.widgets[action.id];

      const panel = state.panels[action.side];
      const widgetIndex = panel.widgets.indexOf(action.id);
      panel.widgets.splice(widgetIndex, 1);
      return;
    }
    case WIDGET_DRAG: {
      const floatingWidget = state.floatingWidgets[action.floatingWidgetId];
      assert(floatingWidget);
      const newBounds = Rectangle.create(floatingWidget.bounds).offset(action.dragBy);
      setRectangleProps(floatingWidget.bounds, newBounds);
      return;
    }
    case WIDGET_DRAG_END: {
      const target = action.target;
      if (!target)
        return;
      const draggedWidget = state.widgets[action.floatingWidgetId];
      if (isTabTargetTabState(target)) {
        const targetWidget = state.widgets[target.widgetId];
        targetWidget.tabs.splice(target.tabIndex, 0, ...draggedWidget.tabs);
      } else if (isTabTargetWidgetState(target)) {
        state.panels[target.side].widgets.splice(target.widgetIndex, 0, target.newWidgetId);
        state.widgets[target.newWidgetId] = {
          activeTabId: undefined,
          id: target.newWidgetId,
          minimized: false,
          tabs: draggedWidget.tabs,
        };
      } else {
        state.panels[target.side].widgets = [target.newWidgetId];
        state.widgets[target.newWidgetId] = {
          activeTabId: undefined,
          id: target.newWidgetId,
          minimized: false,
          tabs: draggedWidget.tabs,
        };
      }
      delete state.widgets[action.floatingWidgetId];
      delete state.floatingWidgets[action.floatingWidgetId];
      return;
    }
    case FLOATING_WIDGET_RESIZE: {
      const { resizeBy } = action;
      const floatingWidget = state.floatingWidgets[action.id];
      assert(floatingWidget);
      const bounds = Rectangle.create(floatingWidget.bounds);
      const newBounds = bounds.inset(-resizeBy.left, -resizeBy.top, -resizeBy.right, -resizeBy.bottom);
      setRectangleProps(floatingWidget.bounds, newBounds);
      return;
    }
    case WIDGET_TAB_CLICK: {
      const panel = action.side ? state.panels[action.side] : undefined;
      const widget = state.widgets[action.widgetId];
      const active = action.id === widget.activeTabId;

      state.widgets[widget.id].activeTabId = action.id;
      if (widget.minimized) {
        state.widgets[widget.id].minimized = false;
        return;
      }

      if (active && panel) {
        for (const wId of panel.widgets) {
          const w = state.widgets[wId];
          w.minimized = true;
        }
        widget.minimized = false;
      }
      return;
    }
    case WIDGET_TAB_DOUBLE_CLICK: {
      const panel = action.side ? state.panels[action.side] : undefined;
      const widget = state.widgets[action.widgetId];
      const active = action.id === widget.activeTabId;
      const panelWidgets = panel?.widgets || [];
      const maximized = panelWidgets.filter((wId) => {
        return !state.widgets[wId].minimized;
      }, 0);
      if (widget.minimized) {
        widget.activeTabId = action.id;
        for (const wId of panelWidgets) {
          const w = state.widgets[wId];
          w.minimized = w.id !== widget.id;
        }
        return;
      }
      if (!active) {
        widget.activeTabId = action.id;
        return;
      }
      if (maximized.length > 1)
        widget.minimized = true;
      if (action.floatingWidgetId !== undefined)
        widget.minimized = true;
      return;
    }
    case WIDGET_TAB_DRAG_START: {
      const tabId = action.id;
      state.draggedTab = {
        tabId,
        position: action.position,
      };
      const tabs = state.widgets[action.widgetId].tabs;
      const index = tabs.indexOf(action.id);
      if (index < 0)
        return;

      tabs.splice(index, 1);
      if (tabs.length === 0) {
        if (action.floatingWidgetId !== undefined) {
          delete state.floatingWidgets[action.floatingWidgetId];
        }
        if (action.side) {
          const widgets = state.panels[action.side].widgets;
          const widgetIndex = widgets.indexOf(action.widgetId);
          widgets.splice(widgetIndex, 1);
        }
      }
      return;
    }
    case WIDGET_TAB_DRAG: {
      const draggedTab = state.draggedTab;
      assert(draggedTab);
      const newPosition = Point.create(draggedTab.position).offset(action.dragBy);
      setPointProps(draggedTab.position, newPosition);
      return;
    }
    case WIDGET_TAB_DRAG_END: {
      assert(state.draggedTab);
      const target = action.target;
      if (isTabTargetTabState(target)) {
        state.widgets[target.widgetId].tabs.splice(target.tabIndex, 0, action.id);
      } else if (isTabTargetPanelState(target)) {
        state.panels[target.side].widgets.push(target.newWidgetId);
        state.widgets[target.newWidgetId] = {
          activeTabId: undefined,
          id: target.newWidgetId,
          minimized: false,
          tabs: [action.id],
        };
      } else if (isTabTargetWidgetState(target)) {
        state.panels[target.side].widgets.splice(target.widgetIndex, 0, target.newWidgetId);
        state.widgets[target.newWidgetId] = {
          activeTabId: undefined,
          id: target.newWidgetId,
          minimized: false,
          tabs: [action.id],
        };
      } else {
        state.floatingWidgets[target.newFloatingWidgetId] = {
          bounds: Rectangle.createFromSize({ height: 200, width: 200 }).offset(state.draggedTab.position).toProps(),
          id: target.newFloatingWidgetId,
        };
        state.widgets[target.newFloatingWidgetId] = {
          activeTabId: action.id,
          id: target.newFloatingWidgetId,
          minimized: false,
          tabs: [action.id],
        };
      }
      state.draggedTab = undefined;
      return;
    }
  }
});

/** @internal */
export function createPanelsState(): PanelsState {
  return {
    bottom: createHorizontalPanelState("bottom"),
    left: createVerticalPanelState("left"),
    right: createVerticalPanelState("right"),
    top: createHorizontalPanelState("top"),
  };
}

/** @internal future */
export function createNineZoneState(): NineZoneState {
  return {
    draggedTab: undefined,
    floatingWidgets: {},
    panels: createPanelsState(),
    widgets: {},
    tabs: {},
  };
}

/** @internal */
export function createWidgetState(id: WidgetState["id"]): WidgetState {
  return {
    activeTabId: undefined,
    id,
    minimized: false,
    tabs: [],
  };
}

/** @internal */
export function createTabState(id: TabState["id"]): TabState {
  return {
    id,
    label: "",
  };
}

/** @internal */
export function addPanelWidget(state: NineZoneState, side: PanelSide, id: WidgetState["id"], widgetArgs?: Partial<WidgetState>): NineZoneState {
  const widget = {
    ...createWidgetState(id),
    ...widgetArgs,
  };
  return produce(state, (stateDraft) => {
    stateDraft.widgets[widget.id] = castDraft(widget);
    stateDraft.panels[side].widgets.push(widget.id);
  });
}

/** @internal */
export function addTab(state: NineZoneState, widgetId: WidgetState["id"], id: TabState["id"], tabArgs?: Partial<TabState>): NineZoneState {
  const tab = {
    ...createTabState(id),
    ...tabArgs,
  };
  return produce(state, (stateDraft) => {
    stateDraft.widgets[widgetId].tabs.push(tab.id);
    stateDraft.tabs[id] = tab;
  });
}

/** @internal */
export function createPanelState(side: PanelSide): PanelState {
  return {
    collapseOffset: 100,
    collapsed: false,
    maxSize: 600,
    minSize: 200,
    pinned: true,
    side,
    size: undefined,
    widgets: [],
  };
}

/** @internal */
export function createVerticalPanelState(side: VerticalPanelSide): VerticalPanelState {
  return {
    ...createPanelState(side),
    side,
  };
}

/** @internal */
export function createHorizontalPanelState(side: HorizontalPanelSide): HorizontalPanelState {
  return {
    ...createPanelState(side),
    side,
    span: true,
  };
}

/** @internal */
export function isTabTargetTabState(state: TabTargetState): state is TabTargetTabState {
  return state.type === "tab";
}

/** @internal */
export function isTabTargetPanelState(state: TabTargetState): state is TabTargetPanelState {
  return state.type === "panel";
}

/** @internal */
export function isTabTargetWidgetState(state: TabTargetState): state is TabTargetWidgetState {
  return state.type === "widget";
}

/** @internal */
export function isHorizontalPanelState(state: PanelState): state is HorizontalPanelState {
  return isHorizontalPanelSide(state.side);
}

function setRectangleProps(props: Draft<RectangleProps>, bounds: RectangleProps) {
  props.left = bounds.left;
  props.right = bounds.right;
  props.top = bounds.top;
  props.bottom = bounds.bottom;
}

function setPointProps(props: Draft<PointProps>, point: PointProps) {
  props.x = point.x;
  props.y = point.y;
}
