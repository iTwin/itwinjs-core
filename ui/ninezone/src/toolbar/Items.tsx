/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Toolbar */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps from "../utilities/Props";
import { OrthogonalDirectionHelpers, OrthogonalDirection } from "../utilities/Direction";
import "./Items.scss";

/** Properties of [[Items]] component. */
export interface ItemsProps extends CommonProps {
  /** Toolbar items. */
  children?: React.ReactNode;
  /** Toolbar items direction. */
  direction: OrthogonalDirection;
}

/** Toolbar items container. Used in [[Toolbar]] and [[Scrollable]] components. */
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
