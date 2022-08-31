/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Base
 */

// Cspell:ignore popout
import { produce } from "immer";
import { PointProps, UiError } from "@itwin/appui-abstract";
import { Point, Rectangle, RectangleProps, SizeProps } from "@itwin/core-react";
import { HorizontalPanelSide, isHorizontalPanelSide, PanelSide, VerticalPanelSide } from "../widget-panels/Panel";
import { assert } from "@itwin/core-bentley";
import {
  addWidgetState, category, createDraggedTabState, createFloatingWidgetState, createPanelsState, createPopoutWidgetState, createTabsState, floatingWidgetBringToFront,
  floatingWidgetClearUserSizedFlag, initSizeProps, isToolSettingsFloatingWidget, removeFloatingWidget, removePanelWidget, removeWidget, setPointProps, setRectangleProps,
  setSizeProps, setWidgetActiveTabId, updateFloatingWidgetState, updateHomeOfToolSettingsWidget, updatePanelState, updateWidgetState,
} from "./internal";
import { TabState } from "./TabState";
import { findTab } from "./TabLocation";
import { findWidget, isPanelWidgetLocation } from "./WidgetLocation";
import { WidgetState } from "./WidgetState";

/** @internal */
export const toolSettingsTabId = "nz-tool-settings-tab";

/** @internal */
export interface TabsState { readonly [id: string]: TabState }

/** @internal */
export interface FloatingWidgetState {
  readonly bounds: RectangleProps;
  readonly id: WidgetState["id"];
  readonly home: FloatingWidgetHomeState;
  readonly userSized?: boolean;
  readonly hidden?: boolean;
}

/** @internal */
export interface PopoutWidgetState {
  readonly bounds: RectangleProps;
  readonly id: WidgetState["id"];
  // TODO: popout widget home could also be a floating widget.
  readonly home: FloatingWidgetHomeState;
}

/** @internal */
export interface FloatingWidgetHomeState {
  readonly widgetIndex: number;
  readonly widgetId: WidgetState["id"] | undefined;
  readonly side: PanelSide;
}

/** @internal */
export interface DraggedTabState {
  readonly tabId: TabState["id"];
  readonly position: PointProps;
  readonly home: FloatingWidgetHomeState;
}

/** @internal */
export interface WidgetsState { readonly [id: string]: WidgetState }

/** @internal */
export interface FloatingWidgetsState {
  readonly byId: { readonly [id: string]: FloatingWidgetState };
  readonly allIds: ReadonlyArray<FloatingWidgetState["id"]>;
}

/** @internal */
export interface PopoutWidgetsState {
  readonly byId: { readonly [id: string]: PopoutWidgetState };
  readonly allIds: ReadonlyArray<PopoutWidgetState["id"]>;
}

/** @internal */
export interface TabDropTargetState {
  readonly widgetId: WidgetState["id"];
  readonly tabIndex: number;
  readonly type: "tab";
}

/** @internal */
export interface WidgetDropTargetState {
  readonly widgetId: WidgetState["id"];
  readonly type: "widget";
}

/** @internal */
export interface PanelDropTargetState {
  readonly side: PanelSide;
  readonly newWidgetId: WidgetState["id"];
  readonly type: "panel";
}

/** @internal */
export interface SectionDropTargetState {
  readonly side: PanelSide;
  readonly newWidgetId: WidgetState["id"];
  readonly sectionIndex: number;
  readonly type: "section";
}

/** @internal */
export interface FloatingWidgetDropTargetState {
  readonly type: "floatingWidget";
  readonly newFloatingWidgetId: FloatingWidgetState["id"];
  readonly size: SizeProps;
}

/** Drop target of a tab drag action.
 * @internal
 */
export type TabDragDropTargetState = PanelDropTargetState | SectionDropTargetState | WidgetDropTargetState | TabDropTargetState | FloatingWidgetDropTargetState;

/** Default drop target, when nothing is targeted.
 * @internal
 */
export interface WindowDropTargetState {
  readonly type: "window";
}

/** Drop target of a widget drag action.
 * @internal
 */
