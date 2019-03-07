/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ContextMenu */

import * as React from "react";
import * as ReactDOM from "react-dom";
import * as classnames from "classnames";

import "./ContextMenu.scss";
import { withOnOutsideClick } from "../hocs/withOnOutsideClick";
import { Omit } from "../utils/typeUtils";

const DivWithOutsideClick = withOnOutsideClick((props) => (<div {...props} />)); // tslint:disable-line:variable-name

/** Enum to specify where a [[ContextMenu]] should anchor to its parent element */
export enum ContextMenuDirection {
  None = "",
  TopLeft = "top left", Top = "top", TopRight = "top right",
  Left = "left", Center = "center", Right = "right",
  BottomLeft = "bottom left", Bottom = "bottom", BottomRight = "bottom right",
}

/** Property interface for the [[ContextMenu]] component */
export interface ContextMenuProps extends React.AllHTMLAttributes<HTMLDivElement> {
  /** Whether ContextMenu is currently opened. */
  opened: boolean;
  /** Which direction the menu opens. Default: ContextMenuDirection.BottomRight */
  direction?: ContextMenuDirection;
  /** When click is registered outside of ContextMenu. */
  onOutsideClick?: (event: MouseEvent) => any;
  /** When list item or submenu is selected */
  onSelect?: (event: any) => any;
  /** when Escape button is pressed */
  onEsc?: (data: any) => any;
  /** Whether menu flips directions based on screen edge. Default: true */
  autoflip?: boolean;
  /** Whether menu hugs screen edge when autoflip is off. Default: true */
  edgeLimit?: boolean;
  /** Whether Hotkey press selects item, or just highlights item. Default: true */
  hotkeySelect?: boolean;
  /** starting menu item selected index Default: -1 */
  selectedIndex?: number;
  /** whether menu floats on the viewport, or the page. When false, container elements can clip menu with overflow: hidden; Default: true */
  floating?: boolean;
  /** @hidden */
  parentMenu?: ContextMenu;
  /** @hidden */
  parentSubmenu?: ContextSubMenu;
}

/** @hidden */
export interface ContextMenuState {
  selectedIndex: number;
  direction: ContextMenuDirection;
}

/**
 * A context menu populated with [[ContextMenuItem]] components.
 * Can be nested using [[ContextSubMenu]] component.
 */
export class ContextMenu extends React.Component<ContextMenuProps, ContextMenuState> {
  private _rootElement: HTMLElement | null = null;
  private _menuElement: HTMLElement | null = null;
  private _selectedElement: ContextMenuItem | ContextSubMenu | null = null;
  private _length: number = 0;
  private _hotKeyMap: Map<number, string> = new Map();

  private _lastChildren: React.ReactNode;
  private _lastDir: ContextMenuDirection | undefined = ContextMenuDirection.BottomRight;
  private _lastSelectedIndex: number = 0;
  private _injectedChildren: React.ReactNode;

  public static defaultProps: Partial<ContextMenuProps> = {
    direction: ContextMenuDirection.BottomRight,
    autoflip: true,
    edgeLimit: true,
    hotkeySelect: true,
    selectedIndex: -1,
    floating: true,
  };

  /** @hidden */
  public readonly state: Readonly<ContextMenuState>;
  constructor(props: ContextMenuProps) {
    super(props);
    this.state = {
      selectedIndex: this.props.selectedIndex!,
      direction: props.direction!,
    };
  }

