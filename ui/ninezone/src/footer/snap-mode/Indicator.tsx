/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module SnapMode */

import * as classnames from "classnames";
import * as React from "react";

import CommonProps, { NoChildrenProps } from "../../utilities/Props";
import "./Indicator.scss";

/** Properties of [[SnapModeIndicator]] component. */
export interface SnapModeIndicatorProps extends CommonProps, NoChildrenProps {
  /** Dialog that is opened when indicator is clicked. */
  dialog?: React.ReactChild;
  /** Indicator icon. I.e. [[SnapModeIcon]] */
  icon?: React.ReactNode;
  /** Describes if the label is visible. Pass true if the [[Footer]] is in footer mode. */
  isLabelVisible?: boolean;
  /** Indicator label. */
  label?: string;
  /** Function called when label is clicked. */
  onIndicatorClick?: () => void;
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
      >
        <div className="nz-indicator">
          <span className={labelClassName}>{this.props.label}</span>
          <div
            className="nz-icon"
            onClick={this.handleOnIndicatorClick}
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

  private handleOnIndicatorClick = () => {
    this.props.onIndicatorClick && this.props.onIndicatorClick();
  }
}
