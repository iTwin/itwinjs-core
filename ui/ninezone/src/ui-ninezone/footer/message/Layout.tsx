/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Message */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import "./Layout.scss";

/** Properties of [[MessageLayout]] component.
 * @beta
 */
export interface MessageLayoutProps extends CommonProps {
  /** Message buttons. I.e. [[MessageButton]] */
  buttons?: React.ReactNode;
  /** Message label. */
  children?: React.ReactNode;
  /** Message progress bar. I.e. [[MessageProgress]] */
  progress?: React.ReactNode;
}

/** Layout used in [[Message]] component.
 * @beta
 */
export class MessageLayout extends React.PureComponent<MessageLayoutProps> {
  public render() {
    const className = classnames(
      "nz-footer-message-layout",
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
      >
        <div className="nz-label">
          {this.props.children}
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
