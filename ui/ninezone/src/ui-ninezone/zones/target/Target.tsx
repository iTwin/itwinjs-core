/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Zone */

import * as classnames from "classnames";
import * as React from "react";
import { MergeTargetProps } from "./Merge";
import "./Target.scss";

/** Basic zone target component used by [[BackTarget]] and [[MergeTarget]] components.
 * @internal
 */
export class ZoneTarget extends React.PureComponent<MergeTargetProps> {
  private _isTargeted = false;

  public componentWillUnmount() {
    this._isTargeted && this.props.onTargetChanged && this.props.onTargetChanged(false);
  }

  public render() {
    const className = classnames(
      "nz-zones-target-target",
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
      >
        <div
          onMouseEnter={this._handleMouseEnter}
          onMouseLeave={this._handleMouseLeave}
        >
          {this.props.children}
        </div>
      </div>
    );
  }

  private _handleMouseEnter = () => {
    this._isTargeted = true;
    this.props.onTargetChanged && this.props.onTargetChanged(true);
  }

  private _handleMouseLeave = () => {
    this._isTargeted = false;
    this.props.onTargetChanged && this.props.onTargetChanged(false);
  }
}
