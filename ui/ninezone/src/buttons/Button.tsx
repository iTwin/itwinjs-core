/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Button */

import * as classnames from "classnames";
import * as React from "react";

import CommonProps from "../utilities/Props";
import "./Button.scss";

export interface ButtonProps extends CommonProps {
  onClick?: () => void;
}

export default class Button extends React.Component<ButtonProps> {
  public render() {
    const className = classnames(
      "nz-buttons-button",
      this.props.className);

    return (
      <button
        className={className}
        onClick={this.props.onClick}
        style={this.props.style}
      >
        {this.props.children}
      </button>
    );
  }
}
