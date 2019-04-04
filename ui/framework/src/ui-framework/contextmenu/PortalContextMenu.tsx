import * as React from "react";
import * as ReactDOM from "react-dom";
import * as classnames from "classnames";
import { CommonProps } from "@bentley/ui-ninezone";
import "./PortalContextMenu.scss";

interface Point {
  x: number;
  y: number;
}

export enum Position {
  TopLeft,
  TopRight,
  BottomLeft,
  BottomRight,
  Top,
  Bottom,
  Left,
  Right,
}

/** Properties for [[ContextMenuItem]] component */
export interface MenuItem {
  /** Name of the context menu item */
  name?: string;
  /** Optional icon */
  icon?: string;
  /** Disabled */
  disabled?: boolean;
  /** Checked or not */
  checked?: boolean;
  /** Separator */
  isSeparator?: boolean;
  /** Called when the item is clicked */
  onClick?: () => void;
}

/**
 * A context menu item.
 */
export class ContextMenuItem extends React.Component<MenuItem> {

  private _onClick = (event: any) => {
    event.stopPropagation();
    if (!this.props.disabled && !this.props.isSeparator && this.props.onClick) {
      this.props.onClick();
    }
  }

  public render() {
    const menuClassName = classnames(
      "contextmenu-portal-item",
      this.props.disabled && "disabled",
      this.props.checked && "checked",
    );

    return (
      <>
        {this.props.isSeparator && <div className="separator" onClick={this._onClick} />}
        {!this.props.isSeparator &&
          <li className={menuClassName} onClick={this._onClick}>
            {this.props.checked && <span className="icon icon-checkmark" />}
            {(this.props.icon && !this.props.checked) && <span className={classnames("user-icon icon", this.props.icon)} />}
            <span>{this.props.name}</span>
          </li>
        }
      </>
    );
  }
}

/** Properties for [[ContextMenu]] component */
export interface ContextMenuProps extends CommonProps {
  /** Show or hide the context menu */
  menuOpened: boolean;
  /** Position relative to the parent (relative positioning) */
  position: Position;
  /** Top position (absolute positioning) */
  top: number;
  /** Left position (absolute positioning) */
  left: number;
  /** List of context menu items */
  items?: MenuItem[];
  /** Called when the mouse is clicked outside the context menu */
  onClickOutside?: () => void;
  /* owner to position the context menu */
  parent: HTMLElement | null;
  /* offset from the parent */
  offset: number;
}

interface ContextMenuState {
  top: number;
  left: number;
}

/**
 * Context menu popup containing a list of [[ContextMenuItem]].
 */
export class ContextMenuEx extends React.Component<ContextMenuProps, ContextMenuState> {
  private _menu: HTMLDivElement | null = null;

  constructor(props: ContextMenuProps) {
    super(props);

    this.state = { top: 0, left: 0 };
  }

  public static defaultProps: Partial<ContextMenuProps> = {
    offset: 0,
    position: Position.BottomRight,
    top: -1,
    left: -1,
  };

  public componentDidMount() {
    const point = this._fitMenu(this._getPosition());
    this.setState({ left: point.x, top: point.y });
  }

  private _getPosition = () => {
    const { parent, position, offset } = this.props;

    // absolute position
    if (this.props.top !== -1 && this.props.left !== -1)
      return { x: this.props.left, y: this.props.top };

    // relative position
    const point = { x: 0, y: 0 };
    if (!this._menu || !parent)
      return point;

    const scrollY = (window.scrollY !== undefined) ? window.scrollY : window.pageYOffset;
    const scrollX = (window.scrollX !== undefined) ? window.scrollX : window.pageXOffset;

    const menuRect = this._menu.getBoundingClientRect();
    const parentRect = parent!.getBoundingClientRect();

    switch (position) {
      case Position.Top:
        point.y = scrollY + parentRect.top - menuRect.height - offset;
        point.x = scrollX + parentRect.left + (parentRect.width / 2) - (menuRect.width / 2);
        break;

      case Position.Left:
        point.y = scrollY + parentRect.top + (parentRect.height / 2) - offset;
        point.x = scrollX + parentRect.left - offset - menuRect.width;
        break;

      case Position.Bottom:
        point.y = scrollY + parentRect.top + parentRect.height + offset;
        point.x = scrollX + parentRect.left + (parentRect.width / 2) - (menuRect.width / 2);
        break;

      case Position.TopRight:
        point.y = scrollY + parentRect.top - menuRect.height + offset;
        point.x = scrollX + parentRect.left + parentRect.width - menuRect.width;
        break;

      case Position.BottomRight:
        point.y = scrollY + parentRect.top + parentRect.height + offset;
        point.x = scrollX + parentRect.left + parentRect.width - menuRect.width;
        break;

      case Position.BottomLeft:
        point.y = scrollY + parentRect.top + parentRect.height + offset;
        point.x = scrollX + parentRect.left;
        break;

      case Position.Right:
        point.y = scrollY + parentRect.top + (parentRect.height / 2) - offset;
        point.x = scrollX + parentRect.left + parentRect.width + offset;
        break;

      default:
        break;
    }

    return point;
  }

