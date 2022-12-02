/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Item
 */

import "./Toolbars.scss";
import * as React from "react";
import { useActiveFrontstageDef } from "../frontstage/Frontstage";

/** @internal */
export function WidgetPanelsToolbars() {
  const frontstageDef = useActiveFrontstageDef();

  let toolsWidget = frontstageDef?.contentManipulation;
  if (frontstageDef?.topLeft) { // eslint-disable-line deprecation/deprecation
    toolsWidget = frontstageDef?.topLeft.getSingleWidgetDef(); // eslint-disable-line deprecation/deprecation
  }

  let navigationWidget = frontstageDef?.viewNavigation;
  if (frontstageDef?.topRight) { // eslint-disable-line deprecation/deprecation
    navigationWidget = frontstageDef?.topRight.getSingleWidgetDef(); // eslint-disable-line deprecation/deprecation
  }
  const tools = toolsWidget?.reactNode;
  const navigation = navigationWidget?.reactNode;
  return (
    <div className="uifw-widgetPanels-toolbars">
      {tools}
      {navigation}
    </div>
  );
}
