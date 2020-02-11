/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Item
 */

import * as React from "react";
import { useActiveFrontstageDef } from "../frontstage/Frontstage";
import "./Toolbars.scss";

/** @internal */
export function WidgetPanelsToolbars() {
  const frontstageDef = useActiveFrontstageDef();
  const tools = frontstageDef?.topLeft?.getSingleWidgetDef()?.reactElement;
  const navigation = frontstageDef?.topRight?.getSingleWidgetDef()?.reactElement;
  return (
    <div className="uifw-widgetPanels-toolbars">
      {tools}
      {navigation}
    </div>
  );
}
