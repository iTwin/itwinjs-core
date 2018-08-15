/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module SnapMode */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps, { NoChildrenProps } from "../../utilities/Props";
import "./Snap.scss";

/** Properties of [[Snap]] component.  */
export interface SnapProps extends CommonProps, NoChildrenProps {
  /** Icon of snap row. I.e. [[SnapModeIcon]] */
  icon?: React.ReactNode;
  /** Describes if the snap row is active. */
  isActive?: boolean;
  /** Label of snap row. */
  label?: string;
}

/** Snap row used in [[SnapModeDialog]] component. */
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
