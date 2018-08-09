/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module DragDrop */

import * as React from "react";
import { DragLayer } from "react-dnd";

import { UiEvent } from "@bentley/ui-core";
import { DragSourceArguments } from "@bentley/ui-components";

/** Drag/Drop Layer Changed Event Args class.
 */
export interface DragDropLayerChangedEventArgs {
  type: string | undefined;
}

/** Drag/Drop Layer Changed Event class.
 */
export class DragDropLayerChangedEvent extends UiEvent<DragDropLayerChangedEventArgs> {}

/** Drag/Drop Layer Manager class.
 */
export class DragDropLayerManager {
  private static _currentType: string | undefined;
  private static _layers: {[type: string]: React.ComponentType<DragLayerProps>} = {};
  private static _dragDropLayerChangedEvent: DragDropLayerChangedEvent = new DragDropLayerChangedEvent();

  public static get DragDropLayerChangedEvent(): DragDropLayerChangedEvent { return this._dragDropLayerChangedEvent; }

  public static getType(): string | undefined {
    return this._currentType;
  }

  public static getActiveLayer() {
    if (this._currentType)
      return this._layers[this._currentType];
    return undefined;
  }

  public static setType(type: string | undefined) {
    this._currentType = type;
    this._dragDropLayerChangedEvent.emit({type});
  }
  public static registerTypeLayer(type: string, layer: React.ComponentType<DragLayerProps>) {
    this._layers[type] = layer;
  }
}

/** Properties for DragLayer components
 */
export interface DragLayerProps {
  args?: DragSourceArguments;
}

/** Properties for the DragDropLayerRenderer component
 */
export interface DragDropLayerRendererProps {
  dragging?: boolean;
  item?: any;
  itemType?: string;
  args?: DragSourceArguments;
  /** @hidden */
  clientOffset?: {x: number, y: number};
  /** @hidden */
  initialClientOffset?: {x: number, y: number};
  /** @hidden */
  sourceClientOffset?: {x: number, y: number};
  /** @hidden */
  initialSourceClientOffset?: {x: number, y: number};
}

/** DragDropLayerRenderer component.
 */
class DragDropLayerRendererComponent extends React.Component<DragDropLayerRendererProps> {
  private _dragging: boolean = false;
  public componentDidMount() {
    window.addEventListener("dragstart", this.handleDragStart);
    window.addEventListener("dragend", this.handleDragEnd);
  }

  public componentWillUnmount() {
    window.removeEventListener("dragstart", this.handleDragStart);
    window.removeEventListener("dragend", this.handleDragEnd);
  }

  private handleDragStart = () => {
    this._dragging = true;
  }

  private handleDragEnd = () => {
    this._dragging = false;
  }

  public render(): React.ReactNode {
    if (this.props.itemType !== DragDropLayerManager.getType() ) {
      DragDropLayerManager.setType(this.props.itemType);
    }
    const {item,
      clientOffset, initialClientOffset,
      sourceClientOffset, initialSourceClientOffset,
    } = this.props;
    // tslint:disable-next-line:variable-name
    const LayerElement = DragDropLayerManager.getActiveLayer();
    if (!this._dragging || !LayerElement)
      return null;

    const dragSourceArgs = item! as DragSourceArguments;

    if (clientOffset) dragSourceArgs.clientOffset = clientOffset;
    if (initialClientOffset) dragSourceArgs.initialClientOffset = initialClientOffset;
    dragSourceArgs.sourceClientOffset = sourceClientOffset;
    dragSourceArgs.initialSourceClientOffset = initialSourceClientOffset;

    return (
      <div className="dragdrop-layer">
        <LayerElement args={dragSourceArgs} />
      </div>
    );
  }
}

// tslint:disable-next-line:variable-name
export const DragDropLayerRenderer = DragLayer((monitor) => ({
  item: monitor.getItem(),
  itemType: monitor.getItemType(),
  clientOffset: monitor.getClientOffset(),
  initialClientOffset: monitor.getInitialClientOffset(),
  sourceClientOffset: monitor.getSourceClientOffset(),
  initialSourceClientOffset: monitor.getInitialSourceClientOffset(),
  dragging: monitor.isDragging(),
}))(DragDropLayerRendererComponent);
