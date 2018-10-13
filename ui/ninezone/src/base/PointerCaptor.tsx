/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Base */

import * as classnames from "classnames";
import * as React from "react";
import CommonProps from "../utilities/Props";
import "./PointerCaptor.scss";

/** Properties of [[PointerCaptor]] component. */
export interface PointerCaptorProps extends CommonProps {
  isMouseDown?: boolean;
  onMouseDown?: (e: MouseEvent) => void;
  onMouseMove?: (e: MouseEvent) => void;
  onMouseUp?: (e: MouseEvent) => void;
}

export interface PointerCaptorState {
  isMouseDown: boolean;
}

/**
 * A component which will capture the pointer down event.
 * While captured will overlay the screen to capture iframe events too.
 */
export default class PointerCaptor extends React.Component<PointerCaptorProps, PointerCaptorState> {
  public readonly state: Readonly<PointerCaptorState> = {
    isMouseDown: false,
  };

  public componentDidMount() {
    document.addEventListener("mouseup", this._handleDocumentMouseUp);
    document.addEventListener("mousemove", this._handleDocumentMouseMove);
  }

  public componentWillUnmount() {
    document.removeEventListener("mouseup", this._handleDocumentMouseUp);
    document.removeEventListener("mousemove", this._handleDocumentMouseMove);
  }

  public get isMouseDown() {
    if (this.props.isMouseDown === undefined)
      return this.state.isMouseDown;
    return this.props.isMouseDown;
  }

  public render() {
    const className = classnames(
      "nz-base-pointerCaptor",
      this.isMouseDown && "nz-captured",
      this.props.className);

    return (
      <div
        className={className}
        onMouseDown={this._handleMouseDown}
      >
        <div className="nz-overlay" />
        {this.props.children}
      </div>
    );
  }

  private setIsMouseDown(isMouseDown: boolean) {
    this.setState(() => {
      return {
        isMouseDown,
      };
    });
  }

  private _handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    this.setIsMouseDown(true);
    this.props.onMouseDown && this.props.onMouseDown(e.nativeEvent);
  }

  private _handleDocumentMouseUp = (e: MouseEvent) => {
    if (!this.isMouseDown)
      return;

    this.setIsMouseDown(false);
    this.props.onMouseUp && this.props.onMouseUp(e);
  }

  private _handleDocumentMouseMove = (e: MouseEvent) => {
    if (!this.isMouseDown)
      return;

    this.props.onMouseMove && this.props.onMouseMove(e);
  }
}
