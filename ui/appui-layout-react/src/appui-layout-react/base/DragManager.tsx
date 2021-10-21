/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Base
 */
import * as React from "react";
import { PointProps } from "@itwin/appui-abstract";
import { Point, SizeProps } from "@itwin/core-react";
import { PanelSide } from "../widget-panels/Panel";
import { FloatingWidgetResizeHandle } from "../widget/FloatingWidget";
import { Event, EventEmitter } from "./Event";
import { TabState, WidgetState } from "./NineZoneState";

/** @internal */
export interface DragItemDragStartArgs {
  initialPointerPosition: Point;
}

/** @internal */
export interface DragTabDragStartArgs extends DragItemDragStartArgs {
  widgetSize: SizeProps;
}

/** @internal */
export interface UseDragTabArgs {
  tabId: TabState["id"];
  onDrag?: (dragBy: PointProps) => void;
  onDragEnd?: (target: DragTarget | undefined, widgetSize: SizeProps) => void;
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
    onDrag && onDrag(dragBy);
  }, [onDrag]);
  const handleDragEnd = React.useCallback<DragEventHandler>((_, info, target) => {
    const tabInfo = info as TabDragItemInfo;
    onDragEnd && onDragEnd(target, tabInfo.widgetSize);
  }, [onDragEnd]);
  const onDragStart = useDragItem({
    item,
    onDrag: handleDrag,
    onDragEnd: handleDragEnd,
  });
  const handleDragStart = React.useCallback(({ initialPointerPosition, widgetSize }: DragTabDragStartArgs) => {
    onDragStart({
      initialPointerPosition,
      pointerPosition: initialPointerPosition,
      lastPointerPosition: initialPointerPosition,
      widgetSize,
    });
  }, [onDragStart]);
  return handleDragStart;
}

type UpdateWidgetDragItemFn = (id: WidgetDragItem["id"]) => void;

/** @internal */
export interface UseDragWidgetArgs {
  widgetId: WidgetState["id"];
  onDragStart?: (updateWidgetId: UpdateWidgetDragItemFn, initialPointerPosition: PointProps) => void;
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
  const handleDragStart = React.useCallback<DragEventHandler>((item, info) => {
    onDragStart && onDragStart((id) => {
      item.id = id;
    }, info.initialPointerPosition);
  }, [onDragStart]);
  const handleDrag = React.useCallback<DragEventHandler>((_, info) => {
    const dragBy = info.lastPointerPosition.getOffsetTo(info.pointerPosition);
    onDrag && onDrag(dragBy);
  }, [onDrag]);
  const handleDragEnd = React.useCallback<DragEventHandler>((_, __, target) => {
    onDragEnd && onDragEnd(target);
  }, [onDragEnd]);
  const isDragItem = React.useCallback<NonNullable<UseDragItemArgs<WidgetDragItem>["isDragItem"]>>((item, dragged) => {
    return !!item && defaultIsDragItem(item, dragged);
  }, []);
  const onItemDragStart = useDragItem({
    item: widgetItem,
    isDragItem,
    onDragStart: handleDragStart,
    onDrag: handleDrag,
    onDragEnd: handleDragEnd,
  });
  const handleWidgetDragStart = React.useCallback(({ initialPointerPosition }: DragItemDragStartArgs) => {
    onItemDragStart({
      initialPointerPosition,
      pointerPosition: initialPointerPosition,
      lastPointerPosition: initialPointerPosition,
    });
  }, [onItemDragStart]);
  return handleWidgetDragStart;
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
  const onItemDragStart = useDragItem({
    item: widgetItem,
    onDrag: handleDrag,
    onDragEnd: handleDragEnd,
  });
  const handleDragStart = React.useCallback(({ initialPointerPosition }: DragItemDragStartArgs) => {
    onItemDragStart({
      initialPointerPosition,
      pointerPosition: initialPointerPosition,
      lastPointerPosition: initialPointerPosition,
    });
  }, [onItemDragStart]);
  return handleDragStart;
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
  const onItemDragStart = useDragItem({
    item: widgetItem,
    isDragItem,
    onDrag: handleDrag,
  });
  const handleDragStart = React.useCallback(({ initialPointerPosition }: DragItemDragStartArgs) => {
    onItemDragStart({
      initialPointerPosition,
      pointerPosition: initialPointerPosition,
      lastPointerPosition: initialPointerPosition,
    });
  }, [onItemDragStart]);
  return handleDragStart;
}