  /** @hidden */
  public static autoFlip = (dir: ContextMenuDirection, rect: ClientRect, windowWidth: number, windowHeight: number) => {
    if (rect.right > windowWidth) {
      switch (dir) {
        case ContextMenuDirection.TopRight:
          dir = ContextMenuDirection.TopLeft;
          break;
        case ContextMenuDirection.Right:
          dir = ContextMenuDirection.Left;
          break;
        case ContextMenuDirection.BottomRight:
          dir = ContextMenuDirection.BottomLeft;
          break;
      }
    }
    if (rect.left < 0) {
      switch (dir) {
        case ContextMenuDirection.TopLeft:
          dir = ContextMenuDirection.TopRight;
          break;
        case ContextMenuDirection.Left:
          dir = ContextMenuDirection.Right;
          break;
        case ContextMenuDirection.BottomLeft:
          dir = ContextMenuDirection.BottomRight;
          break;
      }
    }
    if (rect.bottom > windowHeight) {
      switch (dir) {
        case ContextMenuDirection.BottomLeft:
          dir = ContextMenuDirection.TopLeft;
          break;
        case ContextMenuDirection.Bottom:
          dir = ContextMenuDirection.Top;
          break;
        case ContextMenuDirection.BottomRight:
          dir = ContextMenuDirection.TopRight;
          break;
      }
    }
    if (rect.top < 0) {
      switch (dir) {
        case ContextMenuDirection.TopLeft:
          dir = ContextMenuDirection.BottomLeft;
          break;
        case ContextMenuDirection.Top:
          dir = ContextMenuDirection.Bottom;
          break;
        case ContextMenuDirection.TopRight:
          dir = ContextMenuDirection.BottomRight;
          break;
      }
    }
    return dir;
  }

  private _handleHotKeyParsed = (index: number, hotKey: string) => {
    this._hotKeyMap.set(index, hotKey);
  }

  public render(): JSX.Element {
    const { opened, direction, onOutsideClick, onSelect, onEsc, autoflip, edgeLimit, hotkeySelect, selectedIndex, floating, parentMenu, parentSubmenu, children, ...props } = this.props;
    let dir = parentMenu === undefined ? this.state.direction : direction;
    // check if menu should flip
    if (autoflip && parentMenu === undefined) {
      const menuRect = this.getRect();
      dir = ContextMenu.autoFlip(dir!, menuRect, window.innerWidth, window.innerHeight);
      if (dir !== this.state.direction)
        this.setState({ direction: dir });
    }

    if (this._lastChildren !== children || this._lastDir !== dir || this._lastSelectedIndex !== this.state.selectedIndex) {
      this._injectedChildren = this._injectMenuItemProps(children, dir, this.state.selectedIndex);
      this._lastChildren = children;
      this._lastDir = dir;
      this._lastSelectedIndex = this.state.selectedIndex;
    }
    return (
      <div
        className={classnames("context-menu", this.props.className)}
        onKeyUp={this._handleKeyUp}
        onClick={this._handleClick}
        data-testid="context-menu-root"
        {...props}
        ref={this._rootRef}>
        <DivWithOutsideClick onOutsideClick={onOutsideClick}>
          <div
            ref={this._menuRef}
            tabIndex={0}
            data-testid="context-menu-container"
            className={classnames("context-menu-container", { opened, floating }, dir)}>
            {this._injectedChildren}
          </div>
        </DivWithOutsideClick>
      </div>
    );
  }

  private _injectMenuItemProps = (children: React.ReactNode, direction: ContextMenuDirection | undefined, selectedIndex: number) => {
    let index = 0;
    // add inheritance data to submenu children
    const ch = React.Children.map(children, (child: React.ReactNode) => {
      // Capture only ContextSubMenus and ContextMenuItems.
      if (child && typeof child === "object" && "props" in child && !child.props.disabled && (child.type === ContextSubMenu || child.type === ContextMenuItem)) {
        const id = index; // get separate id variable so value stays the same when onHover is called later.
        const onHover = () => {
          this.setState({ selectedIndex: id });
          this.focus();
        };
        const ref = (el: ContextSubMenu | ContextMenuItem | null) => {
          if (selectedIndex === id) // only save to this._selectedElement if previously captured bool is true
            this._selectedElement = el;
        };
        const boundHandleHotKeyParse = this._handleHotKeyParsed.bind(this, id); // bind local callback for specific index
        const childProps: Partial<ContextSubMenuProps & ContextMenuItemProps & { ref: typeof ref }> = {
          parentMenu: this,
          ref,
          onHover,
          isSelected: selectedIndex === id,
          onHotKeyParsed: boundHandleHotKeyParse,
        };
        if (child.type === ContextSubMenu) { // add direction only to sub-menus
          childProps.direction = child.props.direction || direction;
        }
        index++;
        return React.cloneElement(child, childProps);
      } else return child; // Else, pass through unmodified
    });
    this._length = index;
    return ch;
  }

  private _rootRef = (el: HTMLDivElement | null) => {
    this._rootElement = el;
  }

