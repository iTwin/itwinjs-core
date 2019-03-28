/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module MessageCenter */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps, NoChildrenProps } from "../../utilities/Props";
import "./Indicator.scss";

/** Properties of [[MessageCenterIndicator]] component. */
export interface MessageCenterIndicatorProps extends CommonProps, NoChildrenProps {
  /** Label of balloon icon. */
  balloonLabel?: string;
  /** Dialog that is opened when indicator is clicked. See [[MessageCenterDialog]] */
  dialog?: React.ReactChild;
  /** Indicator label. */
  label?: string;
  /** Function called when indicator is clicked. */
  onClick?: () => void;
}

/** One of [[Footer]] indicators. */
export class MessageCenterIndicator extends React.PureComponent<MessageCenterIndicatorProps> {
  public render() {
    const className = classnames(
      "nz-footer-messageCenter-indicator",
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
      >
        {this.props.label !== undefined &&
          <span className="nz-label">{this.props.label}</span>
        }
        <div className="nz-balloon-container">
          <div className="nz-dialog">
            {this.props.dialog}
          </div>
          <div
            className="nz-balloon"
            onClick={this.props.onClick}
          >
            <div className="nz-arrow" />
            <div className="nz-content">
              {this.props.balloonLabel}
            </div>
          </div>
        </div>
      </div>
    );
  }
}
