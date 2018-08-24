/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Widget */

import * as classnames from "classnames";
import * as React from "react";
import PointerCaptor from "../../../base/PointerCaptor";
import Point, { PointProps } from "../../../utilities/Point";
import Tab, { TabProps } from "./Tab";
import "./Draggable.scss";

/** Properties of [[Draggable]] component. */
export interface DraggableProps extends TabProps {
  /** Function called when drag behavior changes. */
  onDragBehaviorChanged?: (isDragging: boolean) => void;
  /** Function called when tab is dragged. */
  onDrag?: (dragged: PointProps) => void;
}

/** Draggable tab of rectangular widget. Used in [[Stacked]] component. */
export default class Draggable extends React.Component<DraggableProps> {
  private _isDragging = false;
  private _isMouseDown = false;
  private _initial = new Point(0, 0);
  private _last = new Point(0, 0);

  public render() {
    const tabClassName = classnames(
      "nz-widget-rectangular-tab-draggable",
      this.props.className);

    const { className, onClick, children, ...props } = this.props;

    return (
      <Tab
        className={tabClassName}
        {...props}
      >
        <PointerCaptor
          className="nz-draggable"
          onMouseDown={this._handleMouseDown}
          onMouseUp={this._handleMouseUp}
          onMouseMove={this._handleMouseMove}
        >
          {children}
        </PointerCaptor>
      </Tab>
    );
  }

  private _handleMouseDown = (e: MouseEvent) => {
    this._isMouseDown = true;
    e.preventDefault();

    this._last = this._initial = new Point(e.clientX, e.clientY);
  }

  private _handleMouseUp = () => {
    if (!this._isMouseDown)
      return;

    if (!this._isDragging)
      this.props.onClick && this.props.onClick();

    this._isMouseDown = false;
    this.setIsDragging(false);
  }

  private _handleMouseMove = (e: MouseEvent) => {
    if (!this._isMouseDown)
      return;

    const current = new Point(e.clientX, e.clientY);
    if (current.getDistanceTo(this._initial) >= 6)
      this.setIsDragging(true);

    if (this._isDragging) {
      const dragged = this._last.getOffsetTo(current);
      this.props.onDrag && this.props.onDrag(dragged);
      this._last = current;
    }
  }

  private setIsDragging(isDragging: boolean) {
    if (this._isDragging === isDragging)
      return;

    this._isDragging = isDragging;
    this.props.onDragBehaviorChanged && this.props.onDragBehaviorChanged(isDragging);
  }
}