  private _menuRef = (el: HTMLDivElement | null) => {
    this._menuElement = el;
  }

  /** @hidden */
  public componentDidMount() {
    window.addEventListener("focus", this._handleFocusChange);
    window.addEventListener("mouseup", this._handleFocusChange);
  }

  /** @hidden */
  public componentWillUnmount() {
    window.removeEventListener("focus", this._handleFocusChange);
    window.removeEventListener("mouseup", this._handleFocusChange);
  }

  public focus = () => {
    // istanbul ignore else
    if (this._menuElement)
      this._menuElement.focus();
  }

  public blur = () => {
    // istanbul ignore else
    if (this._menuElement)
      this._menuElement.blur();
  }

  public getRect = (): ClientRect => {
    // istanbul ignore else
    if (this._menuElement) {
      return this._menuElement.getBoundingClientRect();
    }
    return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 };
  }

  private _handleFocusChange = (event: any) => {
    if (this._rootElement && this.props.opened && event.target instanceof Node && this.props.onOutsideClick && !this._rootElement.contains(event.target))
      this.props.onOutsideClick(event);
  }
  private _handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (this.props.onSelect)
      this.props.onSelect(event);
  }
  private _handleKeyUp = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key) {
      for (const [key, value] of this._hotKeyMap) {
        if (!this.props.hotkeySelect! && key > this.state.selectedIndex) { // Start search at current index.
          if (event.key.toUpperCase() === value) {
            this.setState({ selectedIndex: key });
            return;
          }
        }
      }
      for (const [key, value] of this._hotKeyMap) {
        if (event.key.toUpperCase() === value) {
          this.setState({ selectedIndex: key }, () => {
            if (this.props.hotkeySelect && this._selectedElement) {
              this._selectedElement.select();
            }
          });
          return;
        }
      }
    }
    if (event.keyCode === 37) /*<Left>*/ {
      event.stopPropagation();
      if (this.props.parentMenu && this.props.parentSubmenu) {
        this.props.parentSubmenu.close();
        this.props.parentMenu.focus();
      }
      if (this.props.onEsc)
        this.props.onEsc(event);
    }
    if (event.keyCode === 27/*<Esc>*/) {
      if (this.props.onEsc)
        this.props.onEsc(event);
    }
    if ((event.keyCode === 13 /*<Return>*/ || event.keyCode === 39 /*<Right>*/) && this._selectedElement) {
      event.stopPropagation();
      if (event.keyCode === 13 || this._selectedElement instanceof ContextSubMenu) {
        if (this._selectedElement.select)
          this._selectedElement.select();
      }
    }
    let { selectedIndex } = this.state;
    if (event.keyCode === 38 /*<Up>*/ || event.keyCode === 40/*<Down>*/) {
      event.stopPropagation();
      if (selectedIndex === -1) {
        selectedIndex = 0;
      } else {
        if (event.keyCode === 38) /*<Up>*/ {
          if (this.state.selectedIndex === 0)
            selectedIndex = this._length - 1;
          else
            selectedIndex--;
        }
        if (event.keyCode === 40) /*<Down>*/ {
          if (this.state.selectedIndex === this._length - 1)
            selectedIndex = 0;
          else
            selectedIndex++;
        }
      }
    }
    this.setState({ selectedIndex });
  }

  public componentDidUpdate(prevProps: ContextMenuProps) {
    if (prevProps.selectedIndex !== this.props.selectedIndex) {
      this.setState((_prevState, props) => ({ selectedIndex: props.selectedIndex! }));
    }
    if (!prevProps.opened && this.props.opened) {
      this.setState((_prevState, props) => ({ selectedIndex: props.selectedIndex! }));
    }
    if (!this.props.parentMenu) {
      const direction = this.props.direction!;
      if ((!this.props.opened && prevProps.opened && direction !== this.state.direction) || prevProps.direction !== direction)
        this.setState({ direction });
    }
  }
}

export default ContextMenu;

/** Properties for the [[GlobalContextMenu]] component */
export interface GlobalContextMenuProps extends ContextMenuProps {
  /** Unique identifier, to distinguish from other GlobalContextMenu components. Needed only if multiple GlobalContextMenus are used simultaneously. */
  identifier?: string;
  /** Specifies the x/horizontal position on the viewport. */
  x: number | string;
  /** Specifies the y/vertical position on the viewport. */
  y: number | string;
  /** Context menu element. Default: ContextMenu */
  contextMenuComponent?: React.ComponentType<ContextMenuProps>;
}