export type WidgetDragDropTargetState = PanelDropTargetState | SectionDropTargetState | WidgetDropTargetState | TabDropTargetState | WindowDropTargetState;

/** @internal */
export type DropTargetState = TabDragDropTargetState | WidgetDragDropTargetState;

/** @internal */
export interface PanelsState {
  readonly bottom: HorizontalPanelState;
  readonly left: VerticalPanelState;
  readonly right: VerticalPanelState;
  readonly top: HorizontalPanelState;
}

/** @internal */
export interface PanelState {
  readonly collapseOffset: number;
  readonly collapsed: boolean;
  readonly maxSize: number;
  readonly minSize: number;
  readonly pinned: boolean;
  readonly resizable: boolean;
  readonly side: PanelSide;
  readonly size: number | undefined;
  readonly widgets: ReadonlyArray<WidgetState["id"]>;
  readonly maxWidgetCount: number;
  readonly splitterPercent: number | undefined;  // default to 50
}

/** @internal */
export interface HorizontalPanelState extends PanelState {
  readonly span: boolean;
  readonly side: HorizontalPanelSide;
}

/** @internal */
export interface VerticalPanelState extends PanelState {
  readonly side: VerticalPanelSide;
}

/** @internal */
export interface DockedToolSettingsState {
  readonly type: "docked";
}

/** @internal */
export interface WidgetToolSettingsState {
  readonly type: "widget";
}

/** @internal */
export type ToolSettingsState = DockedToolSettingsState | WidgetToolSettingsState;

/** @internal */
export interface NineZoneState {
  readonly draggedTab: DraggedTabState | undefined;
  readonly floatingWidgets: FloatingWidgetsState;
  readonly popoutWidgets: PopoutWidgetsState;
  readonly panels: PanelsState;
  readonly tabs: TabsState;
  readonly toolSettings: ToolSettingsState;
  readonly widgets: WidgetsState;
  readonly size: SizeProps;
}

/** @internal */
export interface ResizeAction {
  readonly type: "RESIZE";
  readonly size: SizeProps;
}

/** @internal */
export interface PanelToggleCollapsedAction {
  readonly type: "PANEL_TOGGLE_COLLAPSED";
  readonly side: PanelSide;
}

/** @internal */
export interface PanelSetCollapsedAction {
  readonly type: "PANEL_SET_COLLAPSED";
  readonly collapsed: boolean;
  readonly side: PanelSide;
}

/** @internal */
export interface PanelSetSizeAction {
  readonly type: "PANEL_SET_SIZE";
  readonly side: PanelSide;
  readonly size: number;
}

/** @internal */
export interface PanelSetSplitterPercentAction {
  readonly type: "PANEL_SET_SPLITTER_VALUE";
  readonly side: PanelSide;
  readonly percent: number;
}

/** @internal */
export interface PanelToggleSpanAction {
  readonly type: "PANEL_TOGGLE_SPAN";
  readonly side: HorizontalPanelSide;
}

/** @internal */
export interface PanelTogglePinnedAction {
  readonly type: "PANEL_TOGGLE_PINNED";
  readonly side: PanelSide;
}

/** @internal */
export interface PanelInitializeAction {
  readonly type: "PANEL_INITIALIZE";
  readonly side: PanelSide;
  readonly size: number;
}

/** @internal */
export interface FloatingWidgetResizeAction {
  readonly type: "FLOATING_WIDGET_RESIZE";
  readonly id: FloatingWidgetState["id"];
  readonly resizeBy: RectangleProps;
}

/** @internal */
export interface FloatingWidgetSetBoundsAction {
  readonly type: "FLOATING_WIDGET_SET_BOUNDS";
  readonly id: FloatingWidgetState["id"];
  readonly bounds: RectangleProps;
}

/** @internal */
export interface FloatingWidgetBringToFrontAction {
  readonly type: "FLOATING_WIDGET_BRING_TO_FRONT";
  readonly id: FloatingWidgetState["id"];
}

/** @internal */
export interface FloatingWidgetClearUserSizedAction {
  readonly type: "FLOATING_WIDGET_CLEAR_USER_SIZED";
  readonly id: FloatingWidgetState["id"];
}

