/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module SnapMode */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "../../utilities/Props";
import "./Icon.scss";

/** Properties of [[SnapModeIcon]] component. */
export interface SnapModeIconProps extends CommonProps {
  /** Describes if the icon is active. */
  isActive?: boolean;
}

/** Snap mode icon displays characters as snap icon. Used in Snap, SnapModeIndicator components. */
export class SnapModeIcon extends React.PureComponent<SnapModeIconProps> {
  public render() {
    const className = classnames(
      "nz-footer-snapMode-icon",
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
