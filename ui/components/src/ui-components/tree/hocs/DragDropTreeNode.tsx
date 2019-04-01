/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tree */

import * as React from "react";
import classnames from "classnames";
import { DndComponentClass } from "react-dnd";
import { TreeDragDropType } from "./withDragDrop";
import { withDragSource, WithDragSourceProps } from "../../dragdrop/withDragSource";
import { withDropTarget, WithDropTargetProps } from "../../dragdrop/withDropTarget";

import "./DragDropTreeNode.scss";

/** Properties for the [[DragDropTreeNodeComponent]] React component */
/** @internal */
export interface DragDropNodeProps extends React.AllHTMLAttributes<HTMLDivElement> {
  isOver?: boolean;
  isDragging?: boolean;
  canDrag?: boolean;
  canDrop?: boolean;
}

enum HoverMode {
  Above,
  On,
  Below,
}

/** @internal */
export interface DragDropNodeState {
  hoverMode: HoverMode;
}

// Used internally in ./Tree.tsx
/** @internal */
export class DragDropTreeNodeComponent extends React.Component<DragDropNodeProps, DragDropNodeState> {
  private _root: HTMLDivElement | null = null;
  public readonly state: DragDropNodeState = {
    hoverMode: HoverMode.On,
  };
  public render() {
    const { isOver, isDragging, canDrag, canDrop, ...props } = this.props as DragDropNodeProps;
    const mode = this.state.hoverMode;
    const classes = classnames(
      "node-drop-target",
      {
        above: canDrop && isOver && mode === HoverMode.Above,
        on: canDrop && isOver && mode === HoverMode.On,
        below: canDrop && isOver && mode === HoverMode.Below,
        dragging: isDragging,
      },
    );
    return (
      <div {...props} data-testid="node-drop-target" className={classes} ref={(el) => { this._root = el; }} onDragOver={this._handleDragOver}>
        {this.props.children}
      </div>
    );
  }

  private _handleDragOver = (event: React.DragEvent) => {
    if (this.props.isOver && this._root) {
      const rect = this._root.getBoundingClientRect();
      let relativeY = (event.clientY - rect.top) / rect.height;
      // istanbul ignore next
      if (this.props.style !== undefined &&
        this.props.style.top !== undefined && typeof this.props.style.top === "number" &&
        this.props.style.height !== undefined && typeof this.props.style.height === "number")
        relativeY = (event.clientY - this.props.style.top) / this.props.style.height;
      if (relativeY < 1 / 3) {
        if (this.state.hoverMode !== HoverMode.Above)
          this.setState({ hoverMode: HoverMode.Above });
      } else if (relativeY < 2 / 3) {
        if (this.state.hoverMode !== HoverMode.On)
          this.setState({ hoverMode: HoverMode.On });
      } else {
        if (this.state.hoverMode !== HoverMode.Below)
          this.setState({ hoverMode: HoverMode.Below });
      }
    }
  }
}

/** @internal */
export function DragDropTreeNode<DragDropObject extends TreeDragDropType>(): DndComponentClass<DragDropNodeProps & WithDropTargetProps<DragDropObject> & WithDragSourceProps<DragDropObject>> {
  return withDropTarget<DragDropNodeProps & WithDragSourceProps<DragDropObject>, DragDropObject>(
    withDragSource<DragDropNodeProps, DragDropObject>(DragDropTreeNodeComponent));
}
