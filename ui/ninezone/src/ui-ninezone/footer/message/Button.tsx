/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Message */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import "./Button.scss";

/** Properties of [[MessageButton]] component.
 * @beta
 */
export interface MessageButtonProps extends CommonProps {
  /** Button content. */
  children?: React.ReactNode;
  /** Function called when button is clicked. */
  onClick?: () => void;
}

/** Button component used in [[Message]] component.
 * @beta
 */
export class MessageButton extends React.PureComponent<MessageButtonProps> {
  public render() {
    const className = classnames(
      "nz-footer-message-button",
      this.props.className);

    return (
      <div
        className={className}
        onClick={this.props.onClick}
        style={this.props.style}
      >
        {this.props.children}
      </div>
    );
  }
}