/** @internal */
export interface UseDragToolSettingsArgs {
  newWidgetDragItemId: WidgetDragItem["id"];
}

/** @internal */
export function useDragToolSettings(args: UseDragToolSettingsArgs) {
  const { newWidgetDragItemId } = args;
  const item = React.useMemo<WidgetDragItem>(() => {
    return {
      type: "widget",
      id: newWidgetDragItemId,
    };
  }, [newWidgetDragItemId]);
  const onDragStart = useDragItem({
    item,
  });
  const handleDragStart = React.useCallback(({ initialPointerPosition }: DragItemDragStartArgs) => {
    onDragStart({
      initialPointerPosition,
      pointerPosition: initialPointerPosition,
      lastPointerPosition: initialPointerPosition,
    });
  }, [onDragStart]);
  return handleDragStart;
}

function useTarget<T extends Element>(onTargeted: (targeted: boolean) => void) {
  const dragManager = React.useContext(DragManagerContext);
  const targeted = React.useRef(false);
  const ref = React.useRef<T>(null);
  React.useEffect(() => {
    const listener = (_item: DragItem, info: DragItemInfo, _target: DragTarget | undefined) => {
      const targetedElement = document.elementFromPoint(info.pointerPosition.x, info.pointerPosition.y);
      const newTargeted = targetedElement === ref.current;
      newTargeted !== targeted.current && onTargeted(newTargeted);
      targeted.current = newTargeted;
    };
    dragManager.onDrag.add(listener);
    return () => {
      dragManager.onDrag.remove(listener);
    };
  }, [onTargeted, dragManager]);
  React.useEffect(() => {
    const listener = () => {
      targeted.current && onTargeted(false);
      targeted.current = false;
    };
    dragManager.onDragEnd.add(listener);
    return () => {
      dragManager.onDragEnd.remove(listener);
    };
  }, [onTargeted, dragManager]);
  return ref;
}

/** @internal */
export interface UseTabTargetArgs {
  widgetId: WidgetState["id"];
  tabIndex: number;
}

/** @internal */
export function useTabTarget<T extends Element>(args: UseTabTargetArgs): [
  React.Ref<T>,
  boolean,  // targeted
] {
  const { tabIndex, widgetId } = args;
  const dragManager = React.useContext(DragManagerContext);
  const [targeted, setTargeted] = React.useState(false);
  const onTargeted = React.useCallback((isTargeted: boolean) => {
    dragManager.handleTargetChanged(isTargeted ? {
      type: "tab",
      tabIndex,
      widgetId,
    } : undefined);
    setTargeted(isTargeted);
  }, [dragManager, tabIndex, widgetId]);
  const ref = useTarget<T>(onTargeted);
  return [ref, targeted];
}

/** @internal */
export interface UsePanelTargetArgs {
  side: PanelSide;
}

/** @internal */
export function usePanelTarget<T extends Element>(args: UsePanelTargetArgs): [
  React.Ref<T>,
  boolean,  // targeted
] {
  const { side } = args;
  const dragManager = React.useContext(DragManagerContext);
  const [targeted, setTargeted] = React.useState(false);
  const onTargeted = React.useCallback((isTargeted: boolean) => {
    dragManager.handleTargetChanged(isTargeted ? {
      type: "panel",
      side,
    } : undefined);
    setTargeted(isTargeted);
  }, [dragManager, side]);
  const ref = useTarget<T>(onTargeted);
  return [ref, targeted];
}

/** @internal */
export interface UseWidgetTargetArgs {
  side: PanelSide;
  widgetIndex: number;
}

/** @internal */
export function useWidgetTarget<T extends Element>(args: UseWidgetTargetArgs): [
  React.Ref<T>,
  boolean,  // targeted
] {
  const { side, widgetIndex } = args;
  const dragManager = React.useContext(DragManagerContext);
  const [targeted, setTargeted] = React.useState(false);
  const onTargeted = React.useCallback((isTargeted: boolean) => {
    dragManager.handleTargetChanged(isTargeted ? {
      type: "widget",
      side,
      widgetIndex,
    } : undefined);
    setTargeted(isTargeted);
  }, [dragManager, side, widgetIndex]);
  const ref = useTarget<T>(onTargeted);
  return [ref, targeted];
}

