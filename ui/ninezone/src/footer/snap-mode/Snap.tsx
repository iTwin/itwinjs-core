/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module SnapMode */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps, { NoChildrenProps } from "../../utilities/Props";
import "./Snap.scss";

/** Properties of Snap component.  */
export interface SnapProps extends CommonProps, NoChildrenProps {
  /** Icon of snap row. I.e. [[SnapModeIcon]] */
  icon?: React.ReactNode;
  /** Describes if the snap row is active. */
  isActive?: boolean;
  /** Label of snap row. */
  label?: string;
  /** Function called when the Snap component is clicked. */
  onClick?: () => void;
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
        onClick={this._handleOnClick}
        className={dialogClassName}
        style={this.props.style}
      >
        <div>
          {this.props.icon}
        </div>
        <div>
          {this.props.label}
        </div>
      </div>
    );
  }

  private _handleOnClick = () => {
    this.props.onClick && this.props.onClick();
  }

}
