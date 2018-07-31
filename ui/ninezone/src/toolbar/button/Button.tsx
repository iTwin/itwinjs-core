/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Toolbar */

import * as classnames from "classnames";
import * as React from "react";

import CommonProps from "../../utilities/Props";
import "./Button.scss";

export interface ToolbarButtonProps extends CommonProps {
  onClick?: () => void;
}

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