/** @internal */
export interface FloatingWidgetSendBackAction {
  readonly type: "FLOATING_WIDGET_SEND_BACK";
  readonly id: FloatingWidgetState["id"];
}

/** @internal */
export interface PopoutWidgetSendBackAction {
  readonly type: "POPOUT_WIDGET_SEND_BACK";
  readonly id: PopoutWidgetState["id"];
}

/** @internal */
export interface PanelWidgetDragStartAction {
  readonly type: "PANEL_WIDGET_DRAG_START";
  readonly newFloatingWidgetId: FloatingWidgetState["id"];
  readonly id: WidgetState["id"];
  readonly bounds: RectangleProps;
  readonly side: PanelSide;
  readonly userSized?: boolean;
}

/** @internal */
export interface WidgetDragAction {
  readonly type: "WIDGET_DRAG";
  readonly dragBy: PointProps;
  readonly floatingWidgetId: FloatingWidgetState["id"];
}

/** @internal */
export interface WidgetDragEndAction {
  readonly type: "WIDGET_DRAG_END";
  readonly floatingWidgetId: FloatingWidgetState["id"];
  readonly target: WidgetDragDropTargetState;
}

/** @internal */
export interface WidgetTabClickAction {
  readonly type: "WIDGET_TAB_CLICK";
  readonly side: PanelSide | undefined;
  readonly widgetId: WidgetState["id"];
  readonly id: TabState["id"];
}

/** @internal */
export interface WidgetTabDoubleClickAction {
  readonly type: "WIDGET_TAB_DOUBLE_CLICK";
  readonly side: PanelSide | undefined;
  readonly widgetId: WidgetState["id"];
  readonly floatingWidgetId: FloatingWidgetState["id"] | undefined;
  readonly id: TabState["id"];
}

/** @internal */
export interface WidgetTabPopoutAction {
  readonly type: "WIDGET_TAB_POPOUT";
  readonly id: WidgetState["activeTabId"];
}

/** @internal */
export interface WidgetTabDragStartAction {
  readonly type: "WIDGET_TAB_DRAG_START";
  readonly side: PanelSide | undefined;
  readonly widgetId: WidgetState["id"];
  readonly floatingWidgetId: FloatingWidgetState["id"] | undefined;
  readonly id: TabState["id"];
  readonly position: PointProps;
  readonly userSized?: boolean;
}

/** @internal */
export interface WidgetTabDragAction {
  readonly type: "WIDGET_TAB_DRAG";
  readonly dragBy: PointProps;
}

/** @internal */
export interface WidgetTabDragEndAction {
  readonly type: "WIDGET_TAB_DRAG_END";
  readonly id: TabState["id"];
  readonly target: TabDragDropTargetState;
}

/** @internal */
export interface ToolSettingsDragStartAction {
  readonly type: "TOOL_SETTINGS_DRAG_START";
  readonly newFloatingWidgetId: FloatingWidgetState["id"];
}

/** @internal */
export interface ToolSettingsDockAction {
  readonly type: "TOOL_SETTINGS_DOCK";
}

/** @internal */
export type NineZoneAction =
  ResizeAction |
  PanelToggleCollapsedAction |
  PanelSetCollapsedAction |
  PanelSetSizeAction |
  PanelSetSplitterPercentAction |
  PanelToggleSpanAction |
  PanelTogglePinnedAction |
  PanelInitializeAction |
  FloatingWidgetResizeAction |
  FloatingWidgetSetBoundsAction |
  FloatingWidgetBringToFrontAction |
  FloatingWidgetSendBackAction |
  FloatingWidgetClearUserSizedAction |
  PopoutWidgetSendBackAction |
  PanelWidgetDragStartAction |
  WidgetDragAction |
  WidgetDragEndAction |
  WidgetTabClickAction |
  WidgetTabDoubleClickAction |
  WidgetTabDragStartAction |
  WidgetTabDragAction |
  WidgetTabDragEndAction |
  WidgetTabPopoutAction |
  ToolSettingsDragStartAction |
  ToolSettingsDockAction;

