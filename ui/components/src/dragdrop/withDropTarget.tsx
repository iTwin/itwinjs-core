/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module DragDrop */
import * as React from "react";
import { DropTarget, DropTargetMonitor, ConnectDropTarget, DropTargetConnector, DndComponentClass } from "react-dnd";
import { DropTargetArguments, DragSourceArguments, DropTargetProps } from "./DragDropDef";

/** React properties for withDropTarget Higher-Order Component */
export interface WithDropTargetProps<DragDropObject = any> {
  /** Properties and callbacks for DropTarget */
  dropProps: DropTargetProps<DragDropObject>;
  /** Whether to propagate to parent DropTargets. */
  shallow?: boolean;
  /** Style properties for dropTarget wrapper element */
  dropStyle?: React.CSSProperties;
  /** @hidden */
  connectDropTarget?: ConnectDropTarget;
  /** @hidden */
  isOver?: boolean;
  /** @hidden */
  canDrop?: boolean;
  /** @hidden */
  item?: DragDropObject;
  /** @hidden */
  type?: string | symbol;
}

/**
 * HOC (Higher-Order Component) that transforms wrapped component into a DropTarget.
 * @param Component component to wrap.
 */
export const withDropTarget = <ComponentProps extends {}, DragDropObject = any>(
  // tslint:disable-next-line:variable-name
  Component: React.ComponentType<ComponentProps>,
): DndComponentClass<ComponentProps & WithDropTargetProps<DragDropObject>> => {
  type Props = ComponentProps & WithDropTargetProps<DragDropObject>;

  return DropTarget((props: Props): Array<string | symbol> => {
    if (props.dropProps.objectTypes) {
      if (typeof props.dropProps.objectTypes === "function")
        return props.dropProps.objectTypes();
      else
        return props.dropProps.objectTypes;
    }
    return [];
  }, {
      drop(props: Props, monitor: DropTargetMonitor, component: any) {
        const dragSourceArgs = monitor.getItem() as DragSourceArguments<DragDropObject>;
        if (monitor.isOver({ shallow: props.shallow || false })) {
          let dropRect: ClientRect = {} as ClientRect;
          const componentElement = component.rootElement;
          if (componentElement) {
            dropRect = componentElement.getBoundingClientRect();
          }

          const clientOffset = monitor.getClientOffset() || dragSourceArgs.clientOffset;
          const initialClientOffset = monitor.getInitialClientOffset() || dragSourceArgs.initialClientOffset;
          const sourceClientOffset = monitor.getSourceClientOffset() || dragSourceArgs.sourceClientOffset;
          const initialSourceClientOffset = monitor.getInitialSourceClientOffset() || dragSourceArgs.initialSourceClientOffset;

          const dropTargetArgs: DropTargetArguments<DragDropObject> = {
            ...dragSourceArgs,
            row: undefined, // clear stale row/col values to be set while propagating back down
            col: undefined,
            dropRect,
            clientOffset,
            initialClientOffset,
            sourceClientOffset,
            initialSourceClientOffset,
          };
          if (props.dropProps.onDropTargetDrop)
            return props.dropProps.onDropTargetDrop(dropTargetArgs);
        }
        return;
      },
      hover(props: Props, monitor: DropTargetMonitor, component: any) {
        if (monitor.isOver({ shallow: props.shallow || false }) && props.dropProps.onDropTargetOver) {
          const dragSourceArgs = monitor.getItem() as DragSourceArguments<DragDropObject>;
          let dropRect: ClientRect = {} as ClientRect;
          const componentElement = component.rootElement;
          if (componentElement) {
            dropRect = componentElement.getBoundingClientRect();
          }

          const clientOffset = monitor.getClientOffset() || dragSourceArgs.clientOffset;
          const initialClientOffset = monitor.getInitialClientOffset() || dragSourceArgs.initialClientOffset;
          const sourceClientOffset = monitor.getSourceClientOffset() || dragSourceArgs.sourceClientOffset;
          const initialSourceClientOffset = monitor.getInitialSourceClientOffset() || dragSourceArgs.initialSourceClientOffset;

          const dropTargetArgs: DropTargetArguments<DragDropObject> = {
            ...dragSourceArgs,
            row: undefined, // clear stale row/col values to be set while propagating back down
            col: undefined,
            dropRect,
            clientOffset,
            initialClientOffset,
            sourceClientOffset,
            initialSourceClientOffset,
          };
          props.dropProps.onDropTargetOver(dropTargetArgs);
        }
      },
      canDrop(props: Props, monitor: DropTargetMonitor) {
        if (monitor.isOver({ shallow: props.shallow || false }) && props.dropProps.canDropTargetDrop) {
          const dragSourceArgs = monitor.getItem() as DragSourceArguments<DragDropObject>;
          const clientOffset = monitor.getClientOffset() || dragSourceArgs.clientOffset;
          const initialClientOffset = monitor.getInitialClientOffset() || dragSourceArgs.initialClientOffset;
          const sourceClientOffset = monitor.getSourceClientOffset() || dragSourceArgs.sourceClientOffset;
          const initialSourceClientOffset = monitor.getInitialSourceClientOffset() || dragSourceArgs.initialSourceClientOffset;

          const dropTargetArgs: DropTargetArguments<DragDropObject> = {
            ...dragSourceArgs,
            clientOffset,
            initialClientOffset,
            sourceClientOffset,
            initialSourceClientOffset,
          };
          return props.dropProps.canDropTargetDrop(dropTargetArgs);
        }
        return true;
      },
    }, (connect: DropTargetConnector, monitor: DropTargetMonitor): Partial<WithDropTargetProps<DragDropObject>> => {
      return {
        connectDropTarget: connect.dropTarget(),
        isOver: monitor.isOver({ shallow: true }),
        canDrop: monitor.canDrop(),
        item: monitor.getItem(),
        type: monitor.getItemType() || undefined,
      };
    })(class WithDropTarget extends React.Component<Props> {
      public rootElement: HTMLDivElement | null = null;
      public render() {
        const {
          dropProps, shallow,
          connectDropTarget,
          isOver, canDrop, item, type,
          dropStyle,
          ...props } = this.props as WithDropTargetProps<DragDropObject>;

        const p = {
          item,
          type,
          isOver,
          canDrop,
        };
        return connectDropTarget!(
          <div className="drop-target-wrapper" data-testid="drop-target-wrapper" ref={(el) => { this.rootElement = el; }} style={this.props.dropStyle}>
            <Component {...props} {...(p as any)} />
          </div>,
        );
      }
    });
};
