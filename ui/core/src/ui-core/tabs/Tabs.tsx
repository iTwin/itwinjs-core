/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tabs
 */

import * as React from "react";
import classnames from "classnames";
import { CommonProps } from "../utils/Props";

/** Properties for the [[HorizontalTabs]] and [[VerticalTabs]] components
 * @beta
 */
export interface TabsProps extends React.AllHTMLAttributes<HTMLUListElement>, CommonProps {
  /** Text shown for each tab */
  labels: string[];
  /** Handler for clicking on a label */
  onClickLabel?: (index: number) => any;
  /** Index of the initial active tab */
  activeIndex?: number;
  /** Indicates whether the bar on the active tab is green instead of the default blue */
  green?: boolean;
}

/** Properties for the base [[Tabs]] component
 * @beta
 */
export interface MainTabsProps extends TabsProps {
  /** Main CSS class name */
  mainClassName: string;
}

/** Tabs meant to represent the current position in a page/section
 * @beta
 */
export class Tabs extends React.PureComponent<MainTabsProps> {
  public render(): JSX.Element {
    const ulClassNames = classnames(
      this.props.mainClassName,
      this.props.green && "uicore-tabs-green",
      this.props.className,
    );

    return (
      <ul className={ulClassNames} style={this.props.style}>
        {this.props.labels.map((label, index) =>
          <li key={index} className={classnames({ active: index === this.props.activeIndex })}>
            <a onClick={() => { this.props.onClickLabel && this.props.onClickLabel(index); }}>
              {label}
            </a>
          </li>,
        )}
      </ul>
    );
  }
}
