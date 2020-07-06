/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tabs
 */

import * as React from "react";
import { Tabs, TabsProps } from "./Tabs";

/** Vertical tabs meant to represent the current position in a page/section
 * @public
 */
export class VerticalTabs extends React.PureComponent<TabsProps> {
  /** @internal */
  public render(): JSX.Element {
    return (
      <Tabs mainClassName="uicore-tabs-vertical" {...this.props} />
    );
  }
}