/** @internal */
export function NineZoneStateReducer(state: NineZoneState, action: NineZoneAction): NineZoneState {
  switch (action.type) {
    case "RESIZE": {
      state = produce(state, (draft) => {
        setSizeProps(draft.size, action.size);
      });
      const nzBounds = Rectangle.createFromSize(action.size);
      for (const id of state.floatingWidgets.allIds) {
        const floatingWidget = state.floatingWidgets.byId[id];
        const bounds = Rectangle.create(floatingWidget.bounds);
        const containedBounds = bounds.containIn(nzBounds);
        state = updateFloatingWidgetState(state, id, {
          bounds: containedBounds.toProps(),
        });
      }
      return state;
    }
    case "PANEL_TOGGLE_COLLAPSED": {
      const { side } = action;
      const panel = state.panels[side];
      const collapsed = !panel.collapsed;
      return updatePanelState(state, action.side, {
        collapsed,
      });
    }
    case "PANEL_SET_COLLAPSED": {
      const { side, collapsed } = action;
      return updatePanelState(state, side, {
        collapsed,
      });
    }
    case "PANEL_SET_SIZE": {
      const panel = state.panels[action.side];
      const size = Math.min(Math.max(action.size, panel.minSize), panel.maxSize);
      return updatePanelState(state, action.side, {
        size,
      });
    }
    case "PANEL_SET_SPLITTER_VALUE": {
      const splitterPercent = Math.min(Math.max(action.percent, 0), 100);
      return updatePanelState(state, action.side, {
        splitterPercent,
      });
    }
    case "PANEL_TOGGLE_SPAN": {
      const { side } = action;
      const panel = state.panels[side];
      const span = !panel.span;
      return updatePanelState(state, side, {
        span,
      });
    }
    case "PANEL_TOGGLE_PINNED": {
      const { side } = action;
      const panel = state.panels[side];
      const pinned = !panel.pinned;
      return updatePanelState(state, side, {
        pinned,
      });
    }
    case "PANEL_INITIALIZE": {
      const { side } = action;
      const panel = state.panels[action.side];
      const size = Math.min(Math.max(action.size, panel.minSize), panel.maxSize);
      return updatePanelState(state, side, {
        size,
      });
    }
    case "PANEL_WIDGET_DRAG_START": {
      const { side, newFloatingWidgetId } = action;
      const panel = state.panels[side];
      const widgetIndex = panel.widgets.indexOf(action.id);
      const widget = state.widgets[action.id];

      state = removePanelWidget(state, action.id);
      return addFloatingWidget(state, newFloatingWidgetId, widget.tabs, {
        bounds: Rectangle.create(action.bounds).toProps(),
        userSized: action.userSized,
        id: action.newFloatingWidgetId,
        home: {
          side: action.side,
          widgetId: undefined,
          widgetIndex,
        },
      }, {
        ...widget,
        minimized: false,
      });
    }
    case "WIDGET_DRAG": {
      const { floatingWidgetId, dragBy } = action;
      const floatingWidget = state.floatingWidgets.byId[floatingWidgetId];
      const newBounds = Rectangle.create(floatingWidget.bounds).offset(dragBy);
      return updateFloatingWidgetState(state, floatingWidgetId, {
        bounds: newBounds.toProps(),
      });
    }
    case "WIDGET_DRAG_END": {
      // TODO: handle duplicates in WIDGET_TAB_DRAG_END action
      const { target, floatingWidgetId } = action;
      const floatingWidget = state.floatingWidgets.byId[floatingWidgetId];
      const draggedWidget = state.widgets[floatingWidgetId];

      if (isWindowDropTargetState(target)) {
        const nzBounds = Rectangle.createFromSize(state.size);
        let newBounds = Rectangle.create(floatingWidget.bounds);
        if (draggedWidget.minimized) {
          const containedBounds = newBounds.setHeight(35).containIn(nzBounds);
          newBounds = newBounds.setPosition(containedBounds.topLeft());
        } else {
          newBounds = newBounds.containIn(nzBounds);
        }
        state = updateFloatingWidgetState(state, floatingWidgetId, {
          bounds: newBounds.toProps(),
        });
        return floatingWidgetBringToFront(state, floatingWidgetId);
      }

      state = removeFloatingWidget(state, floatingWidgetId);
      if (isTabDropTargetState(target)) {
        state = updateHomeOfToolSettingsWidget(state, target.widgetId, floatingWidget.home);
        const targetWidget = state.widgets[target.widgetId];
        const tabs = [...targetWidget.tabs];
        tabs.splice(target.tabIndex, 0, ...draggedWidget.tabs);
        state = updateWidgetState(state, target.widgetId, {
          tabs,
        });
      } else if (isSectionDropTargetState(target)) {
        const panel = state.panels[target.side];
        const widgets = [...panel.widgets];
        widgets.splice(target.sectionIndex, 0, target.newWidgetId);
        state = updatePanelState(state, target.side, {
          widgets,
          collapsed: false,
        });
        state = addWidgetState(state, target.newWidgetId, draggedWidget.tabs, draggedWidget);
      } else if (isWidgetDropTargetState(target)) {
        state = updateHomeOfToolSettingsWidget(state, target.widgetId, floatingWidget.home);
        const widget = findWidget(state, target.widgetId);
        if (widget && isPanelWidgetLocation(widget)) {
          state = updatePanelState(state, widget.side, {
            collapsed: false,
          });
        }
        const targetWidget = state.widgets[target.widgetId];
        const tabs = [...targetWidget.tabs];
        tabs.splice(targetWidget.tabs.length, 0, ...draggedWidget.tabs);
        state = updateWidgetState(state, target.widgetId, {
          tabs,
        });
      } else {
        const panelSectionId = getWidgetPanelSectionId(target.side, 0);
        state = updatePanelState(state, target.side, {
          widgets: [panelSectionId],
          collapsed: false,
        });
        state = addWidgetState(state, panelSectionId, draggedWidget.tabs, {
          ...draggedWidget,
          minimized: false,
        });
      }
      return state;
    }
    case "FLOATING_WIDGET_RESIZE": {
      const { resizeBy } = action;
      return produce(state, (draft) => {
        const floatingWidget = draft.floatingWidgets.byId[action.id];
        // if this is not a tool settings widget then set the userSized flag
        // istanbul ignore else
        if (!isToolSettingsFloatingWidget(draft, action.id)) {
          floatingWidget.userSized = true;
        }

        assert(!!floatingWidget);
        const bounds = Rectangle.create(floatingWidget.bounds);
        const newBounds = bounds.inset(-resizeBy.left, -resizeBy.top, -resizeBy.right, -resizeBy.bottom);
        setRectangleProps(floatingWidget.bounds, newBounds);

        const widget = draft.widgets[action.id];
        const size = newBounds.getSize();
        const tab = draft.tabs[widget.activeTabId];
        initSizeProps(tab, "preferredFloatingWidgetSize", size);
        tab.userSized = true;
      });
    }
    case "FLOATING_WIDGET_CLEAR_USER_SIZED": {
      return floatingWidgetClearUserSizedFlag(state, action.id);
    }
    case "FLOATING_WIDGET_BRING_TO_FRONT": {
      return floatingWidgetBringToFront(state, action.id);
    }
    case "FLOATING_WIDGET_SEND_BACK": {
      const floatingWidget = state.floatingWidgets.byId[action.id];
      const widget = state.widgets[action.id];
      const home = floatingWidget.home;
      const panel = state.panels[home.side];
      const destinationWidgetId = home.widgetId ?? getWidgetPanelSectionId(panel.side, home.widgetIndex);

      let destinationWidget = state.widgets[destinationWidgetId];

      // Use existing panel section (from widgetIndex) if new widgets can't be added to the panel.
      if (!destinationWidget && panel.widgets.length === panel.maxWidgetCount) {
        const id = panel.widgets[home.widgetIndex];
        destinationWidget = state.widgets[id];
      }

      // Add tabs to an existing widget.
      if (destinationWidget) {
        const tabs = [...destinationWidget.tabs, ...widget.tabs];
        state = updateWidgetState(state, destinationWidget.id, {
          tabs,
        });
        return removeWidget(state, widget.id);
      }

      // Add tabs to a new panel widget.
      const sectionIndex = destinationWidgetId.endsWith("End") ? 1 : 0;
      state = removeWidget(state, widget.id);
      return insertPanelWidget(state, panel.side, destinationWidgetId, widget.tabs, sectionIndex);
    }
    case "POPOUT_WIDGET_SEND_BACK": {
      const popoutWidget = state.popoutWidgets.byId[action.id];
      const widget = state.widgets[action.id];
      const home = popoutWidget.home;
      const panel = state.panels[home.side];
      let widgetPanelSectionId = home.widgetId;
      let homeWidgetPanelSection;
      if (widgetPanelSectionId) {
        homeWidgetPanelSection = state.widgets[widgetPanelSectionId];
      } else {
        widgetPanelSectionId = getWidgetPanelSectionId(panel.side, home.widgetIndex);
        homeWidgetPanelSection = state.widgets[widgetPanelSectionId];
      }

      state = removeWidget(state, popoutWidget.id);
      if (homeWidgetPanelSection) {
        const tabs = [...homeWidgetPanelSection.tabs, ...widget.tabs];
        state = updateWidgetState(state, homeWidgetPanelSection.id, {
          tabs,
        });
      } else {
        // if widget panel section was removed because it was empty insert it
        const sectionIndex = widgetPanelSectionId.endsWith("End") ? 1 : 0;
        state = insertPanelWidget(state, panel.side, widgetPanelSectionId, [...widget.tabs], sectionIndex);
      }
      return state;
    }
    case "WIDGET_TAB_CLICK": {
      const widget = state.widgets[action.widgetId];

      state = setWidgetActiveTabId(state, widget.id, action.id);
      return updateWidgetState(state, widget.id, {
        minimized: false,
      });
    }
    case "WIDGET_TAB_DOUBLE_CLICK": {
      if (action.floatingWidgetId === undefined)
        return state;

      const widget = state.widgets[action.widgetId];
      const active = action.id === widget.activeTabId;
      if (!active)
        return setWidgetActiveTabId(state, widget.id, action.id);

      return updateWidgetState(state, widget.id, {
        minimized: !widget.minimized,
      });
    }
    case "WIDGET_TAB_DRAG_START": {
      const tabId = action.id;
      let home: FloatingWidgetHomeState;
      if (action.floatingWidgetId) {
        const floatingWidget = state.floatingWidgets.byId[action.floatingWidgetId];
        home = floatingWidget.home;
      } else {
        assert(!!action.side);
        const panel = state.panels[action.side];
        const widgetIndex = panel.widgets.indexOf(action.widgetId);
        home = {
          side: action.side,
          widgetId: action.widgetId,
          widgetIndex,
        };
      }
      state = produce(state, (draft) => {
        draft.draggedTab = createDraggedTabState(tabId, {
          position: Point.create(action.position).toProps(),
          home,
        });
      });
      return removeTabFromWidget(state, tabId);
    }
    case "WIDGET_TAB_DRAG": {
      return produce(state, (draft) => {
        const draggedTab = draft.draggedTab;
        assert(!!draggedTab);
        const position = Point.create(draggedTab.position).offset(action.dragBy);
        setPointProps(draggedTab.position, position);
      });
    }
    case "WIDGET_TAB_DRAG_END": {
      assert(!!state.draggedTab);
      const target = action.target;
      if (isTabDropTargetState(target)) {
        state = updateHomeOfToolSettingsWidget(state, target.widgetId, state.draggedTab.home);
        const targetWidget = state.widgets[target.widgetId];
        const tabIndex = target.tabIndex;
        const tabs = [...targetWidget.tabs];
        tabs.splice(tabIndex, 0, action.id);
        state = updateWidgetState(state, targetWidget.id, {
          tabs,
        });
      } else if (isPanelDropTargetState(target)) {
        const panel = state.panels[target.side];
        const widgets = [...panel.widgets, target.newWidgetId];
        state = updatePanelState(state, panel.side, {
          collapsed: false,
          widgets,
        });
        state = addWidgetState(state, target.newWidgetId, [action.id]);
      } else if (isSectionDropTargetState(target)) {
        const panel = state.panels[target.side];
        const widgets = [...panel.widgets];
        widgets.splice(target.sectionIndex, 0, target.newWidgetId);
        state = updatePanelState(state, panel.side, {
          widgets,
          collapsed: false,
        });
        state = addWidgetState(state, target.newWidgetId, [action.id]);
      } else if (isWidgetDropTargetState(target)) {
        updateHomeOfToolSettingsWidget(state, target.widgetId, state.draggedTab.home);
        const widget = findWidget(state, target.widgetId);
        if (widget && isPanelWidgetLocation(widget)) {
          const panel = state.panels[widget.side];
          state = updatePanelState(state, panel.side, {
            collapsed: false,
          });
        }
        const targetWidget = state.widgets[target.widgetId];
        const tabIndex = targetWidget.tabs.length;
        const tabs = [...targetWidget.tabs];
        tabs.splice(tabIndex, 0, action.id);
        state = updateWidgetState(state, targetWidget.id, {
          tabs,
        });
      } else {
        const tab = state.tabs[state.draggedTab.tabId];
        const nzBounds = Rectangle.createFromSize(state.size);
        const bounds = Rectangle.createFromSize(tab.preferredFloatingWidgetSize || target.size).offset(state.draggedTab.position);
        const containedBounds = bounds.containIn(nzBounds);
        const userSized = tab.userSized || (tab.isFloatingStateWindowResizable && /* istanbul ignore next */ !!tab.preferredFloatingWidgetSize);

        state = addFloatingWidget(state, target.newFloatingWidgetId, [action.id], {
          bounds: containedBounds,
          home: state.draggedTab.home,
          userSized,
        });
      }
      return produce(state, (draft) => {
        draft.draggedTab = undefined;
      });
    }
    case "TOOL_SETTINGS_DRAG_START": {
      if (!isDockedToolSettingsState(state.toolSettings))
        return state;

      const { newFloatingWidgetId } = action;
      state = produce(state, (draft) => {
        draft.toolSettings = {
          type: "widget",
        };
      });

      const tab = state.tabs[toolSettingsTabId];
      const size = tab.preferredFloatingWidgetSize || { height: 200, width: 300 };
      return addFloatingWidget(state, newFloatingWidgetId, [toolSettingsTabId], {
        bounds: Rectangle.createFromSize(size).toProps(),
      });
    }
    case "TOOL_SETTINGS_DOCK": {
      state = removeTabFromWidget(state, toolSettingsTabId);
      return produce(state, (draft) => {
        draft.toolSettings = {
          type: "docked",
        };
      });
    }
  }
  return state;
}

