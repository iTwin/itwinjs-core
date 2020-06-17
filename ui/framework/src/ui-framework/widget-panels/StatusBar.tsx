/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module StatusBar
 */

import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import { ConfigurableUiControlType } from "../configurableui/ConfigurableUiControl";
import { useActiveFrontstageDef } from "../frontstage/Frontstage";
import { StatusBar } from "../statusbar/StatusBar";
import { StatusBarWidgetControl } from "../statusbar/StatusBarWidgetControl";

/** @internal */
export function WidgetPanelsStatusBar(props: CommonProps) {
  const frontstageDef = useActiveFrontstageDef();
  const zone = frontstageDef?.bottomCenter;
  if (!zone || !zone.isStatusBar)
    return null;
  const widget = zone.getSingleWidgetDef();
  return (
    <StatusBar
      {...props}
      isInFooterMode
      widgetControl={widget?.getWidgetControl(ConfigurableUiControlType.StatusBarWidget) as StatusBarWidgetControl}
    />
  );
}
