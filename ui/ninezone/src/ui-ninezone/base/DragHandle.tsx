/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Base */

import * as React from "react";
import { CommonProps, Point, PointProps } from "@bentley/ui-core";
import { PointerCaptor } from "./PointerCaptor";

/** Properties of [[DragHandle]] component.
 * @internal
 */
export interface DragHandleProps extends CommonProps {
  /** Last pointer position of draggable tab. */
  lastPosition?: PointProps;
  /** Function called when component is clicked. */
  onClick?: () => void;
  /** Function called when component is dragged. */
  onDrag?: (dragged: PointProps) => void;
  /** Function called when component drag is started.
   * @param initialPosition Initial pointer position in window coordinates.
   */
  onDragStart?: (initialPosition: PointProps) => void;
  /** Function called when component drag is finished. */
  onDragEnd?: () => void;
}

interface DragHandleState {
  isMouseDown: boolean;
}

/** Drag handle component.
 * @internal
 */
export class DragHandle extends React.PureComponent<DragHandleProps, DragHandleState> {
  private _initial: Point | undefined = undefined;
  private _isDragged = false;

  public readonly state: DragHandleState = {
    isMouseDown: false,
  };

  public render() {
    return (
      <PointerCaptor
        children={this.props.children}
        className={this.props.className}
        isMouseDown={this.props.lastPosition === undefined ? this.state.isMouseDown : true}
        onClick={this._handleClick}
        onMouseDown={this._handleMouseDown}
        onMouseUp={this._handleMouseUp}
        onMouseMove={this._handleMouseMove}
        style={this.props.style}
      />
    );
  }

  private _handleMouseDown = (e: MouseEvent) => {
    this.setState({ isMouseDown: true });

    e.preventDefault();
    this._isDragged = false;
    this._initial = new Point(e.clientX, e.clientY);
  }

  private _handleMouseMove = (e: MouseEvent) => {
    const current = new Point(e.clientX, e.clientY);
    if (this.props.lastPosition) {
      const dragged = Point.create(this.props.lastPosition).getOffsetTo(current);
      this.props.onDrag && this.props.onDrag(dragged);
      return;
    }

    if (this._initial && current.getDistanceTo(this._initial) >= 6) {
      this._isDragged = true;
      this.props.onDragStart && this.props.onDragStart(this._initial);
    }
  }

  private _handleMouseUp = () => {
    this.setState({ isMouseDown: false });
    this._initial = undefined;
    if (this.props.lastPosition) {
      this.props.onDragEnd && this.props.onDragEnd();
      return;
    }
  }

  private _handleClick = () => {
    if (this._isDragged)
      return;
    this.props.onClick && this.props.onClick();
  }
}