/** @internal */
export function getWidgetPanelSectionId(side: PanelSide, panelSectionIndex: number) {
  return 0 === panelSectionIndex ? `${side}Start` : `${side}End`;
}

/** @internal */
export function createNineZoneState(args?: Partial<NineZoneState>): NineZoneState {
  return {
    draggedTab: undefined,
    floatingWidgets: {
      byId: {},
      allIds: [],
    },
    popoutWidgets: {
      byId: {},
      allIds: [],
    },
    panels: createPanelsState(),
    widgets: {},
    tabs: createTabsState(),
    toolSettings: {
      type: "docked",
    },
    size: {
      height: 0,
      width: 0,
    },
    ...args,
  };
}

/** @internal */
export function addPanelWidget(state: NineZoneState, side: PanelSide, id: WidgetState["id"], tabs: WidgetState["tabs"], widgetArgs?: Partial<WidgetState>): NineZoneState {
  return insertPanelWidget(state, side, id, tabs, Infinity, widgetArgs);
}

/** @internal */
export function insertPanelWidget(state: NineZoneState, side: PanelSide, id: WidgetState["id"], tabs: WidgetState["tabs"], sectionIndex: number, widgetArgs?: Partial<WidgetState>): NineZoneState {
  const panel = state.panels[side];
  const maxWidgetCount = panel.maxWidgetCount;
  if (panel.widgets.length >= maxWidgetCount)
    throw new UiError(category, "Max widget count exceeded", undefined, () => ({ maxWidgetCount }));

  state = addWidgetState(state, id, tabs, widgetArgs);
  return produce(state, (draft) => {
    const widgets = draft.panels[side].widgets;
    widgets.splice(sectionIndex, 0, id);
  });
}

