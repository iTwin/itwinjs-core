/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Message */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "../../../../utilities/Props";
import "./Layout.scss";

/** Properties of [[MessageLayout]] component. */
export interface MessageLayoutProps extends CommonProps {
  /** Message label. I.e. [[Label]] */
  label?: React.ReactNode;
  /** Message buttons. I.e. [[MessageButton]] */
  buttons?: React.ReactNode;
  /** Message progress bar. I.e. [[Progress]] */
  progress?: React.ReactNode;
}

/** Default layout used in [[StatusMessage]] component. */
export class MessageLayout extends React.PureComponent<MessageLayoutProps> {
  public render() {
    const className = classnames(
      "nz-footer-message-content-status-layout",
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
      >
        <div className="nz-label">
          {this.props.label}
        </div>
        <div className="nz-buttons">
          {this.props.buttons}
        </div>
        <div className="nz-progress">
          {this.props.progress}
        </div>
      </div>
    );
  }
}
