/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Zone */

import * as classnames from "classnames";
import * as React from "react";
import { MergeTargetProps } from "./Merge";

/** Basic component used by widget targets. I.e. [[ZoneTarget]], [[StagePanelTarget]]
 * @internal
 */
export class WidgetTarget extends React.PureComponent<MergeTargetProps> {
  private _isTargeted = false;
  private _target = React.createRef<HTMLDivElement>();

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
        onMouseEnter={this._handleMouseEnter}
        onMouseMove={this._handleMouseMove}
        onMouseLeave={this._handleMouseLeave}
        ref={this._target}
        style={this.props.style}
      >
        {this.props.children}
      </div>
    );
  }

  private _handleMouseEnter = () => {
    this._isTargeted = true;
    this.props.onTargetChanged && this.props.onTargetChanged(true);
  }

  private _handleMouseMove = (e: React.MouseEvent) => {
    if (this._isTargeted || e.target !== this._target.current)
      return;

    this._isTargeted = true;
    this.props.onTargetChanged && this.props.onTargetChanged(true);
  }

  private _handleMouseLeave = () => {
    this._isTargeted = false;
    this.props.onTargetChanged && this.props.onTargetChanged(false);
  }
}
