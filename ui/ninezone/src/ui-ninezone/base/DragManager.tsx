/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Base
 */
import * as React from "react";
import { Point, PointProps } from "@bentley/ui-core";
import { TabState, WidgetState } from "./NineZoneState";
import { Event, EventEmitter } from "./Event";
import { PanelSide } from "../widget-panels/Panel";
import { FloatingWidgetResizeHandle } from "../widget/FloatingWidget";

/** @internal */
export interface UseDragTabArgs {
  tabId: TabState["id"];
  onDrag?: (dragBy: PointProps) => void;
  onDragEnd?: (target: DragTarget | undefined) => void;
}

/** @internal */
export function useDragTab(args: UseDragTabArgs) {
  const { tabId, onDrag, onDragEnd } = args;
  const item = React.useMemo<TabDragItem>(() => {
    return {
      type: "tab",
      id: tabId,
    };
  }, [tabId]);
  const handleDrag = React.useCallback<DragEventHandler>((_, info) => {
    const dragBy = info.lastPointerPosition.getOffsetTo(info.pointerPosition);
    onDrag && onDrag(dragBy.toProps());
  }, [onDrag]);
  const handleDragEnd = React.useCallback<DragEventHandler>((_, __, target) => {
    onDragEnd && onDragEnd(target);
  }, [onDragEnd]);
  return useDragItem({
    item,
    onDrag: handleDrag,
    onDragEnd: handleDragEnd,
  });
}

type UpdateWidgetDragItemFn = (id: WidgetDragItem["id"]) => void;

/** @internal */
export interface UseDragWidgetArgs {
  widgetId: WidgetState["id"];
  onDragStart?: (updateWidgetId: UpdateWidgetDragItemFn) => void;
  onDrag?: (dragBy: PointProps) => void;
  onDragEnd?: (target: DragTarget | undefined) => void;
}

/** @internal */
export function useDragWidget(args: UseDragWidgetArgs) {
  const { widgetId, onDragStart, onDrag, onDragEnd } = args;
  const widgetItem = React.useMemo<WidgetDragItem>(() => {
    return {
      type: "widget",
      id: widgetId,
    };
  }, [widgetId]);
  const handleDragStart = React.useCallback<DragEventHandler>((item) => {
    onDragStart && onDragStart((id: WidgetDragItem["id"]) => {
      item.id = id;
    });
  }, [onDragStart]);
  const handleDrag = React.useCallback<DragEventHandler>((_, info) => {
    const dragBy = info.lastPointerPosition.getOffsetTo(info.pointerPosition);
    onDrag && onDrag(dragBy.toProps());
  }, [onDrag]);
  const handleDragEnd = React.useCallback<DragEventHandler>((_, __, target) => {
    onDragEnd && onDragEnd(target);
  }, [onDragEnd]);
  return useDragItem({
    item: widgetItem,
    onDragStart: handleDragStart,
    onDrag: handleDrag,
    onDragEnd: handleDragEnd,
  });
}

/** @internal */
export interface UseDragPanelGripArgs {
  side: PanelSide;
  onDrag?: (pointerPosition: Point, lastPointerPosition: Point) => void;
  onDragEnd?: () => void;
}

/** @internal */
export function useDragPanelGrip(args: UseDragPanelGripArgs) {
  const { side, onDrag, onDragEnd } = args;
  const widgetItem = React.useMemo<PanelGripDragItem>(() => {
    return {
      type: "panelGrip",
      id: side,
    };
  }, [side]);
  const handleDrag = React.useCallback<DragEventHandler>((_, info) => {
    onDrag && onDrag(info.pointerPosition, info.lastPointerPosition);
  }, [onDrag]);
  const handleDragEnd = React.useCallback<DragEventHandler>(() => {
    onDragEnd && onDragEnd();
  }, [onDragEnd]);
  return useDragItem({
    item: widgetItem,
    onDrag: handleDrag,
    onDragEnd: handleDragEnd,
  });
}

/** @internal */
export interface UseDragResizeHandleArgs {
  widgetId: WidgetState["id"];
  handle: FloatingWidgetResizeHandle;
  onDrag?: (pointerPosition: Point) => void;
}