/** GlobalContextMenu React component used to display a [[ContextMenu]] at the cursor */
export class GlobalContextMenu extends React.Component<GlobalContextMenuProps> {
  private _container: HTMLDivElement;
  constructor(props: GlobalContextMenuProps) {
    super(props);
    this._container = document.createElement("div");
    this._container.id = props.identifier !== undefined ? `context-menu-${props.identifier}` : "context-menu";
    let rt = document.getElementById("context-menu-root") as HTMLDivElement;
    if (!rt) {
      rt = document.createElement("div");
      rt.id = "context-menu-root";
      document.body.appendChild(rt);
    }
    rt.appendChild(this._container);
  }
  public componentWillUnmount() {
    // istanbul ignore else
    if (this._container.parentElement) { // cleanup
      this._container.parentElement.removeChild(this._container);
    }
  }
  public render(): React.ReactNode {
    const { x, y, identifier, contextMenuComponent, ...props } = this.props;
    const positioningStyle: React.CSSProperties = {
      left: x,
      top: y,
    };

    const CtxMenu = contextMenuComponent || ContextMenu; // tslint:disable-line:variable-name

    return ReactDOM.createPortal(
      <div className="context-menu-global" style={positioningStyle}>
        <CtxMenu
          {...props} />
      </div >
      , this._container);
  }
}

/** Properties for the [[ContextMenuItem]] component */
export interface ContextMenuItemProps extends React.AllHTMLAttributes<HTMLDivElement> {
  onSelect?: (event: any) => any;
  /** @hidden */
  onHotKeyParsed?: (hotKey: string) => void;
  /** Icon to display in the left margin. */
  icon?: string | React.ReactNode;
  /** Disables any onSelect calls, hover/keyboard highlighting, and grays item. */
  disabled?: boolean;
  /** @hidden */
  onHover?: () => any;
  /* @hidden */
  isSelected?: boolean;
  /** @hidden */
  parentMenu?: ContextMenu;
}

export interface ContextMenuItemState {
  hotKey?: string;
}

/**
 * Menu Item class for use within a [[ContextMenu]] component.
 */
export class ContextMenuItem extends React.Component<ContextMenuItemProps, ContextMenuItemState> {
  private _root: HTMLElement | null = null;
  private _lastChildren: React.ReactNode;
  private _parsedChildren: React.ReactNode;
  public static defaultProps: Partial<ContextMenuItemProps> = {
    disabled: false,
    isSelected: false,
  };
  constructor(props: ContextMenuItemProps) {
    super(props);
  }
  /** @hidden */
  public readonly state: Readonly<ContextMenuItemState> = {};
  public render(): JSX.Element {
    const { onClick, className, style, onSelect, icon, disabled, onHover, isSelected, parentMenu, onHotKeyParsed, ...props } = this.props;
    if (this._lastChildren !== this.props.children) {
      this._parsedChildren = TildeFinder.findAfterTilde(this.props.children).node;
      this._lastChildren = this.props.children;
    }
    return (
      <div
        {...props}
        ref={(el) => { this._root = el; }}
        onClick={this._handleClick}
        style={style}
        onFocus={this._handleFocus}
        onKeyUp={this._handleKeyUp}
        onMouseOver={this._handleMouseOver}
        data-testid={"context-menu-item"}
        className={classnames(className, "context-menu-item", { disabled, "is-selected": isSelected })}>
        <div className={classnames("context-menu-icon", "icon", typeof icon === "string" ? icon : undefined)}>
          {typeof icon !== "string" ? icon : undefined}
        </div>
        <div className={"context-menu-content"}>
          {this._parsedChildren}
        </div>
      </div>
    );
  }

  public componentDidMount() {
    this._updateHotkey(this.props.children);
  }

  public componentDidUpdate(prevProps: ContextMenuItemProps) {
    if (this.props.children !== prevProps.children) {
      this._updateHotkey(this.props.children);
    }
  }

