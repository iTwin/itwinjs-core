/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Popup */

import * as classnames from "classnames";
import * as React from "react";
import { Direction, DirectionHelpers } from "../../utilities/Direction";
import { CommonProps } from "../../utilities/Props";
import "./Popover.scss";

/** Properties of [[Popover]] component. */
export interface PopoverProps extends CommonProps {
  /** Popover content. */
  children?: React.ReactNode;
  /** Direction to which the popover is expanded. */
  direction: Direction;
}

/** Popover component. */
export class Popover extends React.PureComponent<PopoverProps> {
  public render() {
    const className = classnames(
      "nz-popup-popover-popover",
      DirectionHelpers.getCssClassName(this.props.direction),
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
