/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Table */

import * as React from "react";
import * as classnames from "classnames";
import { Row } from "react-data-grid";
import {
  withDragSource, withDropTarget,
  DragSourceArguments, DropTargetArguments,
} from "../../dragdrop";

import "./Table.scss";

/** @hidden */
export interface DragDropRowProps {
  onDropTargetDrop?: (data: DropTargetArguments) => DragSourceArguments;
  onDropTargetOver?: (data: DropTargetArguments) => void;
  canDropTargetDrop?: (data: DropTargetArguments) => boolean;
  onDragSourceBegin?: (data: DragSourceArguments) => DragSourceArguments;
  onDragSourceEnd?: (data: DragSourceArguments) => void;
  objectType?: string | ((data: any) => string);
  objectTypes?: string[];
  canDropOn?: boolean;
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

/** @hidden */
interface RowWrapperState {
  hoverMode: HoverMode;
}

class RowWrapper extends React.Component<any & RowWrapperProps, RowWrapperState> {
  private _root: HTMLDivElement | null = null;
  public readonly state: RowWrapperState = {
    hoverMode: HoverMode.Above,
  };
  public render(): React.ReactElement<any> {
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
export class DragDropRow extends React.Component<DragDropRowProps & any> {
  public render(): React.ReactElement<any> {
    // tslint:disable-next-line:variable-name
    const DDRow = withDragSource(withDropTarget(RowWrapper));
    const { onDropTargetDrop, onDropTargetOver, canDropTargetDrop, onDragSourceBegin, onDragSourceEnd, objectType, objectTypes, ...props } = this.props as DragDropRowProps;
    return (
      <DDRow
        {...props}
        onDropTargetDrop={(args: DropTargetArguments): DropTargetArguments => {
          if ("idx" in this.props && this.props.idx !== undefined) {
            args.row = this.props.idx;
            if (args.dropRect) {
              const relativeY = (args.clientOffset.y - args.dropRect.top) / args.dropRect.height;
              if (relativeY > 1 / 2) {
                args.row = this.props.idx + 1;
              }
            }
          }
          if (this.props.onDropTargetDrop) return this.props.onDropTargetDrop(args);
          return args;
        }}
        onDropTargetOver={(args: DropTargetArguments) => {
          if ("idx" in this.props && this.props.idx !== undefined) {
            args.row = this.props.idx;
            if (args.dropRect) {
              const relativeY = (args.clientOffset.y - args.dropRect.top) / args.dropRect.height;
              if (relativeY > 1 / 2) {
                args.row = this.props.idx + 1;
              }
            }
          }
          if (this.props.onDropTargetOver) this.props.onDropTargetOver(args);
        }}
        canDropTargetDrop={(args: DropTargetArguments) => {
          if ("idx" in this.props && this.props.idx !== undefined) {
            args.row = this.props.idx;
          }
          if (this.props.canDropTargetDrop) return this.props.canDropTargetDrop(args);
          return true;
        }}
        onDragSourceBegin={(args: DragSourceArguments) => {
          if ("idx" in this.props && this.props.idx !== undefined) {
            args.row = this.props.idx;
          }
          if (this.props.onDragSourceBegin) return this.props.onDragSourceBegin(args);
          return args;
        }}
        onDragSourceEnd={this.props.onDragSourceEnd}
        objectType={() => {
          if (this.props.objectType) {
            if (typeof this.props.objectType === "function")
              return this.props.objectType({ row: this.props.idx });
            else
              return this.props.objectType;
          }
          return "";
        }}
        objectTypes={this.props.objectTypes}
        shallow={false}
      />
    );
  }
}
