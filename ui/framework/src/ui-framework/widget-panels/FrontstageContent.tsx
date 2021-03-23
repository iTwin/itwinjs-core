/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Frontstage
 */
import * as React from "react";
import { ContentLayout } from "../content/ContentLayout.js";
import { useActiveFrontstageDef } from "../frontstage/Frontstage.js";

/** @internal */
export function WidgetPanelsFrontstageContent() {
  const frontstageDef = useActiveFrontstageDef();
  if (!frontstageDef || !frontstageDef.contentLayoutDef || !frontstageDef.contentGroup)
    return null;
  return (<ContentLayout
    contentLayout={frontstageDef.contentLayoutDef}
    contentGroup={frontstageDef.contentGroup}
    isInFooterMode
  />);
}
