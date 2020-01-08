/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @module Tabs */

import * as React from "react";
import { TabsProps, Tabs } from "./Tabs";

/** Vertical tabs meant to represent the current position in a page/section
 * @beta
 */
export class VerticalTabs extends React.PureComponent<TabsProps> {
  public render(): JSX.Element {
    return (
      <Tabs mainClassName="uicore-tabs-vertical" {...this.props} />
    );
  }
}
