/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Popup */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import { Direction, DirectionHelpers } from "../../utilities/Direction";
import "./Popover.scss";

/** Properties of [[Popover]] component.
 * @alpha
 */
export interface PopoverProps extends CommonProps {
  /** Popover content. */
  children?: React.ReactNode;
  /** Direction to which the popover is expanded. */
  direction: Direction;
}

/** Popover component.
 * @alpha Replace by ui-core/popup
 */
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
