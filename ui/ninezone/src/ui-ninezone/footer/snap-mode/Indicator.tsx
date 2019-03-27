/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module SnapMode */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps, NoChildrenProps } from "../../utilities/Props";
import "./Indicator.scss";

/** Properties of [[SnapModeIndicator]] component. */
export interface SnapModeIndicatorProps extends CommonProps, NoChildrenProps {
  /** Dialog that is opened when indicator is clicked. See [[SnapModeDialog]] */
  dialog?: React.ReactChild;
  /** Indicator icon. I.e. [[SnapModeIcon]] */
  icon?: React.ReactNode;
  /** Indicator label. */
  label?: string;
  /** Function called when indicator is clicked. */
  onClick?: () => void;
}

/** One of [[Footer]] indicators. */
export class SnapModeIndicator extends React.PureComponent<SnapModeIndicatorProps> {
  public render() {
    const className = classnames(
      "nz-footer-snapMode-indicator",
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
      >
        <div
          className="nz-indicator"
          onClick={this.props.onClick}
        >
          {this.props.label !== undefined &&
            <span className="nz-label">{this.props.label}</span>
          }
          <div
            className="nz-icon"
          >
            {this.props.icon}
          </div>
        </div>
        <div className="nz-dialog">
          {this.props.dialog}
        </div>
      </div>
    );
  }
}