  private _updateHotkey = (node: React.ReactNode) => {
    const hotKey = TildeFinder.findAfterTilde(node).character;
    if (hotKey && hotKey !== this.state.hotKey) {
      this.setState({ hotKey });
      this.props.onHotKeyParsed!(hotKey);
    }
  }

  private _handleFocus = (event: React.FocusEvent<HTMLDivElement>) => {
    event.stopPropagation();
  }

  private _handleMouseOver = (_event: React.MouseEvent<HTMLDivElement>) => {
    if (this._root && this._root.style.visibility !== "hidden" && this.props.onHover) {
      this.props.onHover();
    }
  }

  public select = () => {
    if (this._root) {
      this._root.click();
      if (this.props.parentMenu && this.props.parentMenu.props.parentSubmenu)
        this.props.parentMenu.props.parentSubmenu.close(true);
    }
  }

  private _handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (this.props.onClick)
      this.props.onClick(event);
    if (this.props.onSelect)
      this.props.onSelect(event);
  }
  private _handleKeyUp = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.keyCode === 13 && this.props.onSelect !== undefined) {
      this.props.onSelect(event);
    }
  }
}

/**
 * Menu Divider for [[ContextMenu]]. Inserts a line between items, used for list item grouping.
 */
export class ContextMenuDivider extends React.Component {
  public render(): JSX.Element {
    return (
      <div {...this.props} data-testid="context-menu-divider" className="context-menu-divider">
      </div>
    );
  }
}

/** Property interface for [[ContextSubMenu]] */
export interface ContextSubMenuProps extends Omit<ContextMenuItemProps, "label">, Omit<ContextMenuProps, "label"> {
  /** Text/jsx to display in the list item */
  label: string | JSX.Element;
  /** @hidden */
  onHotKeyParsed?: (hotKey: string) => void;
}

/** @hidden */
export interface ContextSubMenuState {
  opened: boolean;
  direction: ContextMenuDirection;
  hotKey?: string;
}

/**
 * Submenu wrapper class for use within a [[ContextMenu]] component.
 */
export class ContextSubMenu extends React.Component<ContextSubMenuProps, ContextSubMenuState> {
  private _menuElement: ContextMenu | null = null;
  private _subMenuElement: HTMLElement | null = null;
  private _menuButtonElement: HTMLElement | null = null;

  private _lastLabel: React.ReactNode;
  private _parsedLabel: React.ReactNode;

  public static defaultProps: Partial<ContextSubMenuProps> = {
    direction: ContextMenuDirection.BottomRight,
    disabled: false,
    autoflip: true,
    isSelected: false,
    selectedIndex: 0,
  };

  /** @hidden */
  public readonly state: Readonly<ContextSubMenuState>;
  constructor(props: ContextSubMenuProps) {
    super(props);
    this.state = {
      opened: false,
      direction: props.direction!,
    };
  }

  public render(): JSX.Element {
    const {
      label,
      opened, direction, onOutsideClick, onEsc, autoflip, edgeLimit, selectedIndex, floating, parentMenu, parentSubmenu,
      onSelect, icon, disabled, onHover, isSelected, onHotKeyParsed,
      children, onClick, className, ...props } = this.props;
    const contextMenuProps = { onOutsideClick, onSelect, onEsc, autoflip, edgeLimit, selectedIndex, floating, parentMenu };

    let dir = this.state.direction;
    if (autoflip && this._menuElement) {
      const menuRect = this._menuElement.getRect();
      dir = ContextMenu.autoFlip(dir, menuRect, window.innerWidth, window.innerHeight);
      if (dir !== this.state.direction)
        this.setState({ direction: dir });
    }

    if (this._lastLabel !== label) {
      this._parsedLabel = TildeFinder.findAfterTilde(label).node;
      this._lastLabel = label;
    }
    return (
      <div className={classnames("context-submenu", dir, className)}
        onMouseOver={this._handleMouseOver}
        ref={(el) => { this._subMenuElement = el; }}
        {...props} >
        <div
          onClick={this._handleClick}
          ref={(el) => { this._menuButtonElement = el; }}
          className={classnames("context-menu-item context-submenu-container", { disabled, "is-selected": isSelected })}
        >
          <div className={classnames("context-menu-icon", "icon", icon)} />
          <div className={"context-menu-content"}>{this._parsedLabel}</div>
          <div className={classnames("context-submenu-arrow", "icon", "icon-caret-right")} />
        </div>
        <ContextMenu
          ref={(el) => { this._menuElement = el; }}
          opened={this.state.opened}
          selectedIndex={0}
          direction={dir}
          parentSubmenu={this}
          {...contextMenuProps} >
          {children}
        </ContextMenu>
      </div>
    );
  }
  public componentDidMount() {
    document.addEventListener("click", this._handleClickGlobal);
    this._updateHotkey(this.props.label);
  }

