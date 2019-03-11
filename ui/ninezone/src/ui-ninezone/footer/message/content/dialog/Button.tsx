/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Message */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "../../../../utilities/Props";
import "./Button.scss";

/** Properties of [[DialogButton]] component. */
export interface DialogButtonProps extends CommonProps {
  /** Button icon. */
  children?: React.ReactNode;
  /** Function called when button is clicked. */
  onClick?: () => void;
  /** Title for the button. */
  title?: string;
}

/** Button used in [[TitleBar]] component. */
export class DialogButton extends React.PureComponent<DialogButtonProps> {
  public render() {
    const className = classnames(
      "nz-footer-message-content-dialog-button",
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
        onClick={this.props.onClick}
        title={this.props.title}
      >
        {this.props.children}
      </div>
    );
  }
}
