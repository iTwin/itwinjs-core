/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module DragDrop */

import * as React from "react";
import { DragLayer } from "react-dnd";

import { UiEvent } from "@bentley/ui-core";
import { DragSourceArguments, DragLayerProps } from "@bentley/ui-components";

/** Drag/Drop Layer Changed Event Args class.
 */
export interface DragDropLayerChangedEventArgs {
  /** The new drag type. */
  type: string | undefined;
}

/** Drag/Drop Layer Changed Event class.
 */
export class DragDropLayerChangedEvent extends UiEvent<DragDropLayerChangedEventArgs> { }

/** Drag/Drop Layer Manager class.
 */
export class DragDropLayerManager {
  private static _currentType: string | undefined;
  private static _layers: { [type: string]: React.ComponentType<DragLayerProps> } = {};
  private static _dragDropLayerChangedEvent: DragDropLayerChangedEvent = new DragDropLayerChangedEvent();

  public static get onDragDropLayerChangedEvent(): DragDropLayerChangedEvent { return this._dragDropLayerChangedEvent; }

  /**
   * Gets the currently active drag type.
   */
  public static getType(): string | undefined {
    return this._currentType;
  }

  /**
   * Gets the DragLayer component of the currently active type.
   */
  public static getActiveLayer() {
    if (this._currentType)
      return this._layers[this._currentType];
    return undefined;
  }

  /**
   * Sets the current type.
   * @note The current drag type is set automatically when a drag starts. Manually setting type before a drag will be overridden by DragDropManager.
   */
  public static setType(type: string | undefined) {
    this._currentType = type;
    this._dragDropLayerChangedEvent.emit({ type });
  }
  /** Registers a new DragLayer for the given type. */
  public static registerTypeLayer(type: string, layer: React.ComponentType<DragLayerProps>) {
    this._layers[type] = layer;
  }
}

/** Properties for the DragDropLayerRenderer component
 */
export interface DragDropLayerRendererProps {
  dragging?: boolean;
  item?: any;
  itemType?: string;
  args?: DragSourceArguments;
  /** @hidden */
  clientOffset?: { x: number, y: number };
  /** @hidden */
  initialClientOffset?: { x: number, y: number };
  /** @hidden */
  sourceClientOffset?: { x: number, y: number };
  /** @hidden */
  initialSourceClientOffset?: { x: number, y: number };
}

/** DragDropLayerRenderer component.
 */
class DragDropLayerRendererComponent extends React.Component<DragDropLayerRendererProps> {
  private _dragging: boolean = false;
  public componentDidMount() {
    window.addEventListener("dragstart", this._handleDragStart);
    window.addEventListener("dragend", this._handleDragEnd);
  }

  public componentWillUnmount() {
    window.removeEventListener("dragstart", this._handleDragStart);
    window.removeEventListener("dragend", this._handleDragEnd);
  }

  private _handleDragStart = () => {
    this._dragging = true;
  }

  private _handleDragEnd = () => {
    this._dragging = false;
  }

  public render(): React.ReactNode {
    if (this.props.itemType !== DragDropLayerManager.getType()) { // A drag of a new type has been triggered.
      DragDropLayerManager.setType(this.props.itemType);
    }
    const { item,
      clientOffset, initialClientOffset,
      sourceClientOffset, initialSourceClientOffset,
    } = this.props;

    const dragSourceArgs = item! as DragSourceArguments;

    // tslint:disable-next-line:variable-name
    const LayerElement = DragDropLayerManager.getActiveLayer() || (dragSourceArgs && dragSourceArgs.defaultDragLayer);
    if (!this._dragging || !LayerElement)
      return null;

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

/**
 * Contains the DragLayers to all DragSource types.
 * New DragLayers are registered by type using [[DragDropLayerManager.registerTypeLayer]]
 * This component must be placed on a root DOM node at the bottom to render DragLayers properly.
 */
export const DragDropLayerRenderer = DragLayer((monitor) => ({ // tslint:disable-line:variable-name
  item: monitor.getItem(),
  itemType: monitor.getItemType(),
  clientOffset: monitor.getClientOffset(),
  initialClientOffset: monitor.getInitialClientOffset(),
  sourceClientOffset: monitor.getSourceClientOffset(),
  initialSourceClientOffset: monitor.getInitialSourceClientOffset(),
  dragging: monitor.isDragging(),
}))(DragDropLayerRendererComponent);
