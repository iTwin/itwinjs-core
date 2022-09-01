/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Base
 */
import * as React from "react";
import * as _ from "lodash";
import { PointProps } from "@itwin/appui-abstract";
import { Point, SizeProps } from "@itwin/core-react";
import { PanelSide } from "../widget-panels/Panel";
import { FloatingWidgetResizeHandle } from "../widget/FloatingWidget";
import { Event, EventEmitter } from "./Event";
import { WidgetState } from "../state/WidgetState";
import { TabState } from "../state/TabState";
import { getUniqueId } from "./NineZone";
import { DropTargetState, isTabDragDropTargetState, isWidgetDragDropTargetState, PanelDropTargetState, TabDragDropTargetState, TabDropTargetState, WidgetDragDropTargetState } from "../state/DropTargetState";

/** @internal */
export interface DragStartArgs {
  initialPointerPosition: Point;
  pointerPosition: Point;
}

/** @internal */
export interface TabDragStartArgs extends DragStartArgs {
  widgetSize: SizeProps;
}

/** @internal */
export interface UseDragTabArgs {
  tabId: TabState["id"];
  onDrag?: (dragBy: PointProps) => void;
  onDragEnd?: (target: TabDragDropTargetState) => void;
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
  const handleDrag = React.useCallback<DragEventHandler>((_item, info) => {
    const dragBy = info.lastPointerPosition.getOffsetTo(info.pointerPosition);
    onDrag && onDrag(dragBy);
  }, [onDrag]);
  const handleDragEnd = React.useCallback<DragEventHandler>((_item, info, target) => {
    // istanbul ignore next
    if (!onDragEnd)
      return;

    let tabTarget: TabDragDropTargetState;
    if (target && isTabDragDropTargetState(target)) {
      tabTarget = target;
    } else {
      const tabInfo = info as TabDragInfo;
      const newFloatingWidgetId = getUniqueId();
      const size = tabInfo.widgetSize;
      tabTarget = {
        type: "floatingWidget",
        newFloatingWidgetId,
        size,
      };
    }
    onDragEnd(tabTarget);
  }, [onDragEnd]);
  const onDragStart = useDragItem({
    item,
    onDrag: handleDrag,
    onDragEnd: handleDragEnd,
  });
  const handleDragStart = React.useCallback(({ initialPointerPosition, pointerPosition, widgetSize }: TabDragStartArgs) => {
    onDragStart({
      initialPointerPosition,
      pointerPosition,
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
  onDragStart?: (updateWidget: UpdateWidgetDragItemFn, initialPointerPosition: Point, pointerPosition: Point) => void;
  onDrag?: (dragBy: Point) => void;
  onDragEnd?: (target: WidgetDragDropTargetState) => void;
}

/** @internal */
export function useDragWidget(args: UseDragWidgetArgs) {
  const { widgetId, onDragStart, onDrag, onDragEnd } = args;
  const dragManager = React.useContext(DragManagerContext);
  const widgetItem = React.useMemo<WidgetDragItem>(() => {
    return {
      type: "widget",
      id: widgetId,
    };
  }, [widgetId]);
  const handleDragStart = React.useCallback<DragEventHandler>((item, info) => {
    onDragStart && onDragStart((id) => {
      item.id = id;
      dragManager.handleDragUpdate();
    }, info.initialPointerPosition, info.pointerPosition);
  }, [dragManager, onDragStart]);
  const handleDrag = React.useCallback<DragEventHandler>((_item, info) => {
    const dragBy = info.lastPointerPosition.getOffsetTo(info.pointerPosition);
    onDrag && onDrag(dragBy);
  }, [onDrag]);
  const handleDragEnd = React.useCallback<DragEventHandler>((_item, _info, target) => {
    if (!onDragEnd)
      return;

    let widgetTarget: WidgetDragDropTargetState;
    if (target && isWidgetDragDropTargetState(target)) {
      widgetTarget = target;
    } else {
      widgetTarget = {
        type: "window",
      };
    }
    onDragEnd(widgetTarget);
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
  const handleWidgetDragStart = React.useCallback(({ initialPointerPosition, pointerPosition }: DragStartArgs) => {
    onItemDragStart({
      initialPointerPosition,
      pointerPosition,
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
  const gripItem = React.useMemo<PanelGripDragItem>(() => {
    return {
      type: "panelGrip",
      id: side,
    };
  }, [side]);
  const handleDrag = React.useCallback<DragEventHandler>((_item, info) => {
    onDrag && onDrag(info.pointerPosition, info.lastPointerPosition);
  }, [onDrag]);
  const handleDragEnd = React.useCallback<DragEventHandler>(() => {
    onDragEnd && onDragEnd();
  }, [onDragEnd]);
  const onItemDragStart = useDragItem({
    item: gripItem,
    onDrag: handleDrag,
    onDragEnd: handleDragEnd,
  });
  const handleDragStart = React.useCallback(({ initialPointerPosition }: DragStartArgs) => {
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
  const resizeHandleItem = React.useMemo<ResizeHandleDragItem>(() => {
    return {
      type: "resizeHandle",
      id: handle,
      widgetId,
    };
  }, [handle, widgetId]);
  const isDragItem = React.useCallback<NonNullable<UseDragItemArgs<ResizeHandleDragItem>["isDragItem"]>>((item, draggedItem) => {
    return !!item && isResizeHandleDragItem(draggedItem) && defaultIsDragItem(item, draggedItem) && item.widgetId === draggedItem.widgetId;
  }, []);
  const handleDrag = React.useCallback<DragEventHandler>((_item, info) => {
    onDrag && onDrag(info.pointerPosition);
  }, [onDrag]);
  const onItemDragStart = useDragItem<ResizeHandleDragItem>({
    item: resizeHandleItem,
    isDragItem,
    onDrag: handleDrag,
  });
  const handleDragStart = React.useCallback(({ initialPointerPosition }: DragStartArgs) => {
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
  newFloatingWidgetId: WidgetDragItem["id"];
}

/** @internal */
export function useDragToolSettings(args: UseDragToolSettingsArgs) {
  const { newFloatingWidgetId } = args;
  const item = React.useMemo<WidgetDragItem>(() => {
    return {
      type: "widget",
      id: newFloatingWidgetId,
    };
  }, [newFloatingWidgetId]);
  const onDragStart = useDragItem({
    item,
  });
  const handleDragStart = React.useCallback(({ initialPointerPosition }: DragStartArgs) => {
    onDragStart({
      initialPointerPosition,
      pointerPosition: initialPointerPosition,
      lastPointerPosition: initialPointerPosition,
    });
  }, [onDragStart]);
  return handleDragStart;
}

/** @internal */
export function useTarget<T extends Element>(target: DropTargetState): [
  React.Ref<T>,
  boolean,  // targeted
] {
  const dragManager = React.useContext(DragManagerContext);
  const [targeted, setTargeted] = React.useState(false);
  const targetedRef = React.useRef(false);
  const onTargeted = React.useCallback((doTarget: boolean) => {
    const isTargeted = dragManager.isTargeted(target);
    if (doTarget && !isTargeted) {
      dragManager.handleTargetChanged(target);
    } else if (!doTarget && isTargeted) {
      dragManager.handleTargetChanged(undefined);
    }
    setTargeted(doTarget);
  }, [dragManager, target]);
  const ref = React.useRef<T>(null);
  React.useEffect(() => {
    return dragManager.onDrag.add((_item, info) => {
      const targetedElement = document.elementFromPoint(info.pointerPosition.x, info.pointerPosition.y);
      const newTargeted = targetedElement === ref.current;
      newTargeted !== targetedRef.current && onTargeted(newTargeted);
      targetedRef.current = newTargeted;
    });
  }, [onTargeted, dragManager]);
  React.useEffect(() => {
    return dragManager.onDragEnd.add(() => {
      targetedRef.current && onTargeted(false);
      targetedRef.current = false;
    });
  }, [onTargeted, dragManager]);
  return [ref, targeted];
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
  const target = React.useMemo<TabDropTargetState>(() => ({
    type: "tab",
    tabIndex,
    widgetId,
  }), [tabIndex, widgetId]);
  return useTarget(target);
}

/** @internal */
export interface UsePanelTargetArgs {
  side: PanelSide;
  newWidgetId: WidgetState["id"];
}

/** @internal */
export function usePanelTarget<T extends Element>(args: UsePanelTargetArgs): [
  React.Ref<T>,
  boolean,  // targeted
] {
  const { side, newWidgetId } = args;
  const target = React.useMemo<PanelDropTargetState>(() => ({
    type: "panel",
    side,
    newWidgetId,
  }), [side, newWidgetId]);
  return useTarget(target);
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
  const handleDragStart = React.useCallback((info: DragInfo) => {
    item && dragManager.handleDragStart({
      item,
      info,
    });
  }, [dragManager, item]);
  React.useEffect(() => {
    return dragManager.onDragStart.add((draggedItem, info, target) => {
      const handleEvent = isDragItem ? isDragItem(item, draggedItem) : defaultIsDragItem(item, draggedItem);
      if (!handleEvent)
        return;
      onDragStart && onDragStart(draggedItem, info, target);
    });
  }, [dragManager, onDragStart, item, isDragItem]);
  React.useEffect(() => {
    return dragManager.onDrag.add((draggedItem, info, target) => {
      const handleEvent = isDragItem ? isDragItem(item, draggedItem) : defaultIsDragItem(item, draggedItem);
      if (!handleEvent)
        return;
      onDrag && onDrag(draggedItem, info, target);
    });
  }, [dragManager, onDrag, item, isDragItem]);
  React.useEffect(() => {
    return dragManager.onDragEnd.add((draggedItem, info, target) => {
      const handleEvent = isDragItem ? isDragItem(item, draggedItem) : defaultIsDragItem(item, draggedItem);
      if (!handleEvent)
        return;
      onDragEnd && onDragEnd(draggedItem, info, target);
    });
  }, [dragManager, onDragEnd, item, isDragItem]);
  return handleDragStart;
}

/** @internal */
export function useIsDragged(callback: () => boolean) {
  const dragManager = React.useContext(DragManagerContext);
  const [dragged, setDragged] = React.useState<boolean>(() => callback());
  React.useEffect(() => {
    return dragManager.onDragStart.add(() => {
      setDragged(callback());
    });
  }, [callback, dragManager]);
  React.useEffect(() => {
    return dragManager.onDragEnd.add(() => {
      setDragged(callback());
    });
  }, [callback, dragManager]);
  React.useEffect(() => {
    return dragManager.onDragUpdate.add(() => {
      setDragged(callback());
    });
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
    return dragManager.onDragStart.add(() => {
      setDragged(dragManager.getDraggedIdOfType(type));
    });
  }, [dragManager, type]);
  React.useEffect(() => {
    return dragManager.onDragEnd.add(() => {
      setDragged(dragManager.getDraggedIdOfType(type));
    });
  }, [dragManager, type]);
  React.useEffect(() => {
    return dragManager.onDragUpdate.add(() => {
      setDragged(dragManager.getDraggedIdOfType(type));
    });
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

interface BaseDragInfo {
  initialPointerPosition: Point;
  lastPointerPosition: Point;
  pointerPosition: Point;
}

interface TabDragInfo extends BaseDragInfo {
  widgetSize: SizeProps;
}

type DragInfo = BaseDragInfo | TabDragInfo;

interface HandleDragStartArgs {
  item: DragItem;
  info: DragInfo;
}

interface Dragged {
  item: DragItem;
  info: DragInfo;
  target: DropTargetState | undefined;
}

type DragEventHandler = (item: DragItem, info: DragInfo, target: DropTargetState | undefined) => void;
type DropTargetChangedEventHandler = (target: DropTargetState | undefined) => void;

/** @internal */
export class DragManager {
  private _dragged: Dragged | undefined;
  private _onDragStartEmitter = new EventEmitter<DragEventHandler>();
  private _onDragUpdateEmitter = new EventEmitter<DragEventHandler>();
  private _onDragEmitter = new EventEmitter<DragEventHandler>();
  private _onDragEndEmitter = new EventEmitter<DragEventHandler>();
  private _onTargetChangedEmitter = new EventEmitter<DropTargetChangedEventHandler>();

  public get draggedItem() {
    return this._dragged;
  }

  public isDragged(item: DragItem) {
    return !!this._dragged && this._dragged.item.id === item.id && this._dragged.item.type === item.type;
  }

  public isTargeted(target: DropTargetState) {
    if (!this._dragged)
      return false;

    if (!this._dragged.target)
      return false;

    return _.isEqual(this._dragged.target, target);
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

  public get onDragUpdate(): Event<DragEventHandler> {
    return this._onDragUpdateEmitter;
  }

  public get onDrag(): Event<DragEventHandler> {
    return this._onDragEmitter;
  }

  public get onDragEnd(): Event<DragEventHandler> {
    return this._onDragEndEmitter;
  }

  public get onTargetChanged(): Event<DropTargetChangedEventHandler> {
    return this._onTargetChangedEmitter;
  }

  public handleDragStart({ item, info }: HandleDragStartArgs) {
    this._dragged = {
      item,
      info,
      target: undefined,
    };
    this._onDragStartEmitter.emit(this._dragged.item, this._dragged.info, this._dragged.target);
  }

  public handleDragUpdate() {
    // istanbul ignore next
    if (!this._dragged)
      return;

    this._onDragUpdateEmitter.emit(this._dragged.item, this._dragged.info, this._dragged.target);
  }

  public handleDrag(x: number, y: number) {
    if (!this._dragged)
      return;

    this._dragged.info.lastPointerPosition = this._dragged.info.pointerPosition;
    this._dragged.info.pointerPosition = new Point(x, y);

    this._onDragEmitter.emit(this._dragged.item, this._dragged.info, this._dragged.target);
  }

  public handleDragEnd() {
    if (!this._dragged)
      return;

    const item = this._dragged.item;
    const info = this._dragged.info;
    const target = this._dragged.target;
    this._dragged = undefined;
    this._onDragEndEmitter.emit(item, info, target);
    target && this._onTargetChangedEmitter.emit(undefined);
  }

  public handleTargetChanged(target: DropTargetState | undefined) {
    if (!this._dragged)
      return;
    this._dragged.target = target;
    this._onTargetChangedEmitter.emit(target);
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

/** @internal */
export function useTargeted() {
  const dragManager = React.useContext(DragManagerContext);
  const [targeted, setTargeted] = React.useState<DropTargetState>();
  React.useEffect(() => {
    return dragManager.onTargetChanged.add((t) => {
      setTargeted(t);
    });
  }, [dragManager]);
  return targeted;
}
