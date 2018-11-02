/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Breadcrumb */

import * as React from "react";
import classnames from "classnames";
import { TreeDragDropType } from "../../tree/hocs/withDragDrop";
import { withDragSource, withDropTarget, WithDragSourceProps } from "../../dragdrop";

/** @hidden */
export interface DragDropBreadcrumbNodeProps extends React.AllHTMLAttributes<HTMLSpanElement> {
  isOver?: boolean;
  isDragging?: boolean;
  canDrag?: boolean;
  canDrop?: boolean;
}

// Used internally in ./Breadcrumb.tsx
/** @hidden */
export class DragDropBreadcrumbNodeComponent extends React.Component<DragDropBreadcrumbNodeProps> {
  public render() {
    const { isOver, isDragging, canDrag, canDrop, ...props } = this.props as DragDropBreadcrumbNodeProps;
    const classes = classnames(
      "breadcrumb-drop-target",
      {
        hover: canDrop && isOver,
        dragging: isDragging,
      });
    return (
      <div className={classes} {...props}>
        {this.props.children}
      </div>
    );
  }
}

/** @hidden */
export function DragDropBreadcrumbNode<DragDropObject extends TreeDragDropType>() {
  return withDropTarget<DragDropBreadcrumbNodeProps & WithDragSourceProps<DragDropObject>, DragDropObject>(
    withDragSource<DragDropBreadcrumbNodeProps, DragDropObject>(DragDropBreadcrumbNodeComponent));
}