  // fit the menu within the extents of the view port
  private _fitMenu = (point: Point) => {
    const fittedPoint = point;

    if (!this._menu)
      return fittedPoint;

    const menuRect = this._menu.getBoundingClientRect();

    const { innerWidth, innerHeight } = window;

    if (fittedPoint.y + menuRect.height > innerHeight) {
      // fittedPoint.y -= menuRect.height;
      fittedPoint.y = innerHeight - menuRect.height;
    }

    if (fittedPoint.x + menuRect.width > innerWidth) {
      // fittedPoint.x -= menuRect.width;
      fittedPoint.x = innerWidth - menuRect.width;
    }

    if (fittedPoint.y < 0) {
      // fittedPoint.y = menuRect.height < innerHeight ? (innerHeight - menuRect.height) / 2 : 0;
      fittedPoint.y = 0;
    }

    if (fittedPoint.x < 0) {
      // fittedPoint.x = menuRect.width < innerWidth ? (innerWidth - menuRect.width) / 2 : 0;
      fittedPoint.x = 0;
    }

    return fittedPoint;
  }

  private _setMenu = (el: HTMLDivElement | null) => {
    this._menu = el;
  }

  private _onClick = (event: any) => {
    event.stopPropagation();
    if (this.props.onClickOutside) {
      this.props.onClickOutside();
    }
  }

  public render() {
    return (
      <div className="contextmenu-portal" ref={this._setMenu} style={{ top: this.state.top, left: this.state.left }} onClick={this._onClick}>
        <ul>
          {this.props.items && this.props.items.map((item: MenuItem, index: number) => (
            <ContextMenuItem key={index} name={item.name} icon={item.icon} disabled={item.disabled} onClick={item.onClick} isSeparator={item.isSeparator} />
          ))
          }
          {this.props.children}
        </ul>
      </div>
    );
  }
}

/** Properties for [[ContextMenu]] component */
export interface ContextMenuPortalProps extends CommonProps {
  /** Show or hide the context menu */
  isOpened: boolean;
  /** Position the context menu relative to the parent */
  position: Position;
  /** List of context menu items */
  items?: MenuItem[];
  /** Called when the mouse is clicked outside the context menu */
  onClickOutside?: () => void;
  /** parent element */
  parent: HTMLElement | null;
  /* offset from the parent */
  offset: number;
}

export class ContextMenuPortal extends React.Component<ContextMenuPortalProps> {
  private _menu: HTMLElement | null = null;

  public static defaultProps: Partial<ContextMenuProps> = {
    offset: 0,
    position: Position.BottomRight,
  };

  public componentWillUnmount() {
    this._unBindWindowEvent();
  }

  public componentDidUpdate(previousProps: ContextMenuPortalProps) {
    if (this.props.isOpened === previousProps.isOpened)
      return;

    if (this.props.isOpened) {
      this._bindWindowEvent();
    } else {
      this._unBindWindowEvent();
    }
  }

  private _bindWindowEvent = () => {
    window.addEventListener("mousedown", this._handleOutsideClick);
    // window.addEventListener("touchstart", this._handleOutsideClick);
    // window.addEventListener("click", this._onBodyClick);
    window.addEventListener("resize", this._hide);
    window.addEventListener("contextmenu", this._hide);
    window.addEventListener("scroll", this._hide);
    window.addEventListener("wheel", this._hide);
    window.addEventListener("keydown", this._handleKeyboard);
  }

  private _unBindWindowEvent = () => {
    window.removeEventListener("mousedown", this._handleOutsideClick);
    // window.removeEventListener("touchstart", this._handleOutsideClick);
    // window.removeEventListener("click", this._handleOutsideClick);
    window.removeEventListener("resize", this._hide);
    window.removeEventListener("contextmenu", this._hide);
    window.removeEventListener("scroll", this._hide);
    window.removeEventListener("wheel", this._hide);
    window.removeEventListener("keydown", this._handleKeyboard);
  }

  private _handleOutsideClick = (event: MouseEvent): void => {
    if (this._menu && this._menu.contains(event.target as Node)) {
      return;
    }

    if (this.props.parent && this.props.parent.contains(event.target as Node))
      return;

    this._hide();
  }

  private _handleKeyboard = (event: KeyboardEvent): void => {
    if (event.key === "Escape" || event.key === "Enter") {
      if (this.props.onClickOutside)
        this.props.onClickOutside();
    }
  }

  private _hide = () => {
    if (this.props.onClickOutside)
      this.props.onClickOutside();
  }

  private _setMenu = (el: HTMLElement | null) => {
    this._menu = el;
  }

  public render() {
    if (!this.props.isOpened || !this.props.parent)
      return null;

    return ReactDOM.createPortal(
      (
        <div ref={this._setMenu}>
          <ContextMenuEx
            parent={this.props.parent}
            offset={this.props.offset}
            position={this.props.position}
            items={this.props.items}
            onClickOutside={this.props.onClickOutside}>
            {this.props.children}
          </ContextMenuEx>
        </div>
      ), document.body);
  }
}
