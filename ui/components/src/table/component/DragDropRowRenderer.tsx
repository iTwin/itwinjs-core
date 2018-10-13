/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Table */

import * as React from "react";
import classnames from "classnames";
import { Row } from "react-data-grid";
import {
  withDragSource, withDropTarget,
  DragSourceArguments, DropTargetArguments,
  DragSourceProps,
} from "../../dragdrop";
import { TableDropTargetProps } from "./Table";

import "./Table.scss";

/** @hidden */
export interface DragDropRowProps {
  dragProps: DragSourceProps;
  dropProps: TableDropTargetProps;
  idx?: number;
}

interface RowWrapperProps {
  isDragging?: boolean;
  isOver?: boolean;
  canDrag?: boolean;
  canDrop?: boolean;
  canDropOn?: boolean;
}

enum HoverMode {
  Above,
  On,
  Below,
}

interface RowWrapperState {
  hoverMode: HoverMode;
}

class RowWrapper extends React.Component<RowWrapperProps, RowWrapperState> {
  private _root: HTMLDivElement | null = null;
  public readonly state: RowWrapperState = {
    hoverMode: HoverMode.Above,
  };
  public render(): React.ReactNode {
    const { isOver, isDragging, canDrag, canDrop, ...props } = this.props as RowWrapperProps;
    const mode = this.state.hoverMode;
    const classes = classnames(
      "table-drop-target",
      {
        above: canDrop && isOver && mode === HoverMode.Above,
        on: canDrop && isOver && mode === HoverMode.On,
        below: canDrop && isOver && mode === HoverMode.Below,
        dragging: isDragging,
      },
    );
    return (
      <div className={classes} ref={(el) => { this._root = el; }} onDragOver={this._handleDragOver}>
        <Row {...props} />
      </div>
    );
  }

  private _handleDragOver = (event: React.DragEvent) => {
    if (this.props.isOver && this._root) {
      const rect = this._root.getBoundingClientRect();
      const relativeY = (event.clientY - rect.top) / rect.height;
      if (this.props.canDropOn) {
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
      } else {
        if (relativeY < 1 / 2) {
          if (this.state.hoverMode !== HoverMode.Above)
            this.setState({ hoverMode: HoverMode.Above });
        } else {
          if (this.state.hoverMode !== HoverMode.Below)
            this.setState({ hoverMode: HoverMode.Below });
        }
      }
    }
  }
}

// Used only internally in ./Table.tsx
/** @hidden */
export class DragDropRow extends React.Component<DragDropRowProps> {
  public render(): React.ReactNode {
    // tslint:disable-next-line:variable-name
    const DDRow = withDragSource(withDropTarget(RowWrapper));
    const { dragProps, dropProps, ...props } = this.props as DragDropRowProps;
    const { onDropTargetDrop, onDropTargetOver, canDropTargetDrop, objectTypes, canDropOn } = dropProps;
    const dropTargetProps = {
      onDropTargetDrop: (args: DropTargetArguments): DropTargetArguments => {
        if ("idx" in this.props && this.props.idx !== undefined) {
          args.row = this.props.idx;
          if (args.dropRect) {
            const relativeY = (args.clientOffset.y - args.dropRect.top) / args.dropRect.height;
            if ((canDropOn && relativeY > 2 / 3) || (!canDropOn && relativeY > 1 / 2))
              args.row = this.props.idx + 1;
          }
        }
        return onDropTargetDrop ? onDropTargetDrop(args) : args; // Must return something for pass-through to OnDragSourceEnd.
      }, onDropTargetOver: (args: DropTargetArguments) => {
        if ("idx" in this.props && this.props.idx !== undefined && onDropTargetOver) {
          args.row = this.props.idx;
          if (args.dropRect) {
            const relativeY = (args.clientOffset.y - args.dropRect.top) / args.dropRect.height;
            if ((canDropOn && relativeY > 2 / 3) || (!canDropOn && relativeY > 1 / 2))
              args.row = this.props.idx + 1;
          }
          onDropTargetOver(args);
        }
      }, canDropTargetDrop: (args: DropTargetArguments) => {
        if ("idx" in this.props && this.props.idx !== undefined) {
          args.row = this.props.idx;
        }
        return canDropTargetDrop ? canDropTargetDrop(args) : true; // Must return something determining if item can drop.
      }, objectTypes,
    };
    const { onDragSourceBegin, onDragSourceEnd, objectType } = dragProps;
    const dragSourceProps = {
      onDragSourceBegin: (args: DragSourceArguments) => {
        if ("idx" in this.props && this.props.idx !== undefined) {
          args.row = this.props.idx;
        }
        return onDragSourceBegin ? onDragSourceBegin(args) : args; // Must return something for drag data.
      },
      onDragSourceEnd,
      objectType: () => {
        if (objectType) {
          if (typeof objectType === "function")
            return objectType({ row: this.props.idx });
          else
            return objectType;
        }
        return "";
      },
    };
    return (
      <DDRow
        canDropOn={(this.props.dropProps && this.props.dropProps.canDropOn) || false}
        {...props}
        dropProps={dropTargetProps}
        dragProps={dragSourceProps}
        shallow={false}
      />
    );
  }
}
