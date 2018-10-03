/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Table */

import * as React from "react";
import classnames from "classnames";
import * as RDG from "react-data-grid";

// tslint:disable-next-line:variable-name
const HeaderCell = (RDG && (RDG as any).HeaderCell) || (() => (<></>)); // react-data-grid @types does not support the HeaderCell export, but it is exported in the js-only library.

import {
  withDragSource, DragSourceArguments,
  withDropTarget, DropTargetArguments,
} from "../../dragdrop";
import { ColumnDragLayer } from "./ColumnDragLayer";

/** @hidden */
export interface DragDropHeaderCellProps {
  onHeaderDrop?: (source: string, target: string) => void; // inherited by parent
  column: any; // inherited by parent
}

interface HeaderWrapperProps {
  item?: DropTargetArguments;
  type?: string;
  isDragging?: boolean;
  isOver?: boolean;
  canDrag?: boolean;
  canDrop?: boolean;
}

class HeaderWrapper extends React.Component<HeaderWrapperProps> {
  public render(): React.ReactNode {
    const { type, item, isOver, isDragging, canDrag, canDrop, ...props } = this.props as HeaderWrapperProps;

    let mode = 0;
    if (item && item.clientOffset && item.initialClientOffset) {
      if (item.clientOffset.x > item.initialClientOffset.x)
        mode = 1;
      else
        mode = -1;
    }

    const classes = classnames(
      "table-header-drag-drop",
      {
        left: canDrop && !isDragging && isOver && mode === -1,
        right: canDrop && !isDragging && isOver && mode === 1,
        dragging: isDragging,
      },
    );
    return (
      <div className={classes}>
        <HeaderCell {...props} />
      </div>
    );
  }
}

// Used only internally in ./Table.tsx
/** @hidden */
export class DragDropHeaderCell extends React.Component<DragDropHeaderCellProps> {
  public render(): React.ReactNode {
    const { column } = this.props;
    // tslint:disable-next-line:variable-name
    const DDHeader = withDragSource(withDropTarget(HeaderWrapper));
    const dropTargetProps = {
      onDropTargetDrop: (args: DropTargetArguments): DropTargetArguments => {
        const sourceKey = args.dataObject.key || "";
        const sourceXpos = args.dataObject.xpos || 0;
        const targetKey = (column && column.key) || "";
        const targetXpos = (column && column.left) || 0;
        args.dataObject = { sourceKey, targetKey, sourceXpos, targetXpos };
        return args;
      },
      objectTypes: ["Column"],
    };
    const dragSourceProps = {
      onDragSourceBegin: (args: DragSourceArguments) => {
        args.dataObject = {
          key: (column && column.key) || "",
          xpos: (column && column.left) || "",
          column,
        };
        return args;
      },
      onDragSourceEnd: (args: DragSourceArguments) => {
        const { sourceKey, targetKey } = args.dataObject;
        this.props.onHeaderDrop && this.props.onHeaderDrop(sourceKey, targetKey);
      },
      objectType: () => {
        return "Column";
      },
      defaultDragLayer: ColumnDragLayer,
    };
    return (
      <DDHeader
        {...this.props}
        dragProps={dragSourceProps}
        dropProps={dropTargetProps}
        shallow={false}
      />
    );
  }
}
