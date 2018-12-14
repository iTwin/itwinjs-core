/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Popup */

import * as classnames from "classnames";
import * as React from "react";
import { CssProperties } from "../../utilities/Css";
import { CommonProps } from "../../utilities/Props";
import { Point, PointProps } from "../../utilities/Point";
import { Rectangle, RectangleProps } from "../../utilities/Rectangle";
import { SizeProps, Size } from "../../utilities/Size";
import "./Tooltip.scss";

/** Properties of [[Tooltip]] component. */
export interface TooltipProps extends CommonProps {
  /** Tooltip content. */
  children?: React.ReactNode;
  /** Position of the tooltip. */
  position?: PointProps;
  /** Function called when the bounds of the tooltip changes. */
  onSizeChanged?: (size: SizeProps) => void;
}

export const offsetAndContainInContainer = (offset: PointProps = new Point(20, 20)) => (relativeTooltipBounds: RectangleProps, containerSize: SizeProps) => {
  const tooltipBounds = Rectangle.create(relativeTooltipBounds);
  let newBounds = tooltipBounds.offset(offset);
  const containerBounds = Rectangle.createFromSize(containerSize);
  if (containerBounds.contains(newBounds))
    return newBounds.topLeft();

  newBounds = newBounds.containIn(containerBounds);
  return newBounds.topLeft();
};

/** Positionable tooltip component. */
export class Tooltip extends React.PureComponent<TooltipProps> {
  public static readonly defaultProps: Partial<TooltipProps> = {
    position: {
      x: 0,
      y: 0,
    },
  };

  private _lastSize = new Size();
  private _tooltip = React.createRef<HTMLDivElement>();

  public render() {
    const className = classnames(
      "nz-popup-tooltip-tooltip",
      this.props.className);

    const style: React.CSSProperties = {
      ...this.props.style,
      ...CssProperties.fromPosition(this.props.position || { x: 0, y: 0 }),
    };

    return (
      <div
        className={className}
        ref={this._tooltip}
        style={style}
      >
        {this.props.children}
      </div>
    );
  }

  public componentDidMount() {
    this.onSizeChanged();
  }

  public componentDidUpdate(): void {
    this.onSizeChanged();
  }

  private onSizeChanged() {
    const tooltip = this._tooltip.current;
    if (!tooltip)
      return;

    const rect = tooltip.getBoundingClientRect();
    const size = {
      height: rect.height,
      width: rect.width,
    };

    if (this._lastSize.equals(size))
      return;

    this._lastSize = Size.create(size);
    this.props.onSizeChanged && this.props.onSizeChanged(size);
  }
}