/** @internal */
export function addFloatingWidget(state: NineZoneState, id: FloatingWidgetState["id"], tabs: WidgetState["tabs"], floatingWidgetArgs?: Partial<FloatingWidgetState>,
  widgetArgs?: Partial<WidgetState>,
): NineZoneState {
  if (id in state.floatingWidgets.byId)
    throw new UiError(category, "Floating widget already exists");

  state = addWidgetState(state, id, tabs, widgetArgs);
  const floatingWidget = createFloatingWidgetState(id, floatingWidgetArgs);
  return produce(state, (stateDraft) => {
    stateDraft.floatingWidgets.byId[id] = floatingWidget;
    stateDraft.floatingWidgets.allIds.push(id);
  });
}

/** @internal */
export function addPopoutWidget(state: NineZoneState, id: PopoutWidgetState["id"], tabs: WidgetState["tabs"], popoutWidgetArgs?: Partial<PopoutWidgetState>,
  widgetArgs?: Partial<WidgetState>,
): NineZoneState {
  if (tabs.length !== 1)
    throw new UiError(category, "Popout widget should contain one tab only", undefined, () => ({ tabs }));

  const popoutWidget = createPopoutWidgetState(id, popoutWidgetArgs);
  state = addWidgetState(state, id, tabs, widgetArgs);
  return produce(state, (stateDraft) => {
    stateDraft.popoutWidgets.byId[id] = popoutWidget;
    stateDraft.popoutWidgets.allIds.push(id);
  });
}

