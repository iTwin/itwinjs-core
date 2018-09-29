/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Toolbar */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps from "../../../../../utilities/Props";
import "./Tool.scss";

/** Properties of [[Tool]] component. */
export interface ToolProps extends CommonProps {
  /** Additional content, besides icon and label. */
  children?: React.ReactNode;
  /** Tool icon. */
  icon?: React.ReactNode;
  /** Describes if the item is active. */
  isActive?: boolean;
  /** Describes if the item is disabled. */
  isDisabled?: boolean;
  /** Describes if the item is focused. */
  isFocused?: boolean;
  /** Tool label. */
  label?: string;
  /** Function called when the item is clicked. */
  onClick?: () => void;
}

/** Tool entry of tool group panel. Used in [[Column]]. */
export default class Tool extends React.Component<ToolProps> {
  public render() {
    const itemClassName = classnames(
      "nz-toolbar-item-expandable-group-tool-item",
      this.props.isActive && "nz-is-active",
      this.props.isFocused && "nz-is-focused",
      this.props.isDisabled && "nz-is-disabled",
      this.props.className);

    return (
      <div
        className={itemClassName}
        style={this.props.style}
        onClick={this._handleClick}
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

  private _handleClick = () => {
    if (this.props.isDisabled)
      return;

    this.props.onClick && this.props.onClick();
  }
}
