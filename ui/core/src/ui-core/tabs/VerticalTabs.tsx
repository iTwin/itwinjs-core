/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tabs
 */

import * as React from "react";
import { Tabs, TabsProps } from "./Tabs.js";
import { Orientation } from "../enums/Orientation.js";

/** Vertical tabs meant to represent the current position in a page/section
 * @public
 */
export function VerticalTabs(props: TabsProps) {
  return (
    <Tabs mainClassName="uicore-tabs-vertical" orientation={Orientation.Vertical} {...props} />
  );
}
