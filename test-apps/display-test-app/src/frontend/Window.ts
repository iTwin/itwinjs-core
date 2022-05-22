/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelApp } from "@itwin/core-frontend";
import { Surface } from "./Surface";

class DragState {
  private _newX = 0;
  private _newY = 0;
  private _prevX = 0;
  private _prevY = 0;

  public constructor(window: Window, click: HTMLElement) {
    const drag = (e: MouseEvent) => {
      window.invalidateDock();
      const target = window.container;
      const surf = window.surface.element;
      e.preventDefault();
      this._newX = this._prevX - e.clientX;
      this._newY = this._prevY - e.clientY;
      this._prevX = e.clientX;
      this._prevY = e.clientY;

      let top = Math.max(0, target.offsetTop - this._newY);
      let left = Math.max(0, target.offsetLeft - this._newX);
      top = Math.min(surf.clientHeight - target.clientHeight, top);
      left = Math.min(surf.clientWidth - target.clientWidth, left);
      target.style.top = `${top}px`;
      target.style.left = `${left}px`;
    };

    const stopDrag = () => {
      document.removeEventListener("mousemove", drag);
      document.removeEventListener("mouseup", stopDrag);
    };

    const startDrag = (e: MouseEvent) => {
      e.preventDefault();
      this._prevX = e.clientX;
      this._prevY = e.clientY;
      document.addEventListener("mousemove", drag);
      document.addEventListener("mouseup", stopDrag);

      window.focus();
    };

    click.addEventListener("mousedown", startDrag);
  }
}

class ResizeState {
  public readonly minSize: number;
  private _prevWidth = 0;
  private _prevHeight = 0;
  private _prevY = 0;
  private _prevMouseX = 0;
  private _prevMouseY = 0;

  public constructor(window: Window, click: HTMLElement, minSize = 50) {
    const target = window.container;
    this.minSize = minSize;
    const resize = (e: MouseEvent) => {
      window.invalidateDock();
      const width = this._prevWidth + (e.pageX - this._prevMouseX);
      const height = this._prevHeight - (e.pageY - this._prevMouseY);
      const windowTop = this._prevY + (e.pageY - this._prevMouseY);
      const windowLeft = parseInt(window.container.style.left, 10);
      const windowRight = windowLeft + width;
      const prevBottom = this._prevY + this._prevHeight;
      const surfaceWidth = window.surface.element.clientWidth;
      const surfaceRight = window.surface.element.clientLeft + surfaceWidth;
      const surfaceTop = window.surface.element.clientTop;

      if (width > this.minSize)
        target.style.width = `${(windowRight <= surfaceRight) ? width : surfaceWidth - windowLeft}px`;

      if (height > minSize) {
        target.style.height = `${(windowTop >= surfaceTop) ? height : prevBottom}px`;
        target.style.top = `${(windowTop >= surfaceTop) ? windowTop : surfaceTop}px`;
      }
    };

    const stopResize = () => {
      document.removeEventListener("mousemove", resize);
      document.removeEventListener("mouseup", stopResize);
    };

    click.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();

      const style = getComputedStyle(target, null);
      const pxToNum = (propName: string) => parseFloat(style.getPropertyValue(propName).replace("px", ""));
      this._prevWidth = pxToNum("width");
      this._prevHeight = pxToNum("height");
      this._prevY = pxToNum("top");
      this._prevMouseX = e.pageX;
      this._prevMouseY = e.pageY;

      document.addEventListener("mousemove", resize);
      document.addEventListener("mouseup", stopResize);

      window.focus();
    });
  }
}

export enum Dock {
  Full = 0,
  Top = 1 << 0,
  Left = 1 << 1,
  Right = 1 << 2,
  Bottom = 1 << 3,
  TopLeft = Top | Left,
  TopRight = Top | Right,
  BottomLeft = Bottom | Left,
  BottomRight = Bottom | Right,
}

interface DockState {
  dock: Dock;
  width: number;
  height: number;
  top: string;
  left: string;
}

class WindowHeader {
  public readonly window: Window;
  public readonly element: HTMLElement;
  private readonly _titleElement: HTMLElement;
  private readonly _closeElement: HTMLElement;
  private readonly _resizerElement: HTMLElement;
  private _dockState?: DockState;
  private readonly _resizeState: ResizeState;

