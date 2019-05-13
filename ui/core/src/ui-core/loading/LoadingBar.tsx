/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Loading */

import * as React from "react";
import * as classnames from "classnames";
import { CommonProps } from "../utils/Props";
import "./LoadingBar.scss";

/** Properties for [[LoadingBar]] component
 * @beta
 */
export interface LoadingBarProps extends CommonProps {
  /** Percent */
  percent: number;
  /** Show percentage (optional) */
  showPercentage?: boolean;
  /** Height (in pixels) of the loading bar */
  barHeight: number;
}

/**
 * A loading bar with optional percentage text.
 * @beta
 */
export class LoadingBar extends React.PureComponent<LoadingBarProps> {
  public static defaultProps: Partial<LoadingBarProps> = {
    barHeight: 4,
  };

  // sanity check to keep percentage between 0 & 100
  private inRange(percent: number): number {
    let value = Math.min(percent, 100);
    value = Math.max(value, 0);
    return value;
  }

  public render() {
    const percent = this.inRange(this.props.percent) + "%";
    const containerClass = classnames(this.props.className, "core-lb");
    return (
      <div className={containerClass} style={this.props.style}>
        <div className="lb-container" style={{ height: this.props.barHeight }}>
          <div className="fill" style={{ width: percent }} />
        </div>
        {this.props.showPercentage && <span className="percent">{percent}</span>}
      </div>
    );
  }
}
