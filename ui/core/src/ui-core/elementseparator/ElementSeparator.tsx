/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ElementSeparator */

import * as React from "react";
import * as classnames from "classnames";

import "./ElementSeparator.scss";
import { Orientation } from "../enums/Orientation";
import { CommonProps } from "../utils/Props";

/** Properties of [[ElementSeparator]] React component
 * @public
 */
export interface ElementSeparatorProps extends CommonProps {
  /** Separator orientation */
  orientation: Orientation;
  /** Ratio between left cell and right cell */
  ratio: number;
  /** Area width or height (depending on orientation) in pixels */
  movableArea?: number;
  /** Separator width or height in pixels. 30 by default */
  separatorSize?: number;
  /** Callback to ratio changed event */
  onRatioChanged: (ratio: number) => void;
}

/** A movable button, which allows to change the ratio between left element and right element
 * @public
 */
export class ElementSeparator extends React.PureComponent<ElementSeparatorProps> {
  private _dragStarted = false;
  private _initialGlobalPosition = 0;
  // How big must ratio difference be to trigger a rerender. In pixels
  private readonly _updateThreshold = 3;

  public static defaultProps: Partial<ElementSeparatorProps> = {
    separatorSize: 30,
  };

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
    if (Math.abs(positionChange) < this._updateThreshold)
      return;

    const currentLocalPosition = this.props.movableArea * this.props.ratio + positionChange;
    const ratio = currentLocalPosition / this.props.movableArea;

    this._initialGlobalPosition = this.getCurrentGlobalPosition(e);
    this.props.onRatioChanged(ratio);
  }

  private getStyle(orientation: Orientation): React.CSSProperties {
    if (orientation === Orientation.Horizontal)
      return {
        width: this.props.separatorSize,
        margin: `1px ${-Math.floor(this.props.separatorSize! / 2)}px`,
      };
    return {
      height: this.props.separatorSize,
      margin: `${-Math.floor(this.props.separatorSize! / 2)}px 1px`,
    };
  }

  public render() {
    const classNames = classnames(
      "core-element-separator",
      (this.props.orientation === Orientation.Horizontal) ? "core-element-separator--horizontal" : "core-element-separator--vertical",
      this.props.className,
    );
    const styles: React.CSSProperties = {
      ...this.getStyle(this.props.orientation),
      ...this.props.style,
    };

    return (
      <button
        style={styles}
        className={classNames}
        onPointerDown={this._onPointerDown}
      />
    );
  }
}