  public constructor(window: Window, parent: HTMLElement, title?: string) {
    this.window = window;
    this.element = IModelApp.makeHTMLElement("div", { className: "floating-window-header", parent });

    this._titleElement = IModelApp.makeHTMLElement("span", { parent: this.element });
    this.setTitle(title);

    this._closeElement = IModelApp.makeHTMLElement("div", { className: "floating-window-header-close", parent: this.element });
    this._closeElement.onclick = () => this.window.surface.close(this.window);
    this.hideCloseWidget(!this.window.isCloseable);

    this._resizerElement = IModelApp.makeHTMLElement("div", { className: "floating-window-header-resize", parent: this.element });
    this.hideResizerWidget(!this.window.isResizable);

    // Left-drag => move
    new DragState(window, this.element);

    // Left-drag corner => resize
    this._resizeState = new ResizeState(window, this._resizerElement);

    // Double-click => maximize or restore
    const maximizeOrRestore = () => {
      if (this.isDocked)
        this.undock();
      else
        this.dock(Dock.Full);
    };

    this.element.addEventListener("dblclick", maximizeOrRestore);
  }

  public setTitle(title?: string): void {
    this._titleElement.innerText = undefined !== title ? title : "";
  }

  public get title(): string {
    const title = this._titleElement.innerText;
    return title ? title : "";
  }

  public dock(dock: Dock): void {
    // NB: Don't update saved position+dimensions if currently docked.
    const state = this._dockState;
    const target = this.window.container;
    this._dockState = {
      dock,
      width: undefined !== state ? state.width : target.clientWidth,
      height: undefined !== state ? state.height : target.clientHeight,
      top: undefined !== state ? state.top : target.style.top,
      left: undefined !== state ? state.left : target.style.left,
    };
    this.applyDock();
  }

  public undock(): void {
    const s = this._dockState;
    if (undefined === s)
      return;

    const target = this.window.container;
    target.style.width = `${s.width}px`;
    target.style.height = `${s.height}px`;
    target.style.top = s.top;
    target.style.left = s.left;

    this._dockState = undefined;
    this.window.focus();
  }

  public applyDock(): void {
    if (undefined === this._dockState || !this.window.isResizable)
      return;

    const surf = this.window.surface;
    const sw = surf.element.clientWidth;
    const sh = surf.element.clientHeight;
    const hw = Math.floor(sw / 2);
    const hh = Math.floor(sh / 2);

    let l = 0;
    let w = sw;
    let t = 0;
    let h = sh;

    const dock = this._dockState.dock;
    if (Dock.Full !== dock) {
      if (dock & Dock.Top)
        h = hh;
      else if (dock & Dock.Bottom)
        t = h = hh;

      if (dock & Dock.Left)
        w = hw;
      else if (dock & Dock.Right)
        l = w = hw;
    }

    const style = this.window.container.style;
    style.left = `${l}px`;
    style.top = `${t}px`;
    style.width = `${w}px`;
    style.height = `${h}px`;

    this.window.focus();
  }

  public ensureInSurface(): void {
    const surf = this.window.surface;
    const surfaceTop = surf.element.clientTop;
    const surfaceBottom = surf.element.clientHeight;
    const surfaceLeft = surf.element.clientLeft;
    const surfaceRight = surfaceLeft + surf.element.clientWidth;
    const style = this.window.container.style;
    const windowHeight = this.window.container.clientHeight;
    const windowWidth = this.window.container.clientWidth;
    let windowTop = parseInt(style.top, 10);
    let windowLeft = parseInt(style.left, 10);
    const windowBottom = windowTop + windowHeight;
    const windowRight = windowLeft + windowWidth;

    // assure the window above of the surface boarder
    if (windowBottom >= surfaceBottom)
      windowTop = (surfaceBottom - windowHeight);
    if (windowTop < surfaceTop)
      windowTop = surfaceTop;
    style.top = `${windowTop}px`;
    if (windowHeight > surfaceBottom)
      style.height = `${surfaceBottom}px`;

    // assure the window left of the surface boarder
    if (windowRight >= surfaceRight)
      windowLeft = (surfaceRight - windowWidth);
    if (windowLeft < surfaceLeft)
      windowLeft = surfaceLeft;
    style.left = `${windowLeft}px`;
    if (windowWidth > surfaceRight)
      style.width = `${surfaceRight}px`;
  }

  public addDock(add: Dock): void {
    if (undefined === this._dockState) {
      this.dock(add);
      return;
    }

    if (Dock.Full === add)
      return;

    let dock = this._dockState.dock;
    dock |= add;
    if (add & Dock.Left)
      dock &= ~Dock.Right;
    if (add & Dock.Right)
      dock &= ~Dock.Left;
    if (add & Dock.Top)
      dock &= ~Dock.Bottom;
    if (add & Dock.Bottom)
      dock &= ~Dock.Top;

    this._dockState.dock = dock;
    this.applyDock();
  }

