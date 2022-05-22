/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Frontstage
 */
import * as React from "react";
import { ContentLayout } from "../content/ContentLayout";
import { useActiveFrontstageDef } from "../frontstage/Frontstage";

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
