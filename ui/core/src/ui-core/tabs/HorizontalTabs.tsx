/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tabs */

import * as React from "react";
import * as classnames from "classnames";

/** Properties for the [[HorizontalTabs]] component
 * @public
 */
export interface HorizontalTabsProps extends React.AllHTMLAttributes<HTMLUListElement> {
  labels: string[];
  onClickLabel?: (id: number) => any;
  activeIndex?: number;
  green?: boolean;
}

/** Horizontal tabs meant to represent the current position in a page/section
 * @public
 */
export class HorizontalTabs extends React.Component<HorizontalTabsProps> {
  public render(): JSX.Element {
    return (
      <ul className={classnames(
        "uicore-tabs-horizontal",
        { green: this.props.green },
        this.props.className,
      )}>
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
