/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ContextMenu */

import * as React from "react";
import * as ReactDOM from "react-dom";
import * as classnames from "classnames";

import "./ContextMenu.scss";

/** Enum to specify where a [[ContextMenu]] should anchor to its parent element */
export enum ContextMenuDirection {
  None = "",
  TopLeft = "top left", Top = "top", TopRight = "top right",
  Left = "left", Center = "center", Right = "right",
  BottomLeft = "bottom left", Bottom = "bottom", BottomRight = "bottom right",
}

/** Property interface for the [[ContextMenu]] component */
export interface ContextMenuProps {
  /**
   * Whether ContextMenu is currently opened.
   */
  opened: boolean;
  /**
   * Which direction the menu opens
   * Default: ContextMenuDirection.BottomRight
   */
  direction?: ContextMenuDirection;
  /** When Menu, and all submenus, are unfocused */
  onBlur?: (event: any) => any;
  /** When list item or submenu is selected */
  onSelect?: (event: any) => any;
  /** when Escape button is pressed */
  onEsc?: (data: any) => any;
  style?: React.CSSProperties;
  /**
   * Whether menu flips directions based on screen edge.
   * Default: true
   */
  autoflip?: boolean;
  /**
   * Whether menu hugs screen edge when autoflip is off.
   * Default: true
   */
  edgeLimit?: boolean;
  /**
   * starting menu item selected index
   * Default: -1
   */
  selected?: number;
  /**
   * whether menu floats on the viewport, or the page.
   * When false, container elements can clip menu with overflow: hidden;
   * Default: true
   */
  floating?: boolean;
  /** @hidden */
  parent?: ContextMenu;
  /** @hidden */
  parentSubmenu?: ContextSubMenu;
}

/** @hidden */
export interface ContextMenuState {
  selected: number;
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

  public static defaultProps: Partial<ContextMenuProps> = {
    direction: ContextMenuDirection.BottomRight,
    autoflip: true,
    edgeLimit: true,
    selected: -1,
    floating: true,
  };

  /** @hidden */
  public readonly state: Readonly<ContextMenuState> = {
    selected: this.props.selected!,
  };

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

  public render(): JSX.Element {
    const { opened, direction, parent } = this.props;
    let dir = direction;
    // check if menu should flip
    if (!parent && this.props.autoflip) {
      const menuRect = this.getRect();
      dir = ContextMenu.autoFlip(dir!, menuRect, window.innerWidth, window.innerHeight);
    }

    let index = 0;
    // add inheritance data to submenu children
    const children = React.Children.map(this.props.children, (child) => {
      if (typeof child === "string" || typeof child === "number" || child.props.disabled)
        return child;

      const id = index;
      const onHover = () => {
        this.setState({ selected: id });
        this.focus();
      };
      const ref = (el: any) => {
        if (child.props.ref)
          child.props.ref(el);
        if (selected)
          this._selectedElement = el;
      };
      const selected = this.state.selected === index++;
      if (child.type === ContextSubMenu) {
        return React.cloneElement(child, {
          direction: child.props.direction || dir,
          parent: this,
          ref,
          onHover,
          selected,
        });
      }
      if (child.type === ContextMenuItem) {
        return React.cloneElement(child, {
          parent: this,
          ref,
          onHover,
          selected,
        });
      }
      return child;
    });
    this._length = index;

    return (
      <div style={this.props.style}
        className="context-menu"
        onKeyUp={this._handleKeyUp}
        onClick={this._handleClick}
        data-testid="context-menu-root"
        ref={(el) => { this._rootElement = el; }}>
        <div
          ref={(el) => { this._menuElement = el; }}
          tabIndex={0}
          className={classnames("context-menu-container", { opened }, dir)}
        >
          {children}
        </div>
      </div>
    );
  }
  public componentDidMount() {
    window.addEventListener("focus", this._handleFocusChange);
    window.addEventListener("mouseup", this._handleFocusChange);
  }
  public componentWillUnmount() {
    window.removeEventListener("focus", this._handleFocusChange);
    window.removeEventListener("mouseup", this._handleFocusChange);
  }
  public focus = () => {
    if (this._menuElement)
      this._menuElement.focus();
  }

  public blur = () => {
    if (this._menuElement)
      this._menuElement.blur();
  }

