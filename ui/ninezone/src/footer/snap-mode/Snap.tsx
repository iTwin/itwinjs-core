/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module SnapMode */

import * as classnames from "classnames";
import * as React from "react";

import CommonProps from "../../utilities/Props";
import "./Snap.scss";

export interface SnapProps extends CommonProps {
  icon?: React.ReactChild;
  isActive?: boolean;
  label?: string;
}

export default class Snap extends React.Component<SnapProps> {
  public render() {
    const dialogClassName = classnames(
      "nz-footer-snapMode-snap",
      this.props.isActive && "nz-is-active",
      this.props.className);

    return (
      <div
        className={dialogClassName}
        style={this.props.style}
      >
        <div className="nz-icon">
          {this.props.icon}
        </div>
        <div className="nz-label">
          {this.props.label}
        </div>
      </div>
    );
  }
}
