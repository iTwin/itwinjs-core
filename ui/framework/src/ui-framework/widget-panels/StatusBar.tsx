/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module StatusBar
 */

import * as React from "react";
import { ConfigurableUiControlType } from "../configurableui/ConfigurableUiControl";
import { StatusBar } from "../statusbar/StatusBar";
import { StatusBarWidgetControl } from "../statusbar/StatusBarWidgetControl";
import { useActiveFrontstageDef } from "../frontstage/Frontstage";

/** @internal */
export function WidgetPanelsStatusBar() {
  const frontstageDef = useActiveFrontstageDef();
  const zone = frontstageDef?.bottomCenter;
  if (!zone || !zone.isStatusBar)
    return null;
  const widget = zone.getSingleWidgetDef();
  return (
    <StatusBar
      isInFooterMode
      widgetControl={widget?.getWidgetControl(ConfigurableUiControlType.StatusBarWidget) as StatusBarWidgetControl}
    />
  );
}
