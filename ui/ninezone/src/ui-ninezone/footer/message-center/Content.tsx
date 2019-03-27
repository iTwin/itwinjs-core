/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module MessageCenter */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps, NoChildrenProps } from "../../utilities/Props";
import "./Content.scss";

/** Properties of [[MessageCenterContent]] component. */
export interface MessageCenterContentProps extends CommonProps, NoChildrenProps {
  /** Tabs of message center. See [[MessageCenterTab]] */
  tabs?: React.ReactNode;
  /** Messages of message center. See [[MessageCenterMessage]] */
  messages?: React.ReactNode;
  /* Optional prompt when no messages are present */
  prompt?: string;
}

/** Used by [[MessageCenterDialog]] component. */
export class MessageCenterContent extends React.PureComponent<MessageCenterContentProps> {
  public render() {
    const className = classnames(
      "nz-footer-messageCenter-content",
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
      >
        <div className="nz-tabs">
          {this.props.tabs}
        </div>
        <div className="nz-messages">
          {this.props.messages}
        </div>
        <span className="nz-message-prompt">{this.props.prompt}</span>
        <div className="nz-gradient" />
      </div>
    );
  }
}