/** @internal */
export function useDragResizeHandle(args: UseDragResizeHandleArgs) {
  const { handle, onDrag, widgetId } = args;
  const widgetItem = React.useMemo<ResizeHandleDragItem>(() => {
    return {
      type: "resizeHandle",
      id: handle,
      widgetId,
    };
  }, [handle, widgetId]);
  const isDragItem = React.useCallback<NonNullable<UseDragItemArgs<ResizeHandleDragItem>["isDragItem"]>>((item, draggedItem) => {
    return !!item && isResizeHandleDragItem(draggedItem) && defaultIsDragItem(item, draggedItem) && item.widgetId === draggedItem.widgetId;
  }, []);
  const handleDrag = React.useCallback<DragEventHandler>((_, info) => {
    onDrag && onDrag(info.pointerPosition);
  }, [onDrag]);
  return useDragItem({
    item: widgetItem,
    isDragItem,
    onDrag: handleDrag,
  });
}

/** @internal */
export interface UseTabTargetArgs {
  widgetId: WidgetState["id"];
  tabIndex: number;
}

/** @internal */
export function useTabTarget(args: UseTabTargetArgs) {
  const { tabIndex, widgetId } = args;
  const dragManager = React.useContext(DragManagerContext);
  const onTargeted = React.useCallback((isTargeted: boolean) => {
    dragManager.handleTargetChanged(isTargeted ? {
      type: "tab",
      tabIndex,
      widgetId,
    } : undefined);
  }, [dragManager, tabIndex, widgetId]);
  return onTargeted;
}

/** @internal */
export interface UsePanelTargetArgs {
  side: PanelSide;
}

/** @internal */
export function usePanelTarget(args: UsePanelTargetArgs) {
  const { side } = args;
  const dragManager = React.useContext(DragManagerContext);
  const onTargeted = React.useCallback((isTargeted: boolean) => {
    dragManager.handleTargetChanged(isTargeted ? {
      type: "panel",
      side,
    } : undefined);
  }, [dragManager, side]);
  return onTargeted;
}

/** @internal */
export interface UseWidgetTargetArgs {
  side: PanelSide;
  widgetIndex: number;
}

/** @internal */
export function useWidgetTarget(args: UseWidgetTargetArgs) {
  const { side, widgetIndex } = args;
  const dragManager = React.useContext(DragManagerContext);
  const onTargeted = React.useCallback((isTargeted: boolean) => {
    dragManager.handleTargetChanged(isTargeted ? {
      type: "widget",
      side,
      widgetIndex,
    } : undefined);
  }, [dragManager, side, widgetIndex]);
  return onTargeted;
}

/** @internal */
export interface UseDragItemArgs<T extends DragItem> {
  item: T;
  isDragItem?: (item: T | undefined, dragged: DragItem) => boolean;
  onDragStart?: DragEventHandler;
  onDrag?: DragEventHandler;
  onDragEnd?: DragEventHandler;
}

/** @internal */
export interface DragItemDragStartArgs {
  initialPointerPosition: Point;
}

function defaultIsDragItem(item: DragItem, dragged: DragItem) {
  return dragged.type === item.type && dragged.id === item.id;
}

/** @internal */
export function useDragItem<T extends DragItem>(args: UseDragItemArgs<T>) {
  const dragManager = React.useContext(DragManagerContext);
  const { item, isDragItem, onDragStart, onDrag, onDragEnd } = args;
  const handleDragStart = React.useCallback(({ initialPointerPosition }: DragItemDragStartArgs) => {
    item && dragManager.handleDragStart({
      item,
      initialPointerPosition,
    });
  }, [dragManager, item]);
  React.useEffect(() => {
    const handleOnDragStart: DragEventHandler = (draggedItem, info, target) => {
      const handleEvent = isDragItem ? isDragItem(item, draggedItem) : defaultIsDragItem(item, draggedItem);
      if (!handleEvent)
        return;
      onDragStart && onDragStart(draggedItem, info, target);
    };
    dragManager.onDragStart.add(handleOnDragStart);
    return () => {
      dragManager.onDragStart.remove(handleOnDragStart);
    };
  }, [dragManager, onDragStart, item, isDragItem]);
  React.useEffect(() => {
    const handleOnDrag: DragEventHandler = (draggedItem, info, target) => {
      const handleEvent = isDragItem ? isDragItem(item, draggedItem) : defaultIsDragItem(item, draggedItem);
      if (!handleEvent)
        return;
      onDrag && onDrag(draggedItem, info, target);
    };
    dragManager.onDrag.add(handleOnDrag);
    return () => {
      dragManager.onDrag.remove(handleOnDrag);
    };
  }, [dragManager, onDrag, item, isDragItem]);
  React.useEffect(() => {
    const handleOnDragEnd: DragEventHandler = (draggedItem, info, target) => {
      const handleEvent = isDragItem ? isDragItem(item, draggedItem) : defaultIsDragItem(item, draggedItem);
      if (!handleEvent)
        return;
      onDragEnd && onDragEnd(draggedItem, info, target);
    };
    dragManager.onDragEnd.add(handleOnDragEnd);
    return () => {
      dragManager.onDragEnd.remove(handleOnDragEnd);
    };
  }, [dragManager, onDragEnd, item, isDragItem]);
  return handleDragStart;
}

