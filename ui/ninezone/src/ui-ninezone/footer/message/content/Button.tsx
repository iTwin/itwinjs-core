/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Message */

import * as classnames from "classnames";
import * as React from "react";

import { CommonProps } from "../../../utilities/Props";
import "./Button.scss";

/** Properties of [[MessageButton]] component. */
export interface MessageButtonProps extends CommonProps {
  /** Button icon. */
  children?: React.ReactNode;
  /** Function called when button is clicked. */
  onClick?: () => void;
}

/** Button component used in status message. I.e. [[MessageLayout]] */
export class MessageButton extends React.PureComponent<MessageButtonProps> {
  public render() {
    const className = classnames(
      "nz-footer-message-content-button",
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
        onClick={this.props.onClick}
      >
        {this.props.children}
      </div>
    );
  }
}
