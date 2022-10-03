/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */
import * as React from "react";
import { DraggedWidgetIdContext } from "../base/DragManager";
import { DraggedTabStateContext, TabsStateContext, WidgetsStateContext } from "../base/NineZone";
import { PanelSide, PanelSideContext } from "../widget-panels/Panel";
import { assert } from "@itwin/core-bentley";

/** Check the docking side against allowed regions
 * @internal
 */
export function useAllowedPanelTarget() {
  const side = React.useContext(PanelSideContext);
  assert (!!side);
  const draggedTab = React.useContext(DraggedTabStateContext);
  const draggedWidget = React.useContext(DraggedWidgetIdContext);
  const tabsState = React.useContext(TabsStateContext);
  const widgetsState = React.useContext(WidgetsStateContext);

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
      else /* istanbul ignore else */ if (tab.allowedPanelTargets !== undefined) {
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
