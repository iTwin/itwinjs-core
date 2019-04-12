/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module MessageCenter */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import "./Message.scss";

/** Properties of [[MessageCenterMessage]] component.
 * @beta
 */
export interface MessageCenterMessageProps extends CommonProps {
  /** Message content. */
  children?: React.ReactNode;
  /** Message icon. */
  icon?: React.ReactNode;
}

/** Message entry in [[MessageCenterDialog]] component.
 * @beta
 */
export class MessageCenterMessage extends React.PureComponent<MessageCenterMessageProps> {
  public render() {
    const className = classnames(
      "nz-footer-messageCenter-message",
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
      >
        {this.props.icon &&
          <div className="nz-icon">
            {this.props.icon}
          </div>
        }
        {this.props.children &&
          <div className="nz-content">
            {this.props.children}
          </div>
        }
      </div>
    );
  }
}
