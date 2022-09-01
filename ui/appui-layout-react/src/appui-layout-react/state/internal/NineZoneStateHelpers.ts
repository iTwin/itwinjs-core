/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Base
 */

import { Draft, produce } from "immer";
import { PointProps, UiError } from "@itwin/appui-abstract";
import { NineZoneState } from "../NineZoneState";
import { addFloatingWidget, addPopoutWidget, FloatingWidgetHomeState, FloatingWidgetState } from "../WidgetState";
import { Rectangle, RectangleProps, SizeProps } from "@itwin/core-react";
import { getUniqueId } from "../../base/NineZone";
import { findTab, isFloatingTabLocation, isPanelTabLocation, isPopoutTabLocation } from "../TabLocation";
import { findWidget, isFloatingWidgetLocation, isPopoutWidgetLocation } from "../WidgetLocation";
import { NineZoneStateReducer } from "../NineZoneStateReducer";
import { removeTabFromWidget } from "../TabState";
import { toolSettingsTabId } from "../ToolSettingsState";
import { updateTabState } from "./TabStateHelpers";
import { updateFloatingWidgetState } from "./WidgetStateHelpers";

/** @internal */
export const category = "appui-layout-react:layout";

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

type KeysOfType<T, Type> = { [K in keyof T]: T[K] extends Type ? K : never }[keyof T];

/** @internal */
export function initSizeProps<T, K extends KeysOfType<T, SizeProps | undefined>>(obj: T, key: K, size: SizeProps) {
  if (obj[key]) {
    setSizeProps(obj[key] as unknown as SizeProps, size);
    return;
  }
  (obj[key] as unknown as SizeProps) = {
    height: size.height,
    width: size.width,
  };
}

/** @internal */
export function isToolSettingsFloatingWidget(state: NineZoneState, id: FloatingWidgetState["id"]) {
  const widget = state.widgets[id];
  return (widget.tabs.length === 1 &&
    widget.tabs[0] === toolSettingsTabId &&
    id in state.floatingWidgets.byId
  );
}

/** @internal */
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
