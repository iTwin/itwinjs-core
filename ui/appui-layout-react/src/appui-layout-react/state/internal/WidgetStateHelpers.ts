/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Base
 */

import { castDraft, produce } from "immer";
import { UiError } from "@itwin/appui-abstract";
import { NineZoneState } from "../NineZoneState";
import { FloatingWidgetState, PopoutWidgetState, WidgetState } from "../WidgetState";
import { getTabLocation } from "../TabLocation";
import { getWidgetLocation, isFloatingWidgetLocation, isPanelWidgetLocation, isPopoutWidgetLocation, PanelWidgetLocation } from "../WidgetLocation";
import { Point, Rectangle, RectangleProps } from "@itwin/core-react";
import { category, setRectangleProps } from "./NineZoneStateHelpers";
import { updatePanelState } from "./PanelStateHelpers";
import { updateTabState } from "./TabStateHelpers";

/** @internal */
export function createWidgetState(id: WidgetState["id"], tabs: WidgetState["tabs"], args?: Partial<WidgetState>): WidgetState {
  if (tabs.length === 0)
    throw new UiError(category, "Widget must contain tabs");
  return {
    activeTabId: tabs[0],
    minimized: false,
    ...args,
    id,
    tabs,
  };
}

/** @internal */
export function updateWidgetState(state: NineZoneState, id: WidgetState["id"], args: Partial<WidgetState>) {
  assertWidgetState(state, id);
  return produce(state, (draft) => {
    const widget = draft.widgets[id];
    draft.widgets[id] = {
      ...widget,
      ...castDraft(args),
    };
  });
}

/** @internal */
export function addWidgetState(state: NineZoneState, id: WidgetState["id"], tabs: WidgetState["tabs"], args?: Partial<WidgetState>) {
  if (id in state.widgets)
    throw new UiError(category, "Widget already exists");

  const widget = createWidgetState(id, tabs, args);
  for (const tabId of widget.tabs) {
    if (!(tabId in state.tabs))
      throw new UiError(category, "Tab does not exist", undefined, () => ({ tabId }));

    const location = getTabLocation(state, tabId);
    if (location)
      throw new UiError(category, "Tab is already in a widget", undefined, () => ({ tabId, widgetId: location.widgetId }));
  }
  return produce(state, (draft) => {
    draft.widgets[id] = castDraft(widget);
  });
}

/** @internal */
export function removeWidget(state: NineZoneState, id: WidgetState["id"]): NineZoneState {
  const location = getWidgetLocation(state, id);
  if (!location)
    throw new UiError(category, "Widget not found");

  if (isFloatingWidgetLocation(location))
    return removeFloatingWidget(state, id);
  if (isPopoutWidgetLocation(location))
    return removePopoutWidget(state, id);
  return removePanelWidget(state, id, location);
}

/** @internal */
export function removeWidgetState(state: NineZoneState, id: WidgetState["id"]): NineZoneState {
  assertWidgetState(state, id);
  return produce(state, (draft) => {
    delete draft.widgets[id];
  });
}

/** @internal */
export function createFloatingWidgetState(id: FloatingWidgetState["id"], args?: Partial<FloatingWidgetState>): FloatingWidgetState {
  return {
    bounds: new Rectangle().toProps(),
    home: {
      side: "left",
      widgetId: undefined,
      widgetIndex: 0,
    },
    hidden: false,
    ...args,
    id,
  };
}

/** @internal */
export function createPopoutWidgetState(id: PopoutWidgetState["id"], args?: Partial<PopoutWidgetState>): PopoutWidgetState {
  return {
    bounds: new Rectangle().toProps(),
    home: {
      side: "left",
      widgetId: undefined,
      widgetIndex: 0,
    },
    ...args,
    id,
  };
}

/** @internal */
export function updateFloatingWidgetState(state: NineZoneState, id: FloatingWidgetState["id"], args: Partial<FloatingWidgetState>) {
  if (!(id in state.floatingWidgets.byId))
    throw new UiError(category, "Floating widget does not exist");

  return produce(state, (draft) => {
    const floatingWidget = draft.floatingWidgets.byId[id];
    const { bounds, ...other } = args;
    draft.floatingWidgets.byId[id] = {
      ...floatingWidget,
      ...other,
    };
    if (bounds)
      setRectangleProps(floatingWidget.bounds, bounds);
  });
}

/** Removes floating widget from the UI and deletes the widget state.
 * @internal
 */
export function removeFloatingWidget(state: NineZoneState, id: FloatingWidgetState["id"]): NineZoneState {
  if (!(id in state.floatingWidgets.byId))
    throw new UiError(category, "Floating widget does not exist");

  state = produce(state, (draft) => {
    delete draft.floatingWidgets.byId[id];
    const idIndex = draft.floatingWidgets.allIds.indexOf(id);
    draft.floatingWidgets.allIds.splice(idIndex, 1);
  });
  return removeWidgetState(state, id);
}

/** Removes floating widget from the UI and deletes the widget state.
 * @internal
 */
