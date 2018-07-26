/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module MessageCenter */

import * as classnames from "classnames";
import * as React from "react";

import CommonProps, { NoChildrenProps } from "../../utilities/Props";
import "./Indicator.scss";

export interface MessageCenterIndicatorProps extends CommonProps, NoChildrenProps {
  balloonText?: string;
  dialog?: React.ReactChild;
  isLabelVisible?: boolean;
  label?: string;
  onIndicatorClick?: () => void;
}

export default class MessageCenterIndicator extends React.Component<MessageCenterIndicatorProps> {
  public render() {
    const className = classnames(
      "nz-footer-messageCenter-indicator",
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
        <span className={labelClassName}>{this.props.label}</span>
        <div className="nz-balloon-container">
          <div className="nz-dialog">
            {this.props.dialog}
          </div>
          <div
            className="nz-balloon"
            onClick={this.handleOnIndicatorClick}
          >
            <div className="nz-arrow" />
            <div className="nz-content">
              {this.props.balloonText}
            </div>
          </div>
        </div>
      </div>
    );
  }

  private handleOnIndicatorClick = () => {
    this.props.onIndicatorClick && this.props.onIndicatorClick();
  }
}
