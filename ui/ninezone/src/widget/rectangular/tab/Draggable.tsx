/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Widget */

import * as classnames from "classnames";
import * as React from "react";

import PointerCaptor from "../../../base/PointerCaptor";
import Point, { PointProps } from "../../../utilities/Point";

import "./Draggable.scss";
import Tab, { TabProps } from "./Tab";

export interface DraggableProps extends TabProps {
  onDragBehaviorChanged?: (isDragging: boolean) => void;
  onDrag?: (dragged: PointProps) => void;
}

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
          onMouseDown={this.handleMouseDown}
          onMouseUp={this.handleMouseUp}
          onMouseMove={this.handleMouseMove}
        >
          {children}
        </PointerCaptor>
      </Tab>
    );
  }

  private handleMouseDown = (e: MouseEvent) => {
    this._isMouseDown = true;
    e.preventDefault();

    this._last = this._initial = new Point(e.clientX, e.clientY);
  }

  private handleMouseUp = () => {
    if (!this._isMouseDown)
      return;

    if (!this._isDragging)
      this.props.onClick && this.props.onClick();

    this._isMouseDown = false;
    this.setIsDragging(false);
  }

  private handleMouseMove = (e: MouseEvent) => {
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
