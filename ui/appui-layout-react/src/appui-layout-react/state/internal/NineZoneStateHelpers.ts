/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Base
 */

import { Draft, produce } from "immer";
import { PointProps, UiError } from "@itwin/appui-abstract";
import {
  addFloatingWidget, addPopoutWidget, DraggedTabState, FloatingWidgetHomeState, FloatingWidgetState, HorizontalPanelState, NineZoneState, NineZoneStateReducer, PanelsState,
  PopoutWidgetState, removeTabFromWidget, TabsState, toolSettingsTabId, VerticalPanelState,
} from "../NineZoneState";
import { WidgetState } from "../WidgetState";
import { Rectangle, RectangleProps, SizeProps } from "@itwin/core-react";
import { HorizontalPanelSide, PanelSide, VerticalPanelSide } from "../../widget-panels/Panel";
import { getUniqueId } from "../../base/NineZone";
import { findTab, isFloatingTabLocation, isPanelTabLocation, isPopoutTabLocation } from "../TabLocation";
import { findWidget, isFloatingWidgetLocation, isPanelWidgetLocation, isPopoutWidgetLocation, PanelWidgetLocation } from "../WidgetLocation";
import { createTabState, removeWidgetState, updateTabState, updateWidgetState } from "../internal";

/** @internal */
export const category = "appui-layout-react:layout";

function createPanelState(side: PanelSide) {
  return {
    collapseOffset: 100,
    collapsed: false,
    maxSize: 600,
    minSize: 200,
    pinned: true,
    resizable: true,
    side,
    size: undefined,
    widgets: [],
    maxWidgetCount: 2,
    splitterPercent: 50,
  };
}

/** @internal */
export function createVerticalPanelState(side: VerticalPanelSide, args?: Partial<VerticalPanelState>): VerticalPanelState {
  return {
    ...createPanelState(side),
    ...args,
    side,
  };
}

/** @internal */
export function createHorizontalPanelState(side: HorizontalPanelSide, args?: Partial<HorizontalPanelState>): HorizontalPanelState {
  return {
    ...createPanelState(side),
    minSize: 100,
    span: true,
    ...args,
    side,
  };
}

/** @internal */
export function createPanelsState(args?: Partial<PanelsState>): PanelsState {
  return {
    bottom: createHorizontalPanelState("bottom"),
    left: createVerticalPanelState("left"),
    right: createVerticalPanelState("right"),
    top: createHorizontalPanelState("top"),
    ...args,
  };
}