  public componentWillUnmount() {
    document.removeEventListener("click", this._handleClickGlobal);
  }

  public componentDidUpdate(prevProps: ContextSubMenuProps, prevState: ContextSubMenuState) {
    const direction = this.props.direction!;
    if ((this.state.opened !== prevState.opened && direction !== this.state.direction) || prevProps.direction !== direction)
      this.setState({ direction });
    if (this.props.children !== prevProps.children) {
      this._updateHotkey(this.props.label);
    }
  }

  private _updateHotkey = (node: React.ReactNode) => {
    const hotKey = TildeFinder.findAfterTilde(node).character;
    if (hotKey && hotKey !== this.state.hotKey) {
      this.setState({ hotKey });
      this.props.onHotKeyParsed!(hotKey);
    }
  }

  public select = () => {
    this.setState({ opened: true }, () => {
      if (this._menuElement)
        this._menuElement.focus();
      if (this.props.onSelect !== undefined)
        this.props.onSelect(undefined);
    });
  }

  public close = (propagate?: boolean) => {
    this.setState({ opened: false }, () => {
      if (this._menuElement)
        this._menuElement.blur();
    });
    if (propagate && this.props.parentMenu && this.props.parentMenu.props.parentSubmenu) {
      this.props.parentMenu.props.parentSubmenu.close(true);
    }
  }

  private _handleMouseOver = (_event: React.MouseEvent<HTMLDivElement>) => {
    if (this._menuButtonElement && this._menuButtonElement.style.visibility !== "hidden" && this.props.onHover) {
      this.props.onHover();
    }
  }

  private _handleClick = (event: any) => {
    event.stopPropagation();
    if (!this.props.disabled) {
      if (this.props.onClick !== undefined)
        this.props.onClick(event);
      if (this.props.opened)
        this.close();
      else
        this.select();
    }
  }

  private _handleClickGlobal = (event: any) => {
    if (this._subMenuElement && !this._subMenuElement.contains(event.target))
      this.setState((_prevState) => ({ opened: false }));
  }
}

export class TildeFinder {
  public static findAfterTilde = (node: React.ReactNode): { character: string | undefined, node: React.ReactNode } => {
    if (typeof node === "string") {
      // String
      const tildeIndex = node.indexOf("~");
      if (tildeIndex !== -1 && tildeIndex <= node.length - 2) {
        const ch = node.charAt(tildeIndex + 1);
        const s1 = node.substring(0, tildeIndex);
        const n = <u key="hotkey">{ch}</u>;
        const s2 = node.substring(tildeIndex + 2);
        return { character: ch.toUpperCase(), node: [s1, n, s2] };
      }
    } else if (node && typeof node === "object") {
      if (Array.isArray(node)) {
        // Array
        let ret: { character: string | undefined, node: React.ReactNode } = { character: undefined, node };
        node = node.map((child) => {
          const r = TildeFinder.findAfterTilde(child);
          if (r.character) { // if character is found, modify node instead of returning unmodified child.
            ret = r;
            return r.node;
          }
          return child;
        });
        if (ret.character) {
          return { character: ret.character, node };
        }
      } else if ("props" in node) {
        // React Node
        const ret: { character: string | undefined, node: React.ReactNode } = { character: undefined, node };
        ret.node = React.cloneElement(node, {
          children: React.Children.map(node.props.children as React.ReactNode, (child: React.ReactNode) => {
            const r = TildeFinder.findAfterTilde(child);
            if (r.character) { // if character is found, modify node instead of returning unmodified child.
              ret.character = r.character;
              return r.node;
            }
            return child;
          }),
        });
        if (ret.character) {
          return ret;
        }
      }
    }
    return { character: undefined, node };
  }
}
