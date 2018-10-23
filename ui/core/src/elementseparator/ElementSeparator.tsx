/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";

import "./ElementSeparator.scss";
import { Orientation } from "../enums/Orientation";

/** Properties of [[ElementSeparator]] React component */
export interface ElementSeparatorProps {
  /** Separator orientation */
  orientation: Orientation;
  /** Ratio between left cell and right cell */
  ratio: number;
  /** Area width or height (depending on orientation) in pixels */
  movableArea?: number;
  /** Callback to ratio changed event */
  onRatioChanged: (ratio: number) => void;
}

/** A movable button, which allows to change the ratio between left element and right element */
export class ElementSeparator extends React.PureComponent<ElementSeparatorProps> {
  private _dragStarted = false;
  private _initialGlobalPosition = 0;
  // How big must ratio difference be to trigger a rerender
  private readonly _updateThreshold = 0.025;
  // Width or height of the separator
  private readonly _separatorSize = 30;

  private getCurrentGlobalPosition(e: PointerEvent | React.PointerEvent) {
    return this.props.orientation === Orientation.Horizontal ? e.clientX : e.clientY;
  }

  private startDrag(e: PointerEvent | React.PointerEvent) {
    this._dragStarted = true;
    this._initialGlobalPosition = this.getCurrentGlobalPosition(e);

    document.addEventListener("pointerup", this._onPointerUp);
    document.addEventListener("pointermove", this._onPointerMove);
  }

  private stopDrag() {
    this._dragStarted = false;

    document.removeEventListener("pointerup", this._onPointerUp);
    document.removeEventListener("pointermove", this._onPointerMove);
  }

  private _onPointerUp = () => {
    this.stopDrag();
  }

  private _onPointerDown = (e: PointerEvent | React.PointerEvent) => {
    if (!this._dragStarted) {
      this.startDrag(e);
    } else {
      this.stopDrag();
    }
  }

  private _onPointerMove = (e: PointerEvent | React.PointerEvent) => {
    if (!this.props.movableArea) {
      this.stopDrag();
      return;
    }
    const positionChange = this.getCurrentGlobalPosition(e) - this._initialGlobalPosition;
    // Limit update count
    if (Math.abs(positionChange) < this.props.movableArea * this._updateThreshold)
      return;

    const currentLocalPosition = this.props.movableArea * this.props.ratio + positionChange;
    const ratio = currentLocalPosition / this.props.movableArea;

    this._initialGlobalPosition = this.getCurrentGlobalPosition(e);
    this.props.onRatioChanged(ratio);
  }

  private getStyle(orientation: Orientation): React.CSSProperties {
    if (orientation === Orientation.Horizontal)
      return {
        width: this._separatorSize,
        height: "100%",
        margin: `1px ${-Math.floor(this._separatorSize / 2)}px`,
        cursor: "col-resize",
      };
    return {
      width: "100%",
      height: this._separatorSize,
      margin: `${-Math.floor(this._separatorSize / 2)}px 1px`,
      cursor: "row-resize",
    };
  }

  public render() {
    return (
      <button
        style={this.getStyle(this.props.orientation)}
        className="core-element-separator"
        onPointerDown={this._onPointerDown}
      />
    );
  }
}
