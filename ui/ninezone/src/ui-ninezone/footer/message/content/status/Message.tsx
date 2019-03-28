/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Message */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "../../../../utilities/Props";
import { Status, StatusHelpers } from "./Status";
import "./Message.scss";

/** Properties of [[StatusMessage]] component. */
export interface StatusMessageProps extends CommonProps {
  /** Content of status message. I.e. [[MessageLayout]] */
  children?: React.ReactNode;
  /** Status icon. */
  icon?: React.ReactNode;
  /** Message status. */
  status: Status;
}

/** Status message can be used in one of footer messages. I.e.: [[Toast]], [[Temporary]], [[Sticky]], [[Activity]] */
export class StatusMessage extends React.PureComponent<StatusMessageProps> {
  public render() {
    const className = classnames(
      "nz-footer-message-content-status-message",
      StatusHelpers.getCssClassName(this.props.status),
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
      >
        <div className="nz-icon">
          {this.props.icon}
        </div>
        {this.props.children}
      </div>
    );
  }
}
