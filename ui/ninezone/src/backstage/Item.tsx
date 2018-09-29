/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Backstage */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps from "../utilities/Props";
import "./Item.scss";

/** Properties of [[BackstageItem]] component. */
export interface BackstageItemProps extends CommonProps {
  /** Optional icon. */
  icon?: React.ReactChild;
  /** Optional label. */
  label?: string;
  /** Describes if the items is active. */
  isActive?: boolean;
  /** Describes if the items is disabled. */
  isDisabled?: boolean;
  /** Function called when item is clicked. */
  onClick?: () => void;
}

/** Item in the [[Backstage]]. */
export default class BackstageItem extends React.Component<BackstageItemProps> {

  public render() {
    const className = classnames(
      "nz-backstage-item",
      this.props.isActive && "nz-is-active",
      this.props.isDisabled && "nz-is-disabled",
      this.props.className);

    return (
      <li className={className} style={this.props.style} onClick={this.props.onClick}>
        {this.props.icon}
        <span>{this.props.label}</span>
      </li>
    );
  }
}
