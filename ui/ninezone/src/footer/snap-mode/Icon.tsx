/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
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
  /** Characters displayed as icon if icon is not defined. */
  text?: string;
  /** Icon to show, fallback to text display if no icon specified. */
  iconName?: string;
}

/** Snap mode icon displays characters as snap icon. Used in Snap, SnapModeIndicator components. */
export default class SnapModeIcon extends React.Component<SnapModeIconProps> {
  public render() {
    const className = classnames(
      "icon icon-" + this.props.iconName,
      "nz-footer-snapMode-icon",
      this.props.className);

    if (this.props.iconName) {
      return (
        <div className={className}></div>
      );
    }
    return (<div>{this.props.text}</div>);
  }
}
