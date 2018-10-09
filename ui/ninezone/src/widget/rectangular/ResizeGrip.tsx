/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Widget */

import * as classnames from "classnames";
import * as React from "react";
import PointerCaptor from "../../base/PointerCaptor";
import CommonProps from "../../utilities/Props";
import "./ResizeGrip.scss";
import Rectangle from "../../utilities/Rectangle";
import Point, { PointProps } from "../../utilities/Point";

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
  private _relativePosition?: Point;
  private _grip = React.createRef<HTMLDivElement>();

  public render() {
    const { className, ...props } = this.props;

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
        <div ref={this._grip} />
      </PointerCaptor>
    );
  }

  private _getRelativePosition(grip: HTMLDivElement, clientPos: PointProps) {
    const clientRect = grip.getBoundingClientRect();
    const bounds = Rectangle.create(clientRect);

    return bounds.topLeft().getOffsetTo(clientPos);
  }

  private _handleMouseDown = (e: MouseEvent) => {
    const grip = this._grip.current;
    if (!grip)
      return;

    e.preventDefault();

    this._relativePosition = this._getRelativePosition(grip, {
      x: e.clientX,
      y: e.clientY,
    });
  }

  private _handleMouseUp = () => {
    if (!this._relativePosition)
      return;

    this._relativePosition = undefined;
  }

  private _handleMouseMove = (e: MouseEvent) => {
    if (!this._relativePosition)
      return;

    const grip = this._grip.current;
    if (!grip)
      return;

    const relativePosition = this._getRelativePosition(grip, {
      x: e.clientX,
      y: e.clientY,
    });

    let difference = this._relativePosition.getOffsetTo(relativePosition);
    switch (this.props.direction) {
      case ResizeDirection.NorthSouth: {
        difference = difference.setX(0);
        break;
      }
      case ResizeDirection.EastWest: {
        difference = difference.setY(0);
        break;
      }
    }

    this.props.onResize && this.props.onResize(difference.x, difference.y);
  }
}
