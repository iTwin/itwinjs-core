/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module SnapMode */

import * as classnames from "classnames";
import * as React from "react";

import CommonProps from "../../utilities/Props";
import "./Icon.scss";

export interface SnapModeIconProps extends CommonProps {
  isActive?: boolean;
  text?: string;
}

export default class SnapModeIcon extends React.Component<SnapModeIconProps> {
  public render() {
    const className = classnames(
      "nz-footer-snapMode-icon",
      this.props.isActive && "nz-is-active",
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
      >
        {this.props.text}
      </div>
    );
  }
}
