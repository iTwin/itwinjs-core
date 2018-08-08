/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module SnapMode */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps, { NoChildrenProps } from "../../utilities/Props";
import "./Icon.scss";

/** Properties of [[SnapModeIcon]] component. */
export interface SnapModeIconProps extends CommonProps, NoChildrenProps {
  /** Describes if the icon is active. */
  isActive?: boolean;
  /** Characters displayed as icon. */
  text?: string;
}

/** Snap mode icon displays characters as snap icon. Used in [[Snap]], [[SnapModeIndicator]] components. */
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
