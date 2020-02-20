/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Breadcrumb
 */

import * as React from "react";
import { DndComponentClass } from "react-dnd";
import classnames from "classnames";
import { TreeDragDropType } from "../../tree/hocs/withDragDrop";
import { withDragSource, WithDragSourceProps } from "../../dragdrop/withDragSource";
import { withDropTarget, WithDropTargetProps } from "../../dragdrop/withDropTarget";

// tslint:disable:deprecation

/** @internal */
export interface DragDropBreadcrumbNodeProps extends React.AllHTMLAttributes<HTMLSpanElement> {
  isOver?: boolean;
  isDragging?: boolean;
  canDrag?: boolean;
  canDrop?: boolean;
}

// Used internally in ./Breadcrumb.tsx
/** @internal */
export class DragDropBreadcrumbNodeComponent extends React.Component<DragDropBreadcrumbNodeProps> {
  public render() {
    const { isOver, isDragging, canDrag, canDrop, ...props } = this.props as DragDropBreadcrumbNodeProps;
    const classes = classnames(
      "components-breadcrumb-drop-target",
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

/** @internal */
export function DragDropBreadcrumbNode<DragDropObject extends TreeDragDropType>(): DndComponentClass<DragDropBreadcrumbNodeProps & WithDragSourceProps<DragDropObject> & WithDropTargetProps<DragDropObject>> {
  return withDropTarget<DragDropBreadcrumbNodeProps & WithDragSourceProps<DragDropObject>, DragDropObject>(
    withDragSource<DragDropBreadcrumbNodeProps, DragDropObject>(DragDropBreadcrumbNodeComponent));
}
