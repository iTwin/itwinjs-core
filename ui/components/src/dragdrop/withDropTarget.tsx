/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module DragDrop */
import * as React from "react";
import { DropTarget, DropTargetMonitor, ConnectDropTarget, DropTargetConnector } from "react-dnd";
import { DropTargetArguments, DragSourceArguments, DropTargetProps } from "./DragDropDef";

/** React properties for withDropTarget Higher-Order Component */
export interface WithDropTargetProps {
  /** Properties and callbacks for DropTarget */
  dropProps: DropTargetProps;
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
  item?: any;
  /** @hidden */
  type?: string | symbol;
}

/**
 * HOC (Higher-Order Component) that transforms wrapped component into a DropTarget.
 * @param Component component to wrap.
 */
export const withDropTarget = <ComponentProps extends {}>(
  // tslint:disable-next-line:variable-name
  Component: React.ComponentType<ComponentProps>,
) => {
  type Props = ComponentProps & WithDropTargetProps;

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
      const dragSourceArgs = monitor.getItem() as DragSourceArguments;
      if (monitor.isOver({ shallow: props.shallow || false })) {
        let dropRect: ClientRect = {} as ClientRect;
        const componentElement = component.rootElement;
        if (componentElement) {
          dropRect = componentElement.getBoundingClientRect();
        }

        const clientOffset = monitor.getClientOffset() || {x: 0, y: 0};
        const initialClientOffset = monitor.getInitialClientOffset() || {x: 0, y: 0};
        const sourceClientOffset = monitor.getSourceClientOffset() || undefined; // react-dnd likes null instead of undefined, reconstrain to undefined for null results
        const initialSourceClientOffset = monitor.getInitialSourceClientOffset() || undefined;

        const dropTargetArgs: DropTargetArguments = {
          dataObject: dragSourceArgs.dataObject,
          dropEffect: dragSourceArgs.dropEffect,
          dropStatus: dragSourceArgs.dropStatus,
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
        const dragSourceArgs = monitor.getItem() as DragSourceArguments;
        let dropRect: ClientRect = {} as ClientRect;
        const componentElement = component.rootElement;
        if (componentElement) {
          dropRect = componentElement.getBoundingClientRect();
        }

        const clientOffset = monitor.getClientOffset() || {x: 0, y: 0};
        const initialClientOffset = monitor.getInitialClientOffset() || {x: 0, y: 0};
        const sourceClientOffset = monitor.getSourceClientOffset() || undefined; // react-dnd likes null instead of undefined, reconstrain to undefined for null results
        const initialSourceClientOffset = monitor.getInitialSourceClientOffset() || undefined;

        const dropTargetArgs: DropTargetArguments = {
          dataObject: dragSourceArgs.dataObject,
          dropEffect: dragSourceArgs.dropEffect,
          dropStatus: dragSourceArgs.dropStatus,
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
        const dragSourceArgs = monitor.getItem() as DragSourceArguments;
        const clientOffset = monitor.getClientOffset() || {x: 0, y: 0};
        const initialClientOffset = monitor.getInitialClientOffset() || {x: 0, y: 0};
        const sourceClientOffset = monitor.getSourceClientOffset() || undefined; // react-dnd likes null instead of undefined, reconstrain to undefined for null results
        const initialSourceClientOffset = monitor.getInitialSourceClientOffset() || undefined;

        const dropTargetArgs: DropTargetArguments = {
          dataObject: dragSourceArgs.dataObject,
          dropEffect: dragSourceArgs.dropEffect,
          dropStatus: dragSourceArgs.dropStatus,
          clientOffset,
          initialClientOffset,
          sourceClientOffset,
          initialSourceClientOffset,
        };
        return props.dropProps.canDropTargetDrop(dropTargetArgs);
      }
      return true;
    },
  }, (connect: DropTargetConnector, monitor: DropTargetMonitor): Partial<WithDropTargetProps> => {
    return {
      connectDropTarget: connect.dropTarget(),
      isOver: monitor.isOver({shallow: true}),
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
        ...props } = this.props as WithDropTargetProps;

      const p = {
        item,
        type,
        isOver,
        canDrop,
      };
      return connectDropTarget!(
        <div ref={(el) => {this.rootElement = el; }} style={this.props.dropStyle}>
          <Component {...props} {...(p as any)}/>
        </div>,
      );
    }
  });
};
