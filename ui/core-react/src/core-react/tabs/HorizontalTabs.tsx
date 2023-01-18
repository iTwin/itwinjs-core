/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tabs
 */

import * as React from "react";
import { Tabs, TabsProps } from "./Tabs";
import { Orientation } from "../enums/Orientation";

/** Horizontal tabs meant to represent the current position in a page/section
 * @public
 * @deprecated Use HorizontalTabs in itwinui-react instead
 */
export function HorizontalTabs(props: TabsProps) {
  return (
    <Tabs mainClassName="uicore-tabs-horizontal" orientation={Orientation.Horizontal} {...props} />
  );
}
