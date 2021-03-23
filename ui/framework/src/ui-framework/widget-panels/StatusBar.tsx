/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module StatusBar
 */

import "./StatusBar.scss";
import classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import { ConfigurableUiControlType } from "../configurableui/ConfigurableUiControl.js";
import { useActiveFrontstageDef } from "../frontstage/Frontstage.js";
import { StatusBar } from "../statusbar/StatusBar.js";
import { StatusBarWidgetControl } from "../statusbar/StatusBarWidgetControl.js";

/** @internal */
export function WidgetPanelsStatusBar(props: CommonProps) {
  const frontstageDef = useActiveFrontstageDef();
  const zone = frontstageDef?.bottomCenter;
  if (!zone || !zone.isStatusBar)
    return null;
  const widget = zone.getSingleWidgetDef();
  const className = classnames(
    "uifw-widgetPanels-statusBar",
    props.className,
  );
  return (
    <StatusBar
      className={className}
      style={props.style}
      isInFooterMode
      widgetControl={widget?.getWidgetControl(ConfigurableUiControlType.StatusBarWidget) as StatusBarWidgetControl}
    />
  );
}
