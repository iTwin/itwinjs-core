/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tabs */

import * as React from "react";
import * as classnames from "classnames";
import { CommonProps } from "../utils/Props";

/** Properties for the [[HorizontalTabs]] component
 * @beta
 */
export interface HorizontalTabsProps extends React.AllHTMLAttributes<HTMLUListElement>, CommonProps {
  /** Text shown for each tab */
  labels: string[];
  /** Handler for clicking on a label */
  onClickLabel?: (id: number) => any;
  /** Index of the initial active tab */
  activeIndex?: number;
  /** Indicates whether the  */
  green?: boolean;
}

/** Horizontal tabs meant to represent the current position in a page/section
 * @beta
 */
export class HorizontalTabs extends React.PureComponent<HorizontalTabsProps> {
  public render(): JSX.Element {
    const ulClassNames = classnames(
      "uicore-tabs-horizontal",
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
