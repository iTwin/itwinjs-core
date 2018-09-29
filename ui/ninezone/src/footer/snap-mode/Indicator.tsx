/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module SnapMode */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps, { NoChildrenProps } from "../../utilities/Props";
import "./Indicator.scss";

/** Properties of [[SnapModeIndicator]] component. */
export interface SnapModeIndicatorProps extends CommonProps, NoChildrenProps {
  /** Dialog that is opened when indicator is clicked. See [[SnapModeDialog]] */
  dialog?: React.ReactChild;
  /** Indicator icon. I.e. [[SnapModeIcon]] */
  icon?: React.ReactNode;
  /** Describes if the label is visible. Pass true if the [[Footer]] is in footer mode. */
  isLabelVisible?: boolean;
  /** Indicator label. */
  label?: string;
  /** Function called when indicator is clicked. */
  onClick?: () => void;
}

/** One of [[Footer]] indicators. */
export default class SnapModeIndicator extends React.Component<SnapModeIndicatorProps> {
  public render() {
    const className = classnames(
      "nz-footer-snapMode-indicator",
      this.props.className);

    const labelClassName = classnames(
      "nz-label",
      this.props.isLabelVisible && "nz-is-visible",
    );

    return (
      <div
        className={className}
        style={this.props.style}
        onClick={this._handleOnIndicatorClick}
      >
        <div className="nz-indicator">
          <span className={labelClassName}>{this.props.label}</span>
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

  private _handleOnIndicatorClick = () => {
    this.props.onClick && this.props.onClick();
  }
}
