/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Message
 */

import "./Layout.scss";
import classnames from "classnames";
import * as React from "react";
import type { CommonProps } from "@itwin/core-react";

/** Properties of [[MessageLayout]] component.
 * @internal
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
 * @internal
 */
export class MessageLayout extends React.PureComponent<MessageLayoutProps> {
  public override render() {
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
