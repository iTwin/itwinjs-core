/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Breadcrumb */

import * as React from "react";
import classnames from "classnames";
import { withDragSource, withDropTarget } from "../dragdrop";

/** @hidden */
export interface DragDropBreadcrumbButtonProps extends React.AllHTMLAttributes<HTMLSpanElement> {
  isOver?: boolean;
  isDragging?: boolean;
  canDrag?: boolean;
  canDrop?: boolean;
}

// Used internally in ./Breadcrumb.tsx
/** @hidden */
export class DragDropBreadcrumbButtonComponent extends React.Component<DragDropBreadcrumbButtonProps> {
  public render() {
    const { isOver, isDragging, canDrag, canDrop, ...props } = this.props as DragDropBreadcrumbButtonProps;
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
export const DragDropBreadcrumbButton = withDropTarget(withDragSource(DragDropBreadcrumbButtonComponent)); // tslint:disable-line:variable-name