/** Removes tab from the UI, but keeps the tab state.
 * @internal
 */
export function removeTabFromWidget(state: NineZoneState, tabId: TabState["id"]): NineZoneState {
  const location = findTab(state, tabId);
  if (!location)
    return state;

  const widgetId = location.widgetId;
  const widget = state.widgets[widgetId];
  const tabs = [...widget.tabs];
  const tabIndex = tabs.indexOf(tabId);
  tabs.splice(tabIndex, 1);

  if (tabs.length === 0) {
    return removeWidget(state, widgetId);
  }

  if (tabId === widget.activeTabId) {
    state = setWidgetActiveTabId(state, widget.id, tabs[0]);
  }

  return updateWidgetState(state, widgetId, {
    tabs,
  });
}

/** Removes tab from the UI and deletes the tab state.
 * @internal
 */
export function removeTab(state: NineZoneState, tabId: TabState["id"]): NineZoneState {
  if (!(tabId in state.tabs))
    throw new UiError(category, "Tab not found");

  state = removeTabFromWidget(state, tabId);
  return produce(state, (draft) => {
    delete draft.tabs[tabId];
  });
}

/** @internal */
export function isTabDropTargetState(state: DropTargetState): state is TabDropTargetState {
  return state.type === "tab";
}

/** @internal */
export function isPanelDropTargetState(state: DropTargetState): state is PanelDropTargetState {
  return state.type === "panel";
}

/** @internal */
export function isSectionDropTargetState(state: DropTargetState): state is SectionDropTargetState {
  return state.type === "section";
}

/** @internal */
export function isWidgetDropTargetState(state: DropTargetState): state is WidgetDropTargetState {
  return state.type === "widget";
}

/** @internal */
export function isWindowDropTargetState(state: WidgetDragDropTargetState): state is WindowDropTargetState {
  return state.type === "window";
}

/** @internal */
export function isDockedToolSettingsState(state: ToolSettingsState): state is DockedToolSettingsState {
  return state.type === "docked";
}

/** @internal */
export function isWidgetDragDropTargetState(state: DropTargetState): state is WidgetDragDropTargetState {
  if (state.type === "floatingWidget")
    return false;
  return true;
}

/** @internal */
export function isTabDragDropTargetState(state: DropTargetState): state is TabDragDropTargetState {
  if (state.type === "window")
    return false;
  return true;
}

/** @internal */
export function isHorizontalPanelState(state: PanelState): state is HorizontalPanelState {
  return isHorizontalPanelSide(state.side);
}