  public getRect = (): ClientRect => {
    if (this._menuElement) {
      return this._menuElement.getBoundingClientRect();
    }
    return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 };
  }

  private _handleFocusChange = (event: any) => {
    if (this._rootElement && this.props.opened && event.target instanceof Node && this.props.onBlur && !this._rootElement.contains(event.target))
      this.props.onBlur(event);
  }
  private _handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (this.props.onSelect)
      this.props.onSelect(event);
  }
  private _handleKeyUp = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.keyCode === 37) /*<Left>*/ {
      event.stopPropagation();
      if (this.props.parent && this.props.parentSubmenu) {
        this.props.parentSubmenu.close();
        this.props.parent.focus();
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
    let { selected } = this.state;
    if (event.keyCode === 38 /*<Up>*/ || event.keyCode === 40/*<Down>*/) {
      event.stopPropagation();
      if (selected === -1) {
        selected = 0;
      } else {
        if (event.keyCode === 38) /*<Up>*/ {
          if (this.state.selected === 0)
            selected = this._length - 1;
          else
            selected--;
        }
        if (event.keyCode === 40) /*<Down>*/ {
          if (this.state.selected === this._length - 1)
            selected = 0;
          else
            selected++;
        }
      }
    }
    this.setState((_prevState) => ({ selected }));
  }

  public componentDidUpdate(prevProps: ContextMenuProps) {
    if (prevProps.selected !== this.props.selected) {
      this.setState((_prevState, props) => ({ selected: props.selected! }));
    }
    if (!prevProps.opened && this.props.opened) {
      this.setState((_prevState, props) => ({ selected: props.selected! }));
    }
  }
}

export default ContextMenu;

/** Properties for the [[GlobalContextMenu]] component */
export interface GlobalContextMenuProps {
  /**
   * Whether ContextMenu is currently opened.
   */
  opened: boolean;
  /**
   * Unique identifier, to distinguish from other GlobalContextMenu components
   */
  identifier: string;
  /**
   * Specifies the x/horizontal position on the viewport
   */
  x: number | string;
  /**
   * Specifies the y/vertical position on the viewport
   */
  y: number | string;
  /**
   * Which direction the menu opens
   * Default: ContextMenuDirection.BottomRight
   */
  direction?: ContextMenuDirection;
  /** When Menu, and all submenus, are unfocused */
  onBlur?: (event: any) => any;
  /** When list item or submenu is selected */
  onSelect?: (event: any) => any;
  /** when Escape button is pressed */
  onEsc?: (data: any) => any;
  style?: React.CSSProperties;
  /**
   * Whether menu flips directions based on screen edge
   * Default: true
   */
  autoflip?: boolean;
  /**
   * Whether menu hugs screen edge when autoflip is off.
   * Default: true
   */
  edgeLimit?: boolean;
  /**
   * starting menu item selected index
   * Default: -1
   */
  selected?: number;
}

/** GlobalContextMenu React component used to display a [[ContextMenu]] at the cursor */
export class GlobalContextMenu extends React.Component<GlobalContextMenuProps> {
  private _container: HTMLDivElement;
  constructor(props: GlobalContextMenuProps) {
    super(props);
    this._container = document.createElement("div");
    this._container.id = `context-menu-${props.identifier}`;
    let rt = document.getElementById("context-menu-root") as HTMLDivElement;
    if (!rt) {
      rt = document.createElement("div");
      rt.id = "context-menu-root";
      document.body.appendChild(rt);
    }
    rt.appendChild(this._container);
  }
  public componentWillUnmount() {
    if (this._container.parentElement) { // cleanup
      this._container.parentElement.removeChild(this._container);
    }
  }
  public render(): React.ReactNode {
    const { x, y, identifier, ...props } = this.props;
    const positioningStyle: React.CSSProperties = {
      left: x,
      top: y,
    };
    return ReactDOM.createPortal(
      <div className="context-menu-global" style={positioningStyle}>
        <ContextMenu
          {...props} />
      </div>
      , this._container);
  }
}

/** Properties for the [[ContextMenuItem]] component */
export interface ContextMenuItemProps extends React.AllHTMLAttributes<HTMLDivElement> {
  onClick?: (event: any) => any;
  className?: string;
  style?: React.CSSProperties;
  /** When item has been chosen, through click or keyboard. */
  onSelect?: (event: any) => any;
  /** Icon to display in the left margin. */
  icon?: string;
  /** Disables any onSelect calls, hover/keyboard highlighting, and grays item. */
  disabled?: boolean;
  /** Used by hover highlighting */
  onHover?: () => any;
  /** Used by hover highlighting */
  selected?: boolean;
  /** Used by keyboard navigation */
  parent?: ContextMenu;
}

/**
 * Menu Item class for use within a [[ContextMenu]] component.
 */