/** @internal */
export function useIsDragged(callback: () => boolean) {
  const dragManager = React.useContext(DragManagerContext);
  const [dragged, setDragged] = React.useState<boolean>(() => {
    return callback();
  });
  React.useEffect(() => {
    const handleOnDragChanged: DragEventHandler = () => {
      setDragged(callback());
    };
    dragManager.onDragStart.add(handleOnDragChanged);
    dragManager.onDragEnd.add(handleOnDragChanged);
    return () => {
      dragManager.onDragStart.remove(handleOnDragChanged);
      dragManager.onDragEnd.remove(handleOnDragChanged);
    };
  }, [callback, dragManager]);
  return dragged;
}

/** @internal */
export function useIsDraggedItem(item: DragItem) {
  const dragManager = React.useContext(DragManagerContext);
  const handleCallback = React.useCallback(() => {
    return dragManager.isDragged(item);
  }, [dragManager, item]);
  return useIsDragged(handleCallback);
}

/** @internal */
export function useIsDraggedType(type: DragItem["type"]) {
  const dragManager = React.useContext(DragManagerContext);
  const handleCallback = React.useCallback(() => {
    return dragManager.isDraggedType(type);
  }, [dragManager, type]);
  return useIsDragged(handleCallback);
}

/** @internal */
export function useDraggedItemId<T extends DragItem>(type: T["type"]): T["id"] | undefined {
  const dragManager = React.useContext(DragManagerContext);
  const [dragged, setDragged] = React.useState<T["id"] | undefined>(() => {
    return dragManager.getDraggedIdOfType(type);
  });
  React.useEffect(() => {
    const handleOnDragChanged: DragEventHandler = () => {
      setDragged(dragManager.getDraggedIdOfType(type));
    };
    dragManager.onDragStart.add(handleOnDragChanged);
    dragManager.onDragEnd.add(handleOnDragChanged);
    return () => {
      dragManager.onDragStart.remove(handleOnDragChanged);
      dragManager.onDragEnd.remove(handleOnDragChanged);
    };
  }, [dragManager, type]);
  return dragged;
}

/** @internal */
export interface DragProviderProps {
  children?: React.ReactNode;
}

/** @internal */
export const DragProvider = React.memo<DragProviderProps>(function DragProvider(props) { // tslint:disable-line: variable-name no-shadowed-variable
  const dragManager = React.useRef<DragManager>(new DragManager());
  React.useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      dragManager.current.handlePointerMove(e);
    };
    document.addEventListener("pointermove", handlePointerMove);
    return () => {
      document.removeEventListener("pointermove", handlePointerMove);
    };
  }, []);
  React.useEffect(() => {
    const handlePointerUp = (e: PointerEvent) => {
      dragManager.current.handlePointerUp(e);
    };
    document.addEventListener("pointerup", handlePointerUp);
    return () => {
      document.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);
  return (
    <DragManagerContext.Provider value={dragManager.current}>
      <DraggedWidgetProvider>
        <DraggedPanelSideProvider>
          <DraggedResizeHandleProvider>
            {props.children}
          </DraggedResizeHandleProvider>
        </DraggedPanelSideProvider>
      </DraggedWidgetProvider>
    </DragManagerContext.Provider>
  );
});

function DraggedWidgetProvider(props: { children?: React.ReactNode }) {
  const draggedWidget = useIsDraggedType("widget");
  return (
    <DraggedWidgetContext.Provider value={draggedWidget}>
      {props.children}
    </DraggedWidgetContext.Provider>
  );
}

function DraggedPanelSideProvider(props: { children?: React.ReactNode }) {
  const draggedWidget = useDraggedItemId<PanelGripDragItem>("panelGrip");
  return (
    <DraggedPanelSideContext.Provider value={draggedWidget}>
      {props.children}
    </DraggedPanelSideContext.Provider>
  );
}

function DraggedResizeHandleProvider(props: { children?: React.ReactNode }) {
  const value = useDraggedItemId<ResizeHandleDragItem>("resizeHandle");
  return (
    <DraggedResizeHandleContext.Provider value={value}>
      {props.children}
    </DraggedResizeHandleContext.Provider>
  );
}

interface TabDragItem {
  type: "tab";
  id: TabState["id"];
}

interface WidgetDragItem {
  type: "widget";
  id: WidgetState["id"];
}

