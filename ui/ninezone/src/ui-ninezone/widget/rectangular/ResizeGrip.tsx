/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Widget */

import * as classnames from "classnames";
import * as React from "react";
import { CommonProps } from "@bentley/ui-core";
import { PointerCaptor } from "../../base/PointerCaptor";
import { Rectangle, RectangleProps } from "../../utilities/Rectangle";
import { PointProps, Point } from "../../utilities/Point";
import "./ResizeGrip.scss";

/** Available resize directions of resize grip.
 * @alpha
 */
export enum ResizeDirection {
  EastWest,
  NorthSouth,
  NorthEast_SouthWest,
  NorthWest_SouthEast,
}

/** Helpers for [[ResizeDirection]].
 * @alpha
 */
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

/** Arguments used in resize actions of [[ResizeGrip]] component.
 * @alpha
 */
export interface ResizeGripResizeArgs {
  /** Pointer position. */
  readonly position: PointProps;
  /** Grip bounds. */
  readonly bounds: RectangleProps;
}

/** Properties of [[ResizeGrip]] component.
 * @alpha
 */
export interface ResizeGripProps extends CommonProps {
  /** Function called when grip is clicked. */
  onClick?: () => void;
  /** Function called when grip is resized. */
  onResize?: (args: ResizeGripResizeArgs) => void;
  /** Function called when resize action is ended. */
  onResizeEnd?: (args: ResizeGripResizeArgs) => void;
  /** Function called when resize action is started. */
  onResizeStart?: (args: ResizeGripResizeArgs) => void;
  /** Available resize directions of resize grip. */
  direction: ResizeDirection;
}

/** Resize grip used by [[Stacked]] component.
 * @alpha
 */
export class ResizeGrip extends React.PureComponent<ResizeGripProps> {
  private _grip = React.createRef<HTMLDivElement>();
  private _isResizing = false;
  private _movedBy = 0;
  private _lastPosition = new Point();

  public render() {
    const { className, onClick, ...props } = this.props;

    const pointerCaptorClassName = classnames(
      "nz-widget-rectangular-resizeGrip",
      ResizeDirectionHelpers.getCssClassName(this.props.direction),
      this.props.className);

    return (
      <PointerCaptor
        className={pointerCaptorClassName}
        onMouseDown={this._handleMouseDown}
        onMouseUp={this._handleMouseUp}
        onMouseMove={this._handleMouseMove}
        {...props}
      >
        <div
          className="nz-grip"
          onClick={this._handleClick}
          ref={this._grip}
        />
      </PointerCaptor>
    );
  }

  private _handleClick = () => {
    if (this._movedBy > 0)
      return;
    this.props.onClick && this.props.onClick();
  }

  private _handleMouseDown = (e: MouseEvent) => {
    const grip = this._grip.current;
    if (!grip)
      return;

    this._movedBy = 0;
    this._lastPosition = new Point(e.clientX, e.clientY);

    this._isResizing = true;
    e.preventDefault();

    const bounds = Rectangle.create(grip.getBoundingClientRect());
    this.props.onResizeStart && this.props.onResizeStart({
      position: {
        x: e.clientX,
        y: e.clientY,
      },
      bounds: bounds.toProps(),
    });
  }

  private _handleMouseUp = (e: MouseEvent) => {
    const grip = this._grip.current;
    if (!this._isResizing || !grip)
      return;

    const newPosition = new Point(e.clientX, e.clientY);
    this._movedBy += newPosition.getManhattanDistanceTo(this._lastPosition);
    this._lastPosition = newPosition;

    e.preventDefault();
    this._isResizing = false;
    const bounds = Rectangle.create(grip.getBoundingClientRect());
    this.props.onResizeEnd && this.props.onResizeEnd({
      position: {
        x: e.clientX,
        y: e.clientY,
      },
      bounds: bounds.toProps(),
    });
  }

  private _handleMouseMove = (e: MouseEvent) => {
    const grip = this._grip.current;
    if (!this._isResizing || !grip)
      return;

    const newPosition = new Point(e.clientX, e.clientY);
    this._movedBy += newPosition.getManhattanDistanceTo(this._lastPosition);
    this._lastPosition = newPosition;

    const bounds = Rectangle.create(grip.getBoundingClientRect());
    this.props.onResize && this.props.onResize({
      position: {
        x: e.clientX,
        y: e.clientY,
      },
      bounds: bounds.toProps(),
    });
  }
}
