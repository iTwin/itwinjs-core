/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Popup */

import * as classnames from "classnames";
import * as React from "react";
import * as ReactDOM from "react-dom";
import Css, { CssProperties } from "../../utilities/Css";
import CommonProps from "../../utilities/Props";
import Point, { PointProps } from "../../utilities/Point";
import Rectangle, { RectangleProps } from "../../utilities/Rectangle";
import "./Tooltip.scss";

/** Properties of [[Tooltip]] component. */
export interface TooltipProps extends CommonProps {
  /** Tooltip content. */
  children?: React.ReactNode;
  /** Function called to determine the tooltip container. */
  containIn?: (tooltip: HTMLElement) => HTMLElement;
  /** Requested position of the tooltip. */
  position?: PointProps;
  /** Function called to update actual position of the tooltip. */
  adjustPosition?: (tooltip: Rectangle, container: Rectangle) => PointProps;
}

/** Default properties for [[TooltipProps]] used in [[Tooltip]] component. */
export interface TooltipDefaultProps extends TooltipProps {
  /** Default position of tooltip. */
  position: PointProps;
  /** Defaults to DOM parent of tooltip. */
  containIn: (tooltip: HTMLElement) => HTMLElement;
  /** By default does not adjust the tooltip position. */
  adjustPosition: (tooltip: Rectangle, container: Rectangle) => PointProps;
}

export const offsetAndContainInContainer = (offset: PointProps = new Point(20, 20)) => (tooltip: Rectangle, container: Rectangle) => {
  let newBounds = tooltip.offset(offset);
  if (container.contains(newBounds))
    return newBounds.topLeft();

  newBounds = newBounds.containIn(container);
  return newBounds.topLeft();
};

/** Tooltip component that follows the mouse. */
export default class Tooltip extends React.Component<TooltipProps> {
  public static readonly defaultProps: TooltipDefaultProps = {
    position: new Point(),
    containIn: (tooltip: HTMLElement) => {
      const parent = tooltip.parentNode;
      if (!parent || !(parent instanceof HTMLElement))
        throw new ReferenceError();
      return parent;
    },
    adjustPosition: (tooltip: RectangleProps) => {
      return new Point(tooltip.left, tooltip.top);
    },
  };

  public render() {
    const className = classnames(
      "nz-popup-tooltip-tooltip",
      this.props.className);

    const style: React.CSSProperties = {
      ...this.props.style,
      ...CssProperties.fromPosition(this.props.position!),
    };

    return (
      <div
        className={className}
        style={style}
      >
        {this.props.children}
      </div>
    );
  }

  public componentDidMount() {
    this.adjustPosition();
  }

  public componentDidUpdate(): void {
    this.adjustPosition();
  }

  private adjustPosition() {
    const tooltip = ReactDOM.findDOMNode(this);
    if (!tooltip || !(tooltip instanceof HTMLElement))
      throw new TypeError();

    const container = this.props.containIn!(tooltip);

    const x = this.props.position!.x;
    const y = this.props.position!.y;
    const tooltipRect = tooltip.getBoundingClientRect();
    const tooltipBounds = new Rectangle(x, y, x + tooltipRect.width, y + tooltipRect.height);
    const containerBounds = Rectangle.create(container.getBoundingClientRect());

    const newPos = this.props.adjustPosition!(tooltipBounds, containerBounds);
    const offset = tooltipBounds.topLeft().getOffsetTo(newPos);

    tooltip.style.left = Css.toPx(offset.x + x);
    tooltip.style.top = Css.toPx(offset.y + y);
  }
}
