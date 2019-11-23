/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Zone */

import * as classnames from "classnames";
import * as React from "react";
import { MergeTargetProps } from "./Merge";

interface WidgetTargetState {
  readonly isTargeted: boolean;
}

/** Basic component used by widget targets. I.e. [[ZoneTarget]], [[StagePanelTarget]]
 * @internal
 */
export class WidgetTarget extends React.PureComponent<MergeTargetProps, WidgetTargetState> {
  public readonly state: WidgetTargetState = {
    isTargeted: false,
  };

  private _target = React.createRef<HTMLDivElement>();

  public componentDidMount() {
    // iOS workaround: element.releasePointerCapture() is only partially implemented (no boundary events i.e. pointerenter)
    document.addEventListener("pointermove", this._handleDocumentPointerMove);
  }

  public componentWillUnmount() {
    document.removeEventListener("pointermove", this._handleDocumentPointerMove);
    this.state.isTargeted && this.props.onTargetChanged && this.props.onTargetChanged(false);
  }

  public render() {
    const className = classnames(
      "nz-zones-target-target",
      this.state.isTargeted && "nz-targeted",
      this.props.className);

    return (
      <div
        className={className}
        ref={this._target}
        style={this.props.style}
      >
        {this.props.children}
      </div>
    );
  }

  private _handleDocumentPointerMove = (e: PointerEvent) => {
    if (!this._target.current || !e.target || !(e.target instanceof Node))
      return;
    if (this._target.current.contains(e.target)) {
      if (this.state.isTargeted)
        return;
      this.setState({ isTargeted: true });
      this.props.onTargetChanged && this.props.onTargetChanged(true);
      return;
    }

    if (!this.state.isTargeted)
      return;
    this.setState({ isTargeted: false });
    this.props.onTargetChanged && this.props.onTargetChanged(false);
  }
}
