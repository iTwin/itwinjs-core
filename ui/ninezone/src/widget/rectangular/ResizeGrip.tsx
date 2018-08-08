/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Widget */

import * as classnames from "classnames";
import * as React from "react";
import PointerCaptor from "../../base/PointerCaptor";
import CommonProps from "../../utilities/Props";
import "./ResizeGrip.scss";

/** Properties of [[ResizeGrip]] component. */
export interface ResizeGripProps extends CommonProps {
  onResize?: (x: number, y: number) => void;
  direction: ResizeDirection;
}

/** Available resize directions of resize grip. */
export enum ResizeDirection {
  EastWest,
  NorthSouth,
  NorthEast_SouthWest,
  NorthWest_SouthEast,
}

/** Helpers for [[ResizeDirection]]. */
export class ResizeDirectionHelpers {
  /** Class name of [[ResizeDirection.EastWest]] */
  public static readonly EW_CLASS_NAME = "nz-direction-ew";
  /** Class name of [[ResizeDirection.NorthSouth]] */
  public static readonly NS_CLASS_NAME = "nz-direction-ns";
  /** Class name of [[ResizeDirection.NorthEast_SouthWest]] */
  public static readonly NE_SW_CLASS_NAME = "nz-direction-ne-sw";
  /** Class name of [[ResizeDirection.NorthWest_SouthEast]] */
  public static readonly NW_SE_CLASS_NAME = "nz-direction-nw-se";

  /** @returns Returns class name of specified [[ResizeDirection]] */
  public static getCssClassName(direction: ResizeDirection): string {
    switch (direction) {
      case ResizeDirection.EastWest:
        return ResizeDirectionHelpers.EW_CLASS_NAME;
      case ResizeDirection.NorthSouth:
        return ResizeDirectionHelpers.NS_CLASS_NAME;
      case ResizeDirection.NorthEast_SouthWest:
        return ResizeDirectionHelpers.NE_SW_CLASS_NAME;
      case ResizeDirection.NorthWest_SouthEast:
        return ResizeDirectionHelpers.NW_SE_CLASS_NAME;
    }
  }
}

/** Resize grip used by [[Stacked]] component. */
export default class ResizeGrip extends React.Component<ResizeGripProps> {
  private _isDragging = false;
  private _lastX = 0;
  private _lastY = 0;

  public render() {
    const { className, ...props } = this.props;

    const pointerCaptorClassName = classnames(
      "nz-widget-rectangular-resizeGrip",
      ResizeDirectionHelpers.getCssClassName(this.props.direction),
      this.props.className);

    return (
      <PointerCaptor
        className={pointerCaptorClassName}
        onMouseDown={this.handleMouseDown}
        onMouseUp={this.handleMouseUp}
        onMouseMove={this.handleMouseMove}
        {...props}
      />
    );
  }

  private handleMouseDown = (e: MouseEvent) => {
    this._isDragging = true;
    e.preventDefault();

    this._lastX = e.clientX;
    this._lastY = e.clientY;
  }

  private handleMouseUp = () => {
    if (!this._isDragging)
      return;

    this._isDragging = false;
  }

  private handleMouseMove = (e: MouseEvent) => {
    if (!this._isDragging)
      return;

    let x = e.clientX - this._lastX;
    let y = e.clientY - this._lastY;

    switch (this.props.direction) {
      case ResizeDirection.NorthSouth: {
        x = 0;
        break;
      }
      case ResizeDirection.EastWest: {
        y = 0;
        break;
      }
    }

    this.props.onResize && this.props.onResize(x, y);

    this._lastX = e.clientX;
    this._lastY = e.clientY;
  }
}
