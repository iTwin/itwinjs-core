/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Backstage */

import * as classnames from "classnames";
import * as React from "react";

import CommonProps from "../utilities/Props";

import "./Item.scss";

/** Properties of [[BackstageItem]] component. */
export interface BackstageItemProps extends CommonProps {
  /** Item icon. */
  icon?: React.ReactChild;
  /** Describes if the items is active. */
  isActive?: boolean;
  /** Describes if the items is disabled. */
  isDisabled?: boolean;
  /** Item label. */
  label?: string;
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
      <div
        className={className}
        style={this.props.style}
        onClick={this._handleClick}
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

  private _handleClick = () => {
    if (this.props.isDisabled)
      return;

    this.props.onClick && this.props.onClick();
  }
}
