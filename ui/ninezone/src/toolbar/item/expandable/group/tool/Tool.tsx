/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Toolbar */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps from "../../../../../utilities/Props";

import "./Tool.scss";

export interface ToolProps extends CommonProps {
  isActive?: boolean;
  isFocused?: boolean;
  onClick?: () => void;
  icon?: React.ReactNode;
  label?: string;
}

export default class Tool extends React.Component<ToolProps> {
  public render() {
    const itemClassName = classnames(
      "nz-toolbar-item-expandable-group-tool-item",
      this.props.isActive && "nz-is-active",
      this.props.isFocused && "nz-is-focused",
      this.props.className);

    return (
      <div
        className={itemClassName}
        style={this.props.style}
        onClick={this.props.onClick}
      >
        <div className="nz-icon">
          {this.props.icon}
        </div>
        <div className="nz-label">
          {this.props.label}
        </div>
        {this.props.children}
      </div>
    );
  }
}
