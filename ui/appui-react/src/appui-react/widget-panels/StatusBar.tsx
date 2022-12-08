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
import { CommonProps } from "@itwin/core-react";
import { ConfigurableUiControlType } from "../configurableui/ConfigurableUiControl";
import { useActiveFrontstageDef } from "../frontstage/Frontstage";
import { StatusBar } from "../statusbar/StatusBar";
import { StatusBarWidgetControl } from "../statusbar/StatusBarWidgetControl";

/** @internal */
export function WidgetPanelsStatusBar(props: CommonProps) {
  const frontstageDef = useActiveFrontstageDef();
  const zone = frontstageDef?.bottomCenter; // eslint-disable-line deprecation/deprecation
  let widget = frontstageDef?.statusBar;
  if (zone && zone.isStatusBar) {
    widget = zone.getSingleWidgetDef();
  }
  if (!widget)
    return null;
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
