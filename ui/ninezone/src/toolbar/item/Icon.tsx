/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Toolbar */

import * as classnames from "classnames";
import * as React from "react";

import "./Icon.scss";
import Item, { ItemProps } from "./Item";

export default class Icon extends React.Component<ItemProps> {
  public render() {
    const className = classnames(
      "nz-toolbar-item-icon",
      this.props.className);

    return (
      <Item
        {...this.props}
        className={className}
      >
        <div className="nz-icon">
          {this.props.children}
        </div>
      </Item>
    );
  }
}
