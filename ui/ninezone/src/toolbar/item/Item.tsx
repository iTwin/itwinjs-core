/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Toolbar */

import * as classnames from "classnames";
import * as React from "react";

import CommonProps from "../../utilities/Props";
import "./Item.scss";

export interface ItemProps extends CommonProps {
  isActive?: boolean;
  onClick?: () => void;
}

export default class Item extends React.Component<ItemProps> {
  public render() {
    const className = classnames(
      "nz-toolbar-item-item",
      this.props.isActive && "nz-is-active",
      this.props.className);

    return (
      <div
        onClickCapture={this.props.onClick}
        className={className}
        style={this.props.style}
      >
        <div className="nz-gradient"></div>
        {this.props.children}
      </div>
    );
  }
}