export function removePopoutWidget(state: NineZoneState, id: PopoutWidgetState["id"]) {
  if (!(id in state.popoutWidgets.byId))
    throw new UiError(category, "Popout widget does not exist");

  state = produce(state, (draft) => {
    delete draft.popoutWidgets.byId[id];
    const index = state.popoutWidgets.allIds.indexOf(id);
    draft.popoutWidgets.allIds.splice(index, 1);
  });
  return removeWidgetState(state, id);
}

/** @internal */
export function removePanelWidget(state: NineZoneState, id: WidgetState["id"], location?: PanelWidgetLocation): NineZoneState {
  location = location || findPanelWidget(state, id);
  if (!location)
    throw new UiError(category, "Panel widget not found");

  const panel = state.panels[location.side];
  const widgets = [...panel.widgets];
  widgets.splice(location.index, 1);
  state = updatePanelState(state, panel.side, {
    widgets,
  });

  const expandedWidget = widgets.find((widgetId) => {
    return !state.widgets[widgetId].minimized;
  });
  if (!expandedWidget && widgets.length > 0) {
    const firstWidgetId = widgets[0];
    state = updateWidgetState(state, firstWidgetId, {
      minimized: false,
    });
  }

  return removeWidgetState(state, id);
}

function findPanelWidget(state: NineZoneState, id: WidgetState["id"]) {
  const location = getWidgetLocation(state, id);
  if (location && isPanelWidgetLocation(location))
    return location;
  return undefined;
}

/** @internal */
export function assertWidgetState(state: NineZoneState, id: WidgetState["id"]) {
  if (!(id in state.widgets))
    throw new UiError(category, "Widget does not exist", undefined, () => ({ id }));
}

/** @internal */
export function getWidgetState(state: NineZoneState, id: WidgetState["id"]) {
  assertWidgetState(state, id);
  return state.widgets[id];
}

/** @internal */
export function setWidgetActiveTabId(state: NineZoneState, widgetId: WidgetState["id"], tabId: WidgetState["activeTabId"]): NineZoneState {
  const widget = getWidgetState(state, widgetId);
  if (!widget.tabs.includes(tabId))
    throw new UiError(category, "Tab is not in a widget");

  state = updateWidgetState(state, widgetId, {
    activeTabId: tabId,
  });

  const floatingWidget = state.floatingWidgets.byId[widgetId];
  if (floatingWidget) {
    const activeTab = state.tabs[tabId];
    const preferredFloatingWidgetSize = Rectangle.create(floatingWidget.bounds).getSize();
    state = updateTabState(state, activeTab.id, {
      preferredFloatingWidgetSize,
    });
  }
  return state;
}

/** @internal */
export function floatingWidgetClearUserSizedFlag(state: NineZoneState, floatingWidgetId: FloatingWidgetState["id"]) {
  return produce(state, (draft) => {
    const floatingWidget = draft.floatingWidgets.byId[floatingWidgetId];
    floatingWidget.userSized = false;
    const widget = draft.widgets[floatingWidgetId];
    const tab = draft.tabs[widget.activeTabId];
    tab.userSized = false;
  });
}

/** @internal */
export function getNewFloatingWidgetBounds(state: NineZoneState): RectangleProps {
  // Matches min size (to handle auto-sized floating widgets correctly).
  const size = { height: 120, width: 200 };
  const initialPosition = new Point(360, 340);

  const nzBounds = Rectangle.createFromSize(state.size);
  const widgetsBounds = nzBounds.inset(20, 20, 20, 20);
  const offset = new Point(40, 40);

  let bounds = Rectangle.createFromSize(size);
  if (state.floatingWidgets.allIds.length === 0) {
    // Initial floating widget position.
    bounds = bounds.offset(initialPosition);
  } else {
    // Position is relative to last floating widget if available.
    const widgetId = state.floatingWidgets.allIds[state.floatingWidgets.allIds.length - 1];
    const widget = state.floatingWidgets.byId[widgetId];
    const widgetBounds = Rectangle.create(widget.bounds);

    // Bounds relative to top left of a last floating widget.
    const topLeft = widgetBounds.topLeft().offset(offset);
    bounds = bounds.offset(topLeft);

    // Bottom right of new bounds should also be outside of a floating widget.
    const widgetBottomRight = new Point(widgetBounds.right, widgetBounds.bottom);
    const minBottomRight = widgetBottomRight.offset(offset);
    const x = Math.max(0, minBottomRight.x - bounds.right);
    const y = Math.max(0, minBottomRight.y - bounds.bottom);
    bounds = bounds.offset({ x, y });
  }

  // TODO: might still end up with a bunch of overlapping widgets.
  if (bounds.bottom >= widgetsBounds.bottom) {
    bounds = bounds.setPosition({ x: bounds.left, y: widgetsBounds.top });
  }
  if (bounds.right >= widgetsBounds.right) {
    bounds = bounds.setPosition({ x: widgetsBounds.left, y: widgetsBounds.top });
  }
  bounds = bounds.containIn(widgetsBounds);
  return bounds.toProps();
}
