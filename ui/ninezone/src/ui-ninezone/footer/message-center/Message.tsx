/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module MessageCenter */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps, NoChildrenProps } from "../../utilities/Props";
import "./Message.scss";

/** Properties of [[MessageCenterMessage]] component. */
export interface MessageCenterMessageProps extends CommonProps, NoChildrenProps {
  /** Icon of message entry. */
  icon?: React.ReactNode;
  /** Actual message. */
  content?: React.ReactNode;
}

/** Message entry in [[MessageCenter]] component. */
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
        {this.props.content &&
          <div className="nz-content">
            {this.props.content}
          </div>
        }
      </div>
    );
  }
}