interface PanelGripDragItem {
  type: "panelGrip";
  id: PanelSide;
}

interface ResizeHandleDragItem {
  type: "resizeHandle";
  id: FloatingWidgetResizeHandle;
  widgetId: WidgetState["id"];
}

type DragItem = TabDragItem | WidgetDragItem | PanelGripDragItem | ResizeHandleDragItem;

function isResizeHandleDragItem(item: DragItem): item is ResizeHandleDragItem {
  return item.type === "resizeHandle";
}

interface TabTarget {
  type: "tab";
  widgetId: WidgetState["id"];
  tabIndex: number;
}

interface PanelTarget {
  type: "panel";
  side: PanelSide;
}

interface WidgetTarget {
  type: "widget";
  side: PanelSide;
  widgetIndex: number;
}

/** @internal */
export type DragTarget = TabTarget | PanelTarget | WidgetTarget;

/** @internal */
export function isTabTarget(target: DragTarget): target is TabTarget {
  return target.type === "tab";
}

interface DragItemInfo {
  initialPointerPosition: Point;
  lastPointerPosition: Point;
  pointerPosition: Point;
}

interface HandleDragStartArgs {
  item: DragItem;
  initialPointerPosition: Point;
}

interface Dragged {
  item: DragItem;
  info: DragItemInfo;
  target: DragTarget | undefined;
}

type DragEventHandler = (item: DragItem, info: DragItemInfo, target: DragTarget | undefined) => void;

/** @internal */
export class DragManager {
  private _dragged: Dragged | undefined;
  private _onDragStartEmitter = new EventEmitter<DragEventHandler>();
  private _onDragEmitter = new EventEmitter<DragEventHandler>();
  private _onDragEndEmitter = new EventEmitter<DragEventHandler>();

  public isDragged(item: DragItem) {
    return !!this._dragged && this._dragged.item.id === item.id && this._dragged.item.type === item.type;
  }

  public isDraggedType(type: DragItem["type"]) {
    return !!this._dragged && this._dragged.item.type === type;
  }

  public getDraggedIdOfType<T extends DragItem>(type: T["type"]): T["id"] | undefined {
    if (this._dragged && this._dragged.item.type === type) {
      return this._dragged.item.id;
    }
    return undefined;
  }

  public get onDragStart(): Event<DragEventHandler> {
    return this._onDragStartEmitter;
  }

  public get onDrag(): Event<DragEventHandler> {
    return this._onDragEmitter;
  }

  public get onDragEnd(): Event<DragEventHandler> {
    return this._onDragEndEmitter;
  }

  public handleDragStart({ item, initialPointerPosition }: HandleDragStartArgs) {
    this._dragged = {
      item,
      info: {
        initialPointerPosition,
        pointerPosition: initialPointerPosition,
        lastPointerPosition: initialPointerPosition,
      },
      target: undefined,
    };
    this._onDragStartEmitter.emit(this._dragged.item, this._dragged.info, this._dragged.target);
  }

  public handlePointerMove(e: PointerEvent) {
    if (this._dragged) {
      this._dragged.info.lastPointerPosition = this._dragged.info.pointerPosition;
      this._dragged.info.pointerPosition = new Point(e.clientX, e.clientY);

      this._onDragEmitter.emit(this._dragged.item, this._dragged.info, this._dragged.target);
    }
  }

  public handlePointerUp(_e: PointerEvent) {
    if (this._dragged) {
      const item = this._dragged.item;
      const info = this._dragged.info;
      const target = this._dragged.target;
      this._dragged = undefined;
      this._onDragEndEmitter.emit(item, info, target);
    }
  }

  public handleTargetChanged(target: DragTarget | undefined) {
    if (!this._dragged)
      return;
    this._dragged.target = target;
  }
}

/** @internal */
export const DragManagerContext = React.createContext<DragManager>(null!); // tslint:disable-line: completed-docs variable-name
DragManagerContext.displayName = "nz:DragManagerContext";

/** @internal */
export const DraggedWidgetContext = React.createContext<boolean>(false); // tslint:disable-line: variable-name
DraggedWidgetContext.displayName = "nz:DraggedWidgetContext";

/** @internal */
export const DraggedPanelSideContext = React.createContext<PanelSide | undefined>(undefined); // tslint:disable-line: variable-name
DraggedPanelSideContext.displayName = "nz:DraggedPanelSideContext";

/** @internal */
export const DraggedResizeHandleContext = React.createContext<FloatingWidgetResizeHandle | undefined>(undefined); // tslint:disable-line: variable-name
DraggedResizeHandleContext.displayName = "nz:DraggedResizeHandleContext";