  public get isDocked() { return undefined !== this._dockState; }
  public invalidateDock() { this._dockState = undefined; }

  public resizeContent(w: number, h: number): void {
    // ###TODO kludge for 2px borders...
    w += 4;
    h += 4;
    w = Math.max(w, this._resizeState.minSize);
    h = Math.max(h, this._resizeState.minSize);

    this._dockState = undefined;
    const pw = this.window.contentDiv.clientWidth;
    const ph = this.window.contentDiv.clientHeight;
    const dw = w - pw;
    const dh = h - ph;

    const cont = this.window.container;
    cont.style.width = `${cont.clientWidth + dw}px`;
    cont.style.height = `${cont.clientHeight + dh}px`;
  }

  public hideCloseWidget(hide: boolean) {
    this._closeElement.style.display = hide ? "none" : "block";
  }

  public hideResizerWidget(hide: boolean) {
    this._resizerElement.style.display = hide ? "none" : "block";
  }

  public markAsPinned(isPinned: boolean) {
    if (isPinned)
      this._resizerElement.classList.add("window-pinned");
    else
      this._resizerElement.classList.remove("window-pinned");
  }
}

export interface WindowProps {
  title?: string;
  top?: number;
  left?: number;
  width?: number;
  height?: number;
  scrollbars?: boolean;
}

export abstract class Window {
  protected readonly _header: WindowHeader;
  public readonly container: HTMLElement;
  public readonly contentDiv: HTMLDivElement;
  public readonly surface: Surface;
  private _isPinned = false;

  public abstract get windowId(): string;

  public constructor(surface: Surface, props?: WindowProps) {
    this.surface = surface;
    this.container = IModelApp.makeHTMLElement("div", { className: "floating-window-container" });

    this.container.style.top = `${0}px`;
    this.container.style.left = `${0}px`;
    this.container.style.width = `${surface.element.clientWidth / 3}px`;
    this.container.style.height = `${surface.element.clientHeight / 3}px`;
    if (undefined !== props) {
      if (undefined !== props.top)
        this.container.style.top = `${props.top}px`;
      if (undefined !== props.left)
        this.container.style.left = `${props.left}px`;
      if (undefined !== props.width)
        this.container.style.width = `${props.width}px`;
      if (undefined !== props.height)
        this.container.style.height = `${props.height}px`;
    }

    this._header = new WindowHeader(this, this.container, undefined !== props ? props.title : undefined);
    this.contentDiv = IModelApp.makeHTMLElement("div", { className: "floating-window", parent: this.container });
    if (props && props.scrollbars)
      this.contentDiv.classList.add("overflow-auto");
  }

  // Do not set directly - use Surface.togglePin(window)
  public get isPinned(): boolean { return this._isPinned; }
  public set isPinned(value: boolean) {
    this._header.markAsPinned(value);
    this._isPinned = value;
  }

  public set title(title: string | undefined) {
    this._header.setTitle(title);
  }

  public focus(): void {
    this.surface.focus(this);
  }

  public get isDocked() { return this._header.isDocked; }
  public dock(dock: Dock) { this._header.dock(dock); }
  public updateDock() { this._header.applyDock(); }
  public undock() { this._header.undock(); }
  public ensureInSurface() { this._header.ensureInSurface(); }
  public invalidateDock() { this._header.invalidateDock(); }
  public addDock(dock: Dock) { this._header.addDock(dock); }
  public updateUi(): void { this._header.hideCloseWidget(!this.isCloseable); }

  public onFocus(): void {
    this.container.classList.add("window-focused");
    this._header.element.classList.add("window-header-focused");
  }

  public onLoseFocus(): void {
    this.container.classList.remove("window-focused");
    this._header.element.classList.remove("window-header-focused");
  }

  public onClosing(): void { }
  public onClosed(): void { }
  public get isCloseable(): boolean { return true; }
  public get isResizable(): boolean { return true; }

  public resizeContent(w: number, h: number): void {
    this._header.resizeContent(w, h);
  }

  public setHeaderVisible(visible: boolean): void {
    this._header.element.style.display = visible ? "block" : "none";
  }
}

export interface NamedWindowProps extends WindowProps {
  id: string;
}

export class NamedWindow extends Window {
  private readonly _windowId: string;

  public constructor(surface: Surface, props: NamedWindowProps) {
    super(surface, props);
    this._windowId = props.id;
    if (undefined === props.title)
      this._header.setTitle(this.windowId);
  }

  public get windowId() { return this._windowId; }
}