/** @internal */
export function createTabsState(args?: Partial<TabsState>): TabsState {
  return {
    [toolSettingsTabId]: createTabState(toolSettingsTabId, {
      label: "Tool Settings",
      allowedPanelTargets: ["bottom", "left", "right"],
    }),
    ...args,
  };
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
export function createDraggedTabState(tabId: DraggedTabState["tabId"], args?: Partial<DraggedTabState>): DraggedTabState {
  return {
    home: {
      side: "left",
      widgetId: undefined,
      widgetIndex: 0,
    },
    position: { x: 0, y: 0 },
    ...args,
    tabId,
  };
}

/** @internal */
export function updateFloatingWidgetState(state: NineZoneState, id: FloatingWidgetState["id"], args: Partial<FloatingWidgetState>) {
  if (!(id in state.floatingWidgets.byId))
    throw new UiError(category, "Floating widget not found");

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

/** @internal */
export function setRectangleProps(props: Draft<RectangleProps>, bounds: RectangleProps) {
  props.left = bounds.left;
  props.right = bounds.right;
  props.top = bounds.top;
  props.bottom = bounds.bottom;
}

/** @internal */
export function setPointProps(props: Draft<PointProps>, point: PointProps) {
  props.x = point.x;
  props.y = point.y;
}

/** @internal */
export function setSizeProps(props: Draft<SizeProps>, size: SizeProps) {
  props.height = size.height;
  props.width = size.width;
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
export function updatePanelState<K extends keyof PanelsState>(state: NineZoneState, side: K, args: Partial<PanelsState[K]>) {
  return produce(state, (draft) => {
    const panel = draft.panels[side];
    draft.panels[side] = {
      ...panel,
      ...args,
    };
  });
}

/** Removes floating widget from the UI and deletes the widget state.
 * @internal
 */
export function removeFloatingWidget(state: NineZoneState, id: FloatingWidgetState["id"]): NineZoneState {
  if (!(id in state.floatingWidgets.byId))
    throw new UiError(category, "Floating widget not found");

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
    throw new UiError(category, "Popout widget not found");

  state = produce(state, (draft) => {
    delete draft.popoutWidgets.byId[id];
    const index = state.popoutWidgets.allIds.indexOf(id);
    draft.popoutWidgets.allIds.splice(index, 1);
  });
  return removeWidgetState(state, id);
}

function findPanelWidget(state: NineZoneState, id: WidgetState["id"]) {
  const location = findWidget(state, id);
  if (location && isPanelWidgetLocation(location))
    return location;
  return undefined;
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

/** @internal */
export function setWidgetActiveTabId(state: NineZoneState, widgetId: WidgetState["id"], tabId: WidgetState["activeTabId"]): NineZoneState {
  if (!(tabId in state.tabs))
    throw new UiError(category, "Tab not found");

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

type KeysOfType<T, Type> = { [K in keyof T]: T[K] extends Type ? K : never }[keyof T];

/** @internal */
export function initSizeProps<T, K extends KeysOfType<T, SizeProps | undefined>>(obj: T, key: K, size: SizeProps) {
  if (obj[key]) {
    setSizeProps(obj[key], size);
    return;
  }
  (obj[key] as SizeProps) = {
    height: size.height,
    width: size.width,
  };
}

/** @internal */
export function floatingWidgetBringToFront(state: NineZoneState, floatingWidgetId: FloatingWidgetState["id"]): NineZoneState {
  return produce(state, (draft) => {
    const idIndex = draft.floatingWidgets.allIds.indexOf(floatingWidgetId);
    const spliced = draft.floatingWidgets.allIds.splice(idIndex, 1);
    draft.floatingWidgets.allIds.push(spliced[0]);
  });
}

/** @internal */
export function isToolSettingsFloatingWidget(state: NineZoneState, id: FloatingWidgetState["id"]) {
  const widget = state.widgets[id];
  return (widget.tabs.length === 1 &&
    widget.tabs[0] === toolSettingsTabId &&
    id in state.floatingWidgets.byId
  );
}

/** Updated home state of floating tool settings widget.
 * @internal
 */
export function updateHomeOfToolSettingsWidget(state: NineZoneState, id: FloatingWidgetState["id"], home: FloatingWidgetHomeState): NineZoneState {
  if (!isToolSettingsFloatingWidget(state, id))
    return state;

  return updateFloatingWidgetState(state, id, {
    home,
  });
}

/** @internal */
export function setFloatingWidgetContainerBounds(state: NineZoneState, floatingWidgetId: string, bounds: RectangleProps) {
  if (floatingWidgetId in state.floatingWidgets.byId) {
    return produce(state, (draft) => {
      draft.floatingWidgets.byId[floatingWidgetId].bounds = bounds;
      draft.floatingWidgets.byId[floatingWidgetId].userSized = true;
    });
  }
  return state;
}



/** @internal */
export function floatWidget(state: NineZoneState, widgetTabId: string, point?: PointProps, size?: SizeProps): NineZoneState {
  const location = findTab(state, widgetTabId);
  if (!location)
    throw new UiError(category, "Tab not found");

  if (isFloatingTabLocation(location))
    return state;

  const tab = state.tabs[widgetTabId];
  const preferredSize = size ?? (tab.preferredFloatingWidgetSize ?? { height: 400, width: 400 });
  const preferredPoint = point ?? { x: 50, y: 100 };
  const preferredBounds = Rectangle.createFromSize(preferredSize).offset(preferredPoint);
  const nzBounds = Rectangle.createFromSize(state.size);
  const containedBounds = preferredBounds.containIn(nzBounds);

  if (isPanelTabLocation(location)) {
    const floatingWidgetId = widgetTabId ? widgetTabId : /* istanbul ignore next */ getUniqueId();
    const panel = state.panels[location.side];
    const widgetIndex = panel.widgets.indexOf(location.widgetId);

    const floatedTab = state.tabs[widgetTabId];
    state = updateTabState(state, floatedTab.id, {
      preferredFloatingWidgetSize: preferredSize,
    });
    state = removeTabFromWidget(state, widgetTabId);
    return addFloatingWidget(state, floatingWidgetId, [widgetTabId], {
      bounds: containedBounds,
      home: {
        side: location.side,
        widgetId: location.widgetId,
        widgetIndex,
      },
    }, {
      isFloatingStateWindowResizable: floatedTab.isFloatingStateWindowResizable,
    });
  }
  return convertPopoutWidgetContainerToFloating(state, location.popoutWidgetId);
}

/** @internal */
export function dockWidgetContainer(state: NineZoneState, widgetTabId: string, idIsContainerId?: boolean): NineZoneState {
  if (idIsContainerId) {
    const widgetLocation = findWidget(state, widgetTabId);
    if (widgetLocation) {
      if (isFloatingWidgetLocation(widgetLocation)) {
        const floatingWidgetId = widgetLocation.floatingWidgetId;
        return NineZoneStateReducer(state, {
          type: "FLOATING_WIDGET_SEND_BACK",
          id: floatingWidgetId,
        });
      } else {
        // istanbul ignore else
        if (isPopoutWidgetLocation(widgetLocation)) {
          const popoutWidgetId = widgetLocation.popoutWidgetId;
          return NineZoneStateReducer(state, {
            type: "POPOUT_WIDGET_SEND_BACK",
            id: popoutWidgetId,
          });
        }
      }
    }
  } else {
    const location = findTab(state, widgetTabId);
    if (location) {
      if (isFloatingTabLocation(location)) {
        const floatingWidgetId = location.widgetId;
        return NineZoneStateReducer(state, {
          type: "FLOATING_WIDGET_SEND_BACK",
          id: floatingWidgetId,
        });
      } else {
        // istanbul ignore else
        if (isPopoutTabLocation(location)) {
          const popoutWidgetId = location.widgetId;
          return NineZoneStateReducer(state, {
            type: "POPOUT_WIDGET_SEND_BACK",
            id: popoutWidgetId,
          });
        }
      }
    }
  }
  throw new UiError(category, "Widget not found");
}

/** @internal */
export function convertFloatingWidgetContainerToPopout(state: NineZoneState, widgetContainerId: string): NineZoneState {
  // istanbul ignore next - not an expected condition
  if (!state.widgets[widgetContainerId]?.tabs || state.widgets[widgetContainerId].tabs.length !== 1) {
    // currently only support popping out a floating widget container if it has a single tab
    return state;
  }
  return produce(state, (draft) => {
    const floatingWidget = state.floatingWidgets.byId[widgetContainerId];
    const bounds = floatingWidget.bounds;
    const home = floatingWidget.home;
    const id = floatingWidget.id;
    // remove the floating entry
    delete draft.floatingWidgets.byId[widgetContainerId];
    const idIndex = draft.floatingWidgets.allIds.indexOf(widgetContainerId);
    draft.floatingWidgets.allIds.splice(idIndex, 1);
    // insert popout entry
    draft.popoutWidgets.byId[widgetContainerId] = { bounds, id, home };
    draft.popoutWidgets.allIds.push(widgetContainerId);
  });
}

/** @internal */
export function convertPopoutWidgetContainerToFloating(state: NineZoneState, widgetContainerId: string): NineZoneState {
  return produce(state, (draft) => {
    const popoutWidget = state.popoutWidgets.byId[widgetContainerId];
    const bounds = popoutWidget.bounds;
    const home = popoutWidget.home;
    const id = popoutWidget.id;
    // remove the floating entry
    delete draft.popoutWidgets.byId[widgetContainerId];
    const idIndex = draft.popoutWidgets.allIds.indexOf(widgetContainerId);
    draft.popoutWidgets.allIds.splice(idIndex, 1);
    // insert popout entry
    draft.floatingWidgets.byId[widgetContainerId] = { bounds, id, home };
    draft.floatingWidgets.allIds.push(widgetContainerId);
  });
}

/** When running in web-browser - browser prohibits auto opening of popup windows so convert any PopoutWidgets to
 * FloatingWidgets in this situation.
 * @internal
 */
export function convertAllPopupWidgetContainersToFloating(state: NineZoneState): NineZoneState {
  return produce(state, (draft) => {
    for (const widgetContainerId of state.popoutWidgets.allIds) {
      const popoutWidget = state.popoutWidgets.byId[widgetContainerId];
      const bounds = popoutWidget.bounds;
      const home = popoutWidget.home;
      const id = popoutWidget.id;
      // remove the popout entry
      delete draft.popoutWidgets.byId[widgetContainerId];
      const idIndex = draft.popoutWidgets.allIds.indexOf(widgetContainerId);
      draft.popoutWidgets.allIds.splice(idIndex, 1);
      // insert floating entry
      draft.floatingWidgets.byId[widgetContainerId] = { bounds, id, home };
      draft.floatingWidgets.allIds.push(widgetContainerId);
    }
  });
}

/** @internal */
export function popoutWidgetToChildWindow(state: NineZoneState, tabId: string, preferredBounds: RectangleProps): NineZoneState {
  const location = findTab(state, tabId);
  if (!location)
    throw new UiError(category, "Tab not found");

  // Already in popout state.
  if (isPopoutTabLocation(location))
    return state;

  const popoutWidgetId = getUniqueId();
  const nzBounds = Rectangle.createFromSize(state.size);
  const bounds = Rectangle.create(preferredBounds).containIn(nzBounds);

  if (isPanelTabLocation(location)) {
    const panel = state.panels[location.side];
    const widgetIndex = panel.widgets.indexOf(location.widgetId);

    state = removeTabFromWidget(state, tabId);
    return addPopoutWidget(state, popoutWidgetId, [tabId], {
      bounds: bounds.toProps(),
      home: {
        side: location.side,
        widgetId: location.widgetId,
        widgetIndex,
      },
    });
  }

  // Floating location
  const floatingWidget = state.floatingWidgets.byId[location.floatingWidgetId];
  const home = floatingWidget.home;

  // Move the tab from the floating container and create a new popout container
  state = removeTabFromWidget(state, tabId);
  return addPopoutWidget(state, popoutWidgetId, [tabId], {
    bounds: bounds.toProps(),
    home,
  });
}
