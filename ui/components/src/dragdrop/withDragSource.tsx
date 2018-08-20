/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module DragDrop */
import * as React from "react";
import { DragSource, DragSourceMonitor, ConnectDragSource, DragSourceConnector, ConnectDragPreview } from "react-dnd";
import { DragSourceArguments, DropEffects, DropStatus, DropTargetArguments } from "./DragDropDef";

/** React properties for withDragSource Higher-Order Component */
export interface WithDragSourceProps {
  /** Triggered when DragSource has begun a drag. */
  onDragSourceBegin?: (data: DragSourceArguments) => DragSourceArguments;
  /**
   * Triggered when a DragSource drag has ended.
   * Callback is always called after an onDragSourceBegin callback, regardless of whether the drag was successful.
   */
  onDragSourceEnd?: (data: DragSourceArguments) => void;
  /** Specifies the DragSource type. */
  objectType?: (() => string) | string;
  /** Style properties for dropTarget wrapper element */
  dragStyle?: React.CSSProperties;
  defaultDropEffect?: DropEffects;
  ctrlDropEffect?: DropEffects;
  altDropEffect?: DropEffects;
  /** @hidden */
  connectDragSource?: ConnectDragSource;
  /** @hidden */
  connectDragPreview?: ConnectDragPreview;
  /** @hidden */
  isDragging?: boolean;
  /** @hidden */
  canDrag?: boolean;
  /** @hidden */
  item?: any;
  /** @hidden */
  type?: string | symbol | null;
}

/** @hidden */
export interface WithDragSourceState {
  ctrlKey: boolean;
  altKey: boolean;
}
let emptyImage: HTMLImageElement | undefined;

function getEmptyImage(): HTMLImageElement {
  if (!emptyImage) {
    emptyImage = new Image();
    emptyImage.src =
      "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
  }
  return emptyImage;
}

/**
 * HOC (Higher-Order Component) that transforms wrapped component into a DragSource.
 * @param Component component to wrap.
 */
export const withDragSource = <ComponentProps extends {}>(
  // tslint:disable-next-line:variable-name
  Component: React.ComponentType<ComponentProps>,
) => {
  type Props = ComponentProps & WithDragSourceProps;
  return DragSource((props: Props): string => {
    if (props.objectType) {
      if (typeof props.objectType === "function")
        return props.objectType();
      else
        return props.objectType;
    }
    return "";
  }
, {
    beginDrag(props: Props, _monitor: DragSourceMonitor, component: any) {
      let dropEffect = props.defaultDropEffect || DropEffects.Move;
      if (component.state.ctrlKey) {
        dropEffect = props.ctrlDropEffect || DropEffects.Copy;
      } else if (component.state.altKey) {
        dropEffect = props.altDropEffect || DropEffects.Link;
      }
      let dragRect: ClientRect = { left: 0, top: 0 } as ClientRect;
      const componentElement = component.rootElement;
      if (componentElement) {
        dragRect = componentElement.getBoundingClientRect();
      }
      const obj: DragSourceArguments = {
        dataObject: null,
        dropEffect,
        dropStatus: DropStatus.None,
        dragRect,
        clientOffset: { x: dragRect.left || 0, y: dragRect.top || 0 },
        initialClientOffset: { x: dragRect.left || 0, y: dragRect.top || 0 },
      };
      if (props.onDragSourceBegin) return props.onDragSourceBegin(obj);

      return obj;
    },
    endDrag(props: Props, monitor: DragSourceMonitor, component: any) {
      let dragRect: ClientRect = { left: 0, top: 0 } as ClientRect;
      const componentElement = component && component.rootElement;
      if (componentElement) {
        dragRect = componentElement.getBoundingClientRect();
      }
      const obj: DropTargetArguments = monitor.getDropResult() as DropTargetArguments || {
        dataObject: {},
        dropEffect: DropEffects.None,
        dropStatus: DropStatus.None,
        dragRect,
        clientOffset: { x: 0, y: 0 },
        initialClientOffset: { x: 0, y: 0 },
        sourceClientOffset: { x: 0, y: 0 },
        initialSourceClientOffset: { x: 0, y: 0 },
      };
      const {
        dataObject,
        dropEffect, dropStatus, dropRect,
        initialClientOffset, initialSourceClientOffset,
        local, row, col } = obj;

      const clientOffset = monitor.getClientOffset() || obj.clientOffset;
      const sourceClientOffset = monitor.getSourceClientOffset() || obj.sourceClientOffset;
      const dragObj: DragSourceArguments = {
        dataObject,
        dropEffect, dropStatus, dropRect, dragRect,
        clientOffset, initialClientOffset, sourceClientOffset, initialSourceClientOffset,
        local, row, col,
      };
      if (props.onDragSourceEnd)
        props.onDragSourceEnd(dragObj);
    },
    }, (connect: DragSourceConnector, monitor: DragSourceMonitor): Partial<WithDragSourceProps> => {
    return {
      connectDragSource: connect.dragSource(),
      connectDragPreview: connect.dragPreview(),
      isDragging: monitor.isDragging(),
      canDrag: monitor.canDrag(),
      item: monitor.getItem(),
      type: monitor.getItemType(),
    };
  })(class WithDragSource extends React.Component<Props, WithDragSourceState> {
    public rootElement: HTMLDivElement | null = null;
    public readonly state: WithDragSourceState = {
      ctrlKey: false,
      altKey: false,
    };
    public static defaultProps: any = {
      defaultDropEffect: DropEffects.Move,
      ctrlDropEffect: DropEffects.Copy,
      altDropEffect: DropEffects.Link,
    };
    public render() {
      const {
        onDragSourceBegin, onDragSourceEnd, objectType,
        connectDragSource, connectDragPreview,
        isDragging, canDrag, item, type,
        dragStyle,
        ...props } = this.props as WithDragSourceProps;
      const p = {
        item,
        type,
        isDragging,
        canDrag,
      };
      const effectMap: { [key: number]: string } = {
        [DropEffects.Move]: "move",
        [DropEffects.Copy]: "copy",
        [DropEffects.Link]: "link",
      };

      const defaultEffect = effectMap[this.props.defaultDropEffect as number];
      const ctrlEffect = effectMap[this.props.ctrlDropEffect as number];
      const altEffect = effectMap[this.props.altDropEffect as number];

      const dropEffect = this.state.ctrlKey ? ctrlEffect || "copy" : this.state.altKey ? altEffect || "link" : defaultEffect || "move";
      return connectDragSource!(
        <div ref={(el) => { this.rootElement = el; }} style={this.props.dragStyle}>
          <Component {...props} {...(p as any)} />
        </div>,
        { dropEffect },
      );
    }
    public componentDidMount() {
      if (this.props.connectDragPreview) {
        this.props.connectDragPreview!(getEmptyImage() as any, { captureDraggingState: true });
      }
      window.addEventListener("keydown", this.handleKeyChange);
      window.addEventListener("keyup", this.handleKeyChange);
    }
    public componentWillUnmount() {
      window.removeEventListener("keydown", this.handleKeyChange);
      window.removeEventListener("keyup", this.handleKeyChange);
    }
    public handleKeyChange = (event: any) => {
      const { ctrlKey, altKey } = event;
      if (this.state.ctrlKey !== ctrlKey) {
        this.setState({ ctrlKey });
      }
      if (this.state.altKey !== altKey) {
        this.setState({ altKey });
      }
    }
  });
};
