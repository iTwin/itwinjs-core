/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Base */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import "./PointerCaptor.scss";

/** Properties of [[PointerCaptor]] component.
 * @internal
 */
export interface PointerCaptorProps extends CommonProps {
  /** Describes if the mouse is down. */
  isMouseDown: boolean;
  /** Function called when component is clicked. */
  onClick?: () => void;
  /** Function called when the mouse is pressed. */
  onMouseDown?: (e: MouseEvent) => void;
  /** Function called when the mouse is moved. */
  onMouseMove?: (e: MouseEvent) => void;
  /** Function called when the mouse is released. */
  onMouseUp?: (e: MouseEvent) => void;
}

/** A component which will capture the pointer down event.
 * @internal
 */
export class PointerCaptor extends React.PureComponent<PointerCaptorProps> {
  public componentDidMount() {
    document.addEventListener("mouseup", this._handleDocumentMouseUp);
    document.addEventListener("mousemove", this._handleDocumentMouseMove);
  }

  public componentWillUnmount() {
    document.removeEventListener("mouseup", this._handleDocumentMouseUp);
    document.removeEventListener("mousemove", this._handleDocumentMouseMove);
  }

  public render() {
    const className = classnames(
      "nz-base-pointerCaptor",
      this.props.isMouseDown && "nz-captured",
      this.props.className);
    return (
      <div
        className={className}
        onMouseDown={this._handleMouseDown}
        onClick={this.props.onClick}
        style={this.props.style}
      >
        <div className="nz-overlay" />
        {this.props.children}
      </div>
    );
  }

  private _handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    this.props.onMouseDown && this.props.onMouseDown(e.nativeEvent);
  }

  private _handleDocumentMouseUp = (e: MouseEvent) => {
    if (!this.props.isMouseDown)
      return;
    this.props.onMouseUp && this.props.onMouseUp(e);
  }

  private _handleDocumentMouseMove = (e: MouseEvent) => {
    if (!this.props.isMouseDown)
      return;
    this.props.onMouseMove && this.props.onMouseMove(e);
  }
}
