/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Popup */

import * as classnames from "classnames";
import * as React from "react";
import * as ReactDOM from "react-dom";
import MouseTracker from "../../context/MouseTracker";
import Css from "../../utilities/Css";
import CommonProps from "../../utilities/Props";
import "./Tooltip.scss";

/** Properties of [[Tooltip]] component. */
export interface TooltipProps extends CommonProps {
  /** Tooltip content. */
  children?: React.ReactNode;
}

/** Tooltip component that follows the mouse. */
export default class Tooltip extends React.Component<TooltipProps> {
  public render() {
    const className = classnames(
      "nz-popup-tooltip-tooltip",
      this.props.className);

    return (
      <div
        className={className}
        style={this.props.style}
      >
        <MouseTracker onCoordinatesChange={this.handleCoordinatesChange} />
        {this.props.children}
      </div>
    );
  }

  private alignTooltip(mouseX: number, mouseY: number) {
    const me = ReactDOM.findDOMNode(this) as HTMLElement;

    const parent = me.parentNode as Element;
    if (!parent)
      return;

    const parentRect = parent.getBoundingClientRect();

    const offset = 20;
    let left = mouseX + offset;
    let top = mouseY + offset;

    const right = left + me.clientWidth;
    const bottom = top + me.clientHeight;

    const diffToContainRight = right - parentRect.right;
    const diffToContainBottom = bottom - parentRect.bottom;
    if (diffToContainRight > 0)
      left -= diffToContainRight;
    if (diffToContainBottom > 0)
      top -= diffToContainBottom;

    if (left < parentRect.left)
      left = parentRect.left;
    if (top < parentRect.top)
      top = parentRect.top;

    me.style.left = Css.toPx(left - parentRect.left);
    me.style.top = Css.toPx(top - parentRect.top);
  }

  private handleCoordinatesChange = (x: number, y: number) => {
    this.alignTooltip(x, y);
  }
}
