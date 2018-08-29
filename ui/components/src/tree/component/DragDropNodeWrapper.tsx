/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Tree */

import * as React from "react";
import classnames from "classnames";
import { TreeNode, NodeProps } from "@bentley/ui-core";
import { withDragSource, withDropTarget } from "../../dragdrop";

import "./Tree.scss";

/** Props for the TreeNode React component */
/** @hidden */
export interface DragDropNodeProps extends NodeProps {
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

/** @hidden */
export interface DragDropNodeState {
  hoverMode: HoverMode;
}

// Used internally in ./Tree.tsx
/** @hidden */
export class DragDropTreeNodeComponent extends React.Component<DragDropNodeProps> {
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
      <div className={classes} ref={(el) => { this._root = el; }} onDragOver={this._handleDragOver}>
        <TreeNode {...props} />
      </div>
    );
  }

  private _handleDragOver = (event: React.DragEvent) => {
    if (this.props.isOver && this._root) {
      const rect = this._root.getBoundingClientRect();
      const relativeY = (event.clientY - rect.top) / rect.height;
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
/** @hidden */
export const DragDropTreeNode = withDropTarget(withDragSource(DragDropTreeNodeComponent)); // tslint:disable-line:variable-name
