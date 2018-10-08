/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Toolbar */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps from "../../utilities/Props";
import "./Button.scss";

/** Properties of [[ToolbarButton]] component. */
export interface ToolbarButtonProps extends CommonProps {
  /** Button content. */
  children?: React.ReactNode;
  /** Function called when the button is clicked. */
  onClick?: () => void;
}

/** Basic toolbar button. Used in [[Toolbar]] component. */
export default class ToolbarButton extends React.Component<ToolbarButtonProps> {
  public render() {
    const className = classnames(
      "nz-toolbar-button-button",
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
        onClick={this.props.onClick}
      >
        <div className="nz-gradient" />
        {this.props.children}
      </div>
    );
  }
}
