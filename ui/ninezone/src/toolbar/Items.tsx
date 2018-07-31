/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Toolbar */

import * as classnames from "classnames";
import * as React from "react";

import CommonProps from "../utilities/Props";
import "./Items.scss";
import { OrthogonalDirectionHelpers, OrthogonalDirection } from "../utilities/Direction";

export interface ItemsProps extends CommonProps {
  children?: React.ReactNode;
  direction: OrthogonalDirection;
}

export default class Items extends React.Component<ItemsProps> {
  public render() {
    const className = classnames(
      "nz-toolbar-items",
      OrthogonalDirectionHelpers.getCssClassName(this.props.direction),
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
      >
        {this.props.children}
      </div>
    );
  }
}
