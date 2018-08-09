/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module DragDrop */
import * as React from "react";
import { DropTarget, DropTargetSpec, DropTargetMonitor, ConnectDropTarget, DropTargetConnector } from "react-dnd";
import { DropTargetArguments, DragSourceArguments } from "./DragDropDef";

/** React properties for withDropTarget Higher-Order Component */
export interface WithDropTargetProps {
  /**
   * Triggered when item is dropped on wrapped component.
   * Return value is passed to the DragSource's onDragSourceEnd callback.
   */
  onDropTargetDrop?: (args: DropTargetArguments) => DragSourceArguments;
  /** Triggered when item is dragged over wrapped component. */
  onDropTargetOver?: (args: DropTargetArguments) => void;
  /** Determines whether item may be dropped on DropTarget. */
  canDropTargetDrop?: (args: DropTargetArguments) => boolean;
  /** List of allowed object types */
  objectTypes?: string[] | (() => string[]);
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
  type?: string;
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
  class WithDropTarget extends React.Component<Props> {
    public rootElement: HTMLDivElement | null = null;
    public render() {
      const {
        onDropTargetDrop, onDropTargetOver, canDropTargetDrop, objectTypes, shallow,
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
  }
  const target: DropTargetSpec<Props> = {
    drop(props: Props, monitor: DropTargetMonitor, component: WithDropTarget) {
      const dragSourceArgs = monitor.getItem() as DragSourceArguments;
      if (monitor.isOver({ shallow: props.shallow || false })) {
        let dropRect: ClientRect = {} as ClientRect;
        const componentElement = component.rootElement;
        if (componentElement) {
          dropRect = componentElement.getBoundingClientRect();
        }

        const clientOffset = monitor.getClientOffset();
        const initialClientOffset = monitor.getInitialClientOffset();
        const sourceClientOffset = monitor.getSourceClientOffset();
        const initialSourceClientOffset = monitor.getInitialSourceClientOffset();

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
        if (props.onDropTargetDrop) return props.onDropTargetDrop(dropTargetArgs);
      }
      return;
    },
    hover(props: Props, monitor: DropTargetMonitor, component: WithDropTarget) {
      if (monitor.isOver({ shallow: props.shallow || false }) && props.onDropTargetOver) {
        const dragSourceArgs = monitor.getItem() as DragSourceArguments;
        let dropRect: ClientRect = {} as ClientRect;
        const componentElement = component.rootElement;
        if (componentElement) {
          dropRect = componentElement.getBoundingClientRect();
        }

        const clientOffset = monitor.getClientOffset();
        const initialClientOffset = monitor.getInitialClientOffset();
        const sourceClientOffset = monitor.getSourceClientOffset();
        const initialSourceClientOffset = monitor.getInitialSourceClientOffset();

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
        props.onDropTargetOver(dropTargetArgs);
      }
    },
    canDrop(props: Props, monitor: DropTargetMonitor) {
      if (monitor.isOver({ shallow: props.shallow || false }) && props.canDropTargetDrop) {
        const dragSourceArgs = monitor.getItem() as DragSourceArguments;
        const clientOffset = monitor.getClientOffset();
        const initialClientOffset = monitor.getInitialClientOffset();
        const sourceClientOffset = monitor.getSourceClientOffset();
        const initialSourceClientOffset = monitor.getInitialSourceClientOffset();

        const dropTargetArgs: DropTargetArguments = {
          dataObject: dragSourceArgs.dataObject,
          dropEffect: dragSourceArgs.dropEffect,
          dropStatus: dragSourceArgs.dropStatus,
          clientOffset,
          initialClientOffset,
          sourceClientOffset,
          initialSourceClientOffset,
        };
        return props.canDropTargetDrop(dropTargetArgs);
      }
      return true;
    },
  };

  function collect(connect: DropTargetConnector, monitor: DropTargetMonitor): Partial<WithDropTargetProps> {
    return {
      connectDropTarget: connect.dropTarget(),
      isOver: monitor.isOver({shallow: true}),
      canDrop: monitor.canDrop(),
      item: monitor.getItem(),
      type: monitor.getItemType(),
    };
  }

  function types(props: Props): string[] {
    if (props.objectTypes) {
      if (typeof props.objectTypes === "function")
        return props.objectTypes();
      else
        return props.objectTypes;
    }
    return [];
  }

  return DropTarget(types, target, collect)(WithDropTarget);
};