/** @internal */
export interface UseDragItemArgs<T extends DragItem> {
  item: T;
  isDragItem?: (item: T | undefined, dragged: DragItem) => boolean;
  onDragStart?: DragEventHandler;
  onDrag?: DragEventHandler;
  onDragEnd?: DragEventHandler;
}

function defaultIsDragItem(item: DragItem, dragged: DragItem) {
  return dragged.type === item.type && dragged.id === item.id;
}

/** @internal */
export function useDragItem<T extends DragItem>(args: UseDragItemArgs<T>) {
  const dragManager = React.useContext(DragManagerContext);
  const { item, isDragItem, onDragStart, onDrag, onDragEnd } = args;
  const handleDragStart = React.useCallback((info: DragItemInfo) => {
    item && dragManager.handleDragStart({
      item,
      info,
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
  const [dragged, setDragged] = React.useState<boolean>(() => callback());
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
export const DragProvider = React.memo<DragProviderProps>(function DragProvider(props) { // eslint-disable-line @typescript-eslint/naming-convention, no-shadow
  const dragManager = React.useRef(new DragManager());
  React.useEffect(() => {
    const mouseMove = (e: MouseEvent) => {
      dragManager.current.handleDrag(e.clientX, e.clientY);
    };
    document.addEventListener("mousemove", mouseMove);
    return () => {
      document.removeEventListener("mousemove", mouseMove);
    };
  }, []);
  React.useEffect(() => {
    const mouseUp = () => {
      dragManager.current.handleDragEnd();
    };
    document.addEventListener("mouseup", mouseUp);
    return () => {
      document.removeEventListener("mouseup", mouseUp);
    };
  }, []);
  return (
    <DragManagerContext.Provider value={dragManager.current}>
      <DraggedWidgetIdProvider>
        <DraggedPanelSideProvider>
          <DraggedResizeHandleProvider>
            {props.children}
          </DraggedResizeHandleProvider>
        </DraggedPanelSideProvider>
      </DraggedWidgetIdProvider>
    </DragManagerContext.Provider>
  );
});

function DraggedWidgetIdProvider(props: { children?: React.ReactNode }) {
  const dragged = useDraggedItemId<WidgetDragItem>("widget");
  return (
    <DraggedWidgetIdContext.Provider value={dragged}>
      {props.children}
    </DraggedWidgetIdContext.Provider>
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

interface BaseDragItemInfo {
  initialPointerPosition: Point;
  lastPointerPosition: Point;
  pointerPosition: Point;
}

interface TabDragItemInfo extends BaseDragItemInfo {
  widgetSize: SizeProps;
}

type DragItemInfo = BaseDragItemInfo | TabDragItemInfo;

interface HandleDragStartArgs {
  item: DragItem;
  info: DragItemInfo;
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

  public handleDragStart({ item, info }: HandleDragStartArgs) {
    this._dragged = {
      item,
      info,
      target: undefined,
    };
    this._onDragStartEmitter.emit(this._dragged.item, this._dragged.info, this._dragged.target);
  }

  public handleDrag(x: number, y: number) {
    if (this._dragged) {
      this._dragged.info.lastPointerPosition = this._dragged.info.pointerPosition;
      this._dragged.info.pointerPosition = new Point(x, y);

      this._onDragEmitter.emit(this._dragged.item, this._dragged.info, this._dragged.target);
    }
  }

  public handleDragEnd() {
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
export const DragManagerContext = React.createContext<DragManager>(null!); // eslint-disable-line: completed-docs @typescript-eslint/naming-convention
DragManagerContext.displayName = "nz:DragManagerContext";

/** @internal */
export const DraggedWidgetIdContext = React.createContext<WidgetState["id"] | undefined>(undefined); // eslint-disable-line @typescript-eslint/naming-convention
DraggedWidgetIdContext.displayName = "nz:DraggedWidgetIdContext";

/** @internal */
export const DraggedPanelSideContext = React.createContext<PanelSide | undefined>(undefined); // eslint-disable-line @typescript-eslint/naming-convention
DraggedPanelSideContext.displayName = "nz:DraggedPanelSideContext";

/** @internal */
export const DraggedResizeHandleContext = React.createContext<FloatingWidgetResizeHandle | undefined>(undefined); // eslint-disable-line @typescript-eslint/naming-convention
DraggedResizeHandleContext.displayName = "nz:DraggedResizeHandleContext";
