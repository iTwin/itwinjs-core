/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Toolbar */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps from "../../utilities/Props";
import "./Item.scss";

/** Properties of [[Item]] component */
export interface ItemProps extends CommonProps {
  /** Component children. */
  children?: React.ReactNode;
  /** Describes if item is active. */
  isActive?: boolean;
  /** Describes if the item is disabled. */
  isDisabled?: boolean;
  /** Function called when the item is clicked. */
  onClick?: () => void;
}

/** Toolbar item component. Used in [[Toolbar]] */
export default class Item extends React.Component<ItemProps> {
  public render() {
    const className = classnames(
      "nz-toolbar-item-item",
      this.props.isActive && "nz-is-active",
      this.props.isDisabled && "nz-is-disabled",
      this.props.className);

    return (
      <div
        onClick={this._handleClick}
        className={className}
        style={this.props.style}
      >
        <div className="nz-gradient"></div>
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