export class ContextMenuItem extends React.Component<ContextMenuItemProps> {
  private _root: HTMLElement | null = null;
  public static defaultProps: Partial<ContextMenuItemProps> = {
    disabled: false,
    selected: false,
  };
  constructor(props: ContextMenuItemProps) {
    super(props);
  }
  public render(): JSX.Element {
    const { onClick, className, style, onSelect, icon, disabled, onHover, selected, parent, ...props } = this.props;
    return (
      <div
        { ...props }
        ref={(el) => { this._root = el; }}
        onClick={this._handleClick}
        style={style}
        onFocus={this._handleFocus}
        onKeyUp={this._handleKeyUp}
        onMouseOver={this._handleMouseOver}
        data-testid={"context-menu-item"}
        className={classnames(className, "context-menu-item", { disabled, selected })}>
        <div className={classnames("context-menu-icon", "icon", this.props.icon)} />
        <div className={"context-menu-content"}>{this.props.children}</div>
      </div>
    );
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
      if (this.props.parent && this.props.parent.props.parentSubmenu)
        this.props.parent.props.parentSubmenu.close(true);
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
      <div {...this.props} className={"context-menu-divider"}>
      </div>
    );
  }
}

/** Property interface for [[ContextSubMenu]] */
export interface ContextSubMenuProps {
  onClick?: (event: any) => any;
  className?: string;
  style?: React.CSSProperties;
  /** Text/jsx to display in the list item */
  label: string | JSX.Element;
  /** When item has been chosen, through click or keyboard. */
  onSelect?: (event: any) => any;
  /** Icon to display in the left margin. */
  icon?: string;
  /**
   * Disables any onSelect calls, hover/keyboard highlighting, and grays item.
   * Default: false
   */
  disabled?: boolean;
  /**
   * Whether menu flips directions based on screen edge
   * Default: true
   */
  autoflip?: boolean;
  /**
   * Which direction the menu opens
   * Default: inherit
   */
  direction?: ContextMenuDirection;
  /** Used by hover highlighting */
  onHover?: () => any;
  /** Used by hover highlighting */
  selected?: boolean;
  /** Used by keyboard navigation */
  parent?: ContextMenu;
}

/** @hidden */
export interface ContextSubMenuState {
  opened: boolean;
  direction: ContextMenuDirection;
}

/**
 * Submenu wrapper class for use within a [[ContextMenu]] component.
 */
export class ContextSubMenu extends React.Component<ContextSubMenuProps, ContextSubMenuState> {
  private _menuElement: ContextMenu | null = null;
  private _subMenuElement: HTMLElement | null = null;
  private _menuButtonElement: HTMLElement | null = null;

  public static defaultProps: Partial<ContextSubMenuProps> = {
    disabled: false,
    autoflip: true,
    selected: false,
  };

  /** @hidden */
  public readonly state: Readonly<ContextSubMenuState> = { opened: false, direction: ContextMenuDirection.None };

  public render(): JSX.Element {
    const { disabled, selected, label, icon, autoflip, parent, children } = this.props;
    const direction = this.state.direction || this.props.direction!;
    if (autoflip && this._menuElement) {
      const menuRect = this._menuElement.getRect();
      const dir = ContextMenu.autoFlip(direction, menuRect, window.innerWidth, window.innerHeight);
      if (dir !== direction)
        this.setState({ direction: dir });
    }
    return (
      <div className={classnames("context-submenu", direction)}
        onMouseOver={this._handleMouseOver}
        ref={(el) => { this._subMenuElement = el; }}>
        <div
          onClick={this._handleClick}
          ref={(el) => { this._menuButtonElement = el; }}
          style={this.props.style}
          className={classnames("context-menu-item context-submenu-container", { disabled, selected })}>
          <div className={classnames("context-menu-icon", "icon", icon)} />
          <div className={"context-menu-content"}>{label}</div>
          <div className={classnames("context-submenu-arrow", "icon", "icon-caret-right")} />
        </div>
        <ContextMenu
          ref={(el) => { this._menuElement = el; }}
          opened={this.state.opened}
          selected={0}
          direction={direction}
          parent={parent}
          parentSubmenu={this}
          autoflip={autoflip}>
          {children}
        </ContextMenu>
      </div>
    );
  }
  public componentDidMount() {
    document.addEventListener("click", this._handleClickGlobal);
  }

  public componentWillUnmount() {
    document.removeEventListener("click", this._handleClickGlobal);
  }

  public select = () => {
    this.setState({ opened: true }, () => {
      if (this._menuElement)
        this._menuElement.focus();
    });
  }

  public close = (propagate?: boolean) => {
    this.setState({ opened: false }, () => {
      if (this._menuElement)
        this._menuElement.blur();
    });
    if (propagate && this.props.parent && this.props.parent.props.parentSubmenu) {
      this.props.parent.props.parentSubmenu.close(true);
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
      this.setState((prevState) => ({ opened: !prevState.opened }));
    }
  }

  private _handleClickGlobal = (event: any) => {
    if (this._subMenuElement && !this._subMenuElement.contains(event.target))
      this.setState((_prevState) => ({ opened: false }));
  }
}
