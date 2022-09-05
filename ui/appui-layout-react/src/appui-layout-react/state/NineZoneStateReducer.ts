/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Base
 */

import { produce } from "immer";
import { Point, Rectangle } from "@itwin/core-react";
import { assert } from "@itwin/core-bentley";
import { removeTabFromWidget } from "./TabState";
import { getWidgetLocation, isPanelWidgetLocation } from "./WidgetLocation";
import { NineZoneAction } from "./NineZoneAction";
import { isPanelDropTargetState, isSectionDropTargetState, isTabDropTargetState, isWidgetDropTargetState, isWindowDropTargetState } from "./DropTargetState";
import { getWidgetPanelSectionId, insertPanelWidget } from "./PanelState";
import { NineZoneState } from "./NineZoneState";
import { addFloatingWidget, floatingWidgetBringToFront, FloatingWidgetHomeState } from "./WidgetState";
import { isDockedToolSettingsState, toolSettingsTabId } from "./ToolSettingsState";
import { updatePanelState } from "./internal/PanelStateHelpers";
import { createDraggedTabState } from "./internal/TabStateHelpers";
import { initSizeProps, isToolSettingsFloatingWidget, setPointProps, setRectangleProps, setSizeProps, updateHomeOfToolSettingsWidget } from "./internal/NineZoneStateHelpers";
import { addWidgetState, floatingWidgetClearUserSizedFlag, removeFloatingWidget, removePanelWidget, removeWidget, setWidgetActiveTabId, updateFloatingWidgetState, updateWidgetState } from "./internal/WidgetStateHelpers";

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
        const widget = getWidgetLocation(state, target.widgetId);
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
      const { id, widgetId } = action;
      state = setWidgetActiveTabId(state, widgetId, id);
      return updateWidgetState(state, widgetId, {
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
        const widget = getWidgetLocation(state, target.widgetId);
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
