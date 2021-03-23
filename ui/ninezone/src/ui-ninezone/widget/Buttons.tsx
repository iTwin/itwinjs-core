/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import * as React from "react";
import { SendBack } from "./SendBack.js";
import { ActiveTabIdContext, WidgetIdContext } from "./Widget.js";
import { toolSettingsTabId } from "../base/NineZoneState.js";
import { Dock } from "./Dock.js";
import { FloatingWidgetIdContext } from "./FloatingWidget.js";
import { isHorizontalPanelSide, PanelStateContext } from "../widget-panels/Panel.js";
import { PinToggle } from "./PinToggle.js";

/** @internal */
export const TabBarButtons = React.memo(function TabBarButtons() { // eslint-disable-line @typescript-eslint/naming-convention, no-shadow
  const isToolSettings = useIsToolSettingsTab();
  const floatingWidgetId = React.useContext(FloatingWidgetIdContext);
  const isMainPanelWidget = useIsMainPanelWidget();
  return (
    <>
      {floatingWidgetId && !isToolSettings && <SendBack />}
      {isToolSettings && <Dock />}
      {isMainPanelWidget && <PinToggle />}
    </>
  );
});

function useIsToolSettingsTab() {
  const activeTabId = React.useContext(ActiveTabIdContext);
  return activeTabId === toolSettingsTabId;
}

/** @internal */
export function useIsMainPanelWidget() {
  const panelState = React.useContext(PanelStateContext);
  const widgetId = React.useContext(WidgetIdContext);
  if (!panelState)
    return false;
  const mainWidget = isHorizontalPanelSide(panelState.side) ? panelState.widgets[panelState.widgets.length - 1] : panelState.widgets[0];
  return mainWidget === widgetId;
}
