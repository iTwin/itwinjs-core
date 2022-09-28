/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import * as React from "react";
import { DraggedWidgetIdContext } from "../base/DragManager";
import { DraggedTabStateContext, NineZoneContext, TabsStateContext, WidgetsStateContext } from "../base/NineZone";
import { getWidgetLocation, isFloatingWidgetLocation, isPopoutWidgetLocation } from "../state/WidgetLocation";
import { WidgetState } from "../state/WidgetState";
import { PanelSide } from "../widget-panels/Panel";

/** @internal */
export interface TargetOptions {
  version: "1" | "2";
}

const defaultValue: TargetOptions = {
  version: "1",
};

/** @internal */
export const TargetOptionsContext = React.createContext<TargetOptions>(defaultValue);
TargetOptionsContext.displayName = "nz:TargetOptionsContext";

/** @internal */
export function useTargetOptions() {
  return React.useContext(TargetOptionsContext);
}

/** Checks the proposed docking target to see if it's allowed by the dragged widget or tab
 * @internal
 */
export function useAllowedWidgetTarget(widgetId: WidgetState["id"]) {
  const state = React.useContext(NineZoneContext);
  const draggedTab = React.useContext(DraggedTabStateContext);
  const draggedWidget = React.useContext(DraggedWidgetIdContext);
  const tabsState = React.useContext(TabsStateContext);
  const widgetsState = React.useContext(WidgetsStateContext);

  const widgetLocation = getWidgetLocation(state, widgetId);

  if (!widgetLocation)
    return false;

  if (isFloatingWidgetLocation(widgetLocation) || isPopoutWidgetLocation(widgetLocation))
    return true;

  const side = widgetLocation.side;

  let allowedPanelTargets: ReadonlyArray<PanelSide> | undefined;
  if (draggedTab) {
    const tab = tabsState[draggedTab.tabId];
    allowedPanelTargets = tab.allowedPanelTargets;
  } else if (draggedWidget && draggedWidget in widgetsState) { // handle a case where DraggedWidgetIdContext exists, but dragged widget is not in WidgetsStateContet
    const widget = widgetsState[draggedWidget];
    const activeTabId = widget.activeTabId;
    const activeTab = tabsState[activeTabId];
    allowedPanelTargets = activeTab.allowedPanelTargets;
    widget.tabs.forEach((tabId) => {
      const tab = tabsState[tabId];
      if (!allowedPanelTargets)
        allowedPanelTargets = tab.allowedPanelTargets;
      else if (tab.allowedPanelTargets !== undefined) {
        const tabPanelTargets = tab.allowedPanelTargets;
        allowedPanelTargets = allowedPanelTargets.filter((x) => tabPanelTargets.includes(x));
      }
    });
  }
  if (allowedPanelTargets) {
    return allowedPanelTargets.includes(side);
  }
  return true;
}

/** HOC that returns a component which renders only if target version matches a specified `version` parameter.
 * @internal
 */
export function withTargetVersion<P extends {}>(version: TargetOptions["version"], Component: React.ComponentType<P>) {
  const WrappedComponent: React.FunctionComponent<P> = (props) => {
    const options = useTargetOptions();
    if (options.version !== version)
      return null;
    return <Component {...props} />;
  };
  WrappedComponent.displayName = `withTargetVersion:${version}`;
  return WrappedComponent;
}
