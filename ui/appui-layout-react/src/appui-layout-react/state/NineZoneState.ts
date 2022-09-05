/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Base
 */

// Cspell:ignore popout
import produce from "immer";
import { Rectangle, RectangleProps, SizeProps } from "@itwin/core-react";
import { createTabsState, updateTabState } from "./internal/TabStateHelpers";
import { addFloatingWidget, addPopoutWidget, FloatingWidgetsState, PopoutWidgetsState, WidgetsState } from "./WidgetState";
import { PanelsState } from "./PanelState";
import { ToolSettingsState } from "./ToolSettingsState";
import { createPanelsState } from "./internal/PanelStateHelpers";
import { DraggedTabState, removeTabFromWidget, TabsState } from "./TabState";
import { PointProps, UiError } from "@itwin/appui-abstract";
import { getUniqueId } from "../base/NineZone";
import { category, convertPopoutWidgetContainerToFloating } from "./internal/NineZoneStateHelpers";
import { NineZoneStateReducer } from "./NineZoneStateReducer";
import { getTabLocation, isFloatingTabLocation, isPanelTabLocation, isPopoutTabLocation } from "./TabLocation";
import { getWidgetLocation, isFloatingWidgetLocation, isPopoutWidgetLocation } from "./WidgetLocation";

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

/** When running in web-browser - browser prohibits auto opening of popup windows so convert any PopoutWidgets to
 * FloatingWidgets in this situation.
 * @internal
 */
export function convertAllPopupWidgetContainersToFloating(state: NineZoneState): NineZoneState {
  // TODO: review
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
export function dockWidgetContainer(state: NineZoneState, widgetTabId: string, idIsContainerId?: boolean): NineZoneState {
  // TODO: review
  if (idIsContainerId) {
    const widgetLocation = getWidgetLocation(state, widgetTabId);
    // istanbul ignore else
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
    const location = getTabLocation(state, widgetTabId);
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
export function floatWidget(state: NineZoneState, widgetTabId: string, point?: PointProps, size?: SizeProps): NineZoneState {
  // TODO: review
  const location = getTabLocation(state, widgetTabId);
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

  // istanbul ignore else
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
  // istanbul ignore next
  return convertPopoutWidgetContainerToFloating(state, location.popoutWidgetId);
}

/** @internal */
export function setFloatingWidgetContainerBounds(state: NineZoneState, floatingWidgetId: string, bounds: RectangleProps) {
  // TODO: review
  if (floatingWidgetId in state.floatingWidgets.byId) {
    return produce(state, (draft) => {
      draft.floatingWidgets.byId[floatingWidgetId].bounds = bounds;
      draft.floatingWidgets.byId[floatingWidgetId].userSized = true;
    });
  }
  return state;
}

/** @internal */
// istanbul ignore next
export function popoutWidgetToChildWindow(state: NineZoneState, tabId: string, preferredBounds: RectangleProps): NineZoneState {
  // TODO: review
  const location = getTabLocation(state, tabId);
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
