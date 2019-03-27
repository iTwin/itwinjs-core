/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Popup */

import * as React from "react";
import * as ReactDOM from "react-dom";
import * as classnames from "classnames";
import { CommonProps } from "../utils/Props";
import "./Popup.scss";

interface Point {
  x: number;
  y: number;
}

/** Position of the popup relative to its target */
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

/** Properties for the [[Popup]] component */
export interface PopupProps extends CommonProps {
  /**  show or hide the box shadow */
  showShadow: boolean;
  /** show or hide the arrow */
  showArrow: boolean;
  /** indicate if the popup is shown or not */
  isOpen: boolean;
  /** Direction (relative to the target) to which the popup is expanded */
  position: Position;
  /** Top position (absolute positioning) */
  top: number;
  /** Left position (absolute positioning) */
  left: number;
  /** Function called when the popup is opened */
  onOpen?: () => void;
  /** Function called when the popup is closed */
  onClose?: () => void;
  /* offset from the parent */
  offset: number;
  /** target element to position popup */
  target?: HTMLElement | null;
}

interface PopupState {
  isOpen: boolean;
  top: number;
  left: number;
  position: Position;
}

/** Popup React component */
export class Popup extends React.Component<PopupProps, PopupState> {
  private _popup: HTMLElement | null = null;

  constructor(props: PopupProps, context?: any) {
    super(props, context);

    this.state = { isOpen: this.props.isOpen, top: 0, left: 0, position: this.props.position };
  }

  public static defaultProps: Partial<PopupProps> = {
    position: Position.Bottom,
    showShadow: true,
    showArrow: false,
    isOpen: false,
    offset: 4,
    top: -1,
    left: -1,
  };

  public componentDidMount() {
    if (this.props.isOpen) {
      this._onShow();
    }
  }

  public componentDidUpdate(previousProps: PopupProps) {
    if (this.props.isOpen === previousProps.isOpen)
      return;

    if (this.props.isOpen) {
      this._onShow();
    } else {
      this._onClose();
    }
  }

  public componentWillUnmount() {
    this._unBindWindowEvents();
  }

  private _bindWindowEvents = () => {
    window.addEventListener("mousedown", this._handleOutsideClick);
    // window.addEventListener("touchstart", this._handleOutsideClick);
    // window.addEventListener("click", this._onBodyClick);
    window.addEventListener("resize", this._hide);
    window.addEventListener("contextmenu", this._hide);
    window.addEventListener("scroll", this._hide);
    window.addEventListener("wheel", this._hide);
    window.addEventListener("keydown", this._handleKeyboard);
  }

  private _unBindWindowEvents = () => {
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
    if (this._popup && this._popup.contains(event.target as Node)) {
      return;
    }
    if (this.props.target && this.props.target.contains(event.target as Node))
      return;

    this._onClose();
  }

  private _handleKeyboard = (event: KeyboardEvent): void => {
    if (event.key === "Escape" || event.key === "Enter") {
      this._onClose();
    }
  }

  private _hide = () => {
    this._onClose();
  }

  private _onShow() {
    this._bindWindowEvents();

    const position = this._toggleRelativePosition();
    const point = this._fitPopup(this._getPosition(position));
    this.setState({ left: point.x, top: point.y, isOpen: true, position }, () => {
      if (this.props.onOpen)
        this.props.onOpen();
    });
  }

  private _onClose() {
    if (!this.state.isOpen) {
      return;
    }

    this._unBindWindowEvents();

    this.setState({ isOpen: false }, () => {
      if (this.props.onClose)
        this.props.onClose();
    });
  }

  private _isPositionAbsolute(): boolean {
    return (this.props.top !== -1 && this.props.left !== -1);
  }

  private _getClassNameByPosition(position: Position): string {
    if (!this._isPositionAbsolute()) {
      switch (position) {
        case Position.TopLeft:
          return "popup-top-left";
        case Position.TopRight:
          return "popup-top-right";
        case Position.BottomLeft:
          return "popup-bottom-left";
        case Position.BottomRight:
          return "popup-bottom-right";
        case Position.Top:
          return "popup-top";
        case Position.Left:
          return "popup-left";
        case Position.Right:
          return "popup-right";
        case Position.Bottom:
          return "popup-bottom";
      }
    }

    return "";
  }

  private _getPopupDimensions(): { popupWidth: number, popupHeight: number } {

    let popupWidth = 0;
    let popupHeight = 0;

    if (this._popup) {
      const popupRect = this._popup.getBoundingClientRect();
      switch (this.props.position) {
        case Position.Top:
        case Position.Bottom:
          popupWidth = popupRect.width;
          popupHeight = popupRect.height * 2;
          break;
        case Position.TopLeft:
        case Position.BottomLeft:
          popupWidth = popupRect.width * 2;
          popupHeight = popupRect.height * 2;
          break;
        case Position.TopRight:
        case Position.BottomRight:
          popupWidth = popupRect.width * 2;
          popupHeight = popupRect.height * 2;
          break;
        case Position.Left:
        case Position.Right:
          popupWidth = popupRect.width * 2;
          popupHeight = popupRect.height;
          break;
      }
    }

    return { popupWidth, popupHeight };
  }

  private _getPosition = (position: Position) => {
    const { target, offset, top, left } = this.props;

    const offsetArrow = (this.props.showArrow) ? 6 : 0;

    // absolute position
    if (this._isPositionAbsolute())
      return { x: left, y: top };

    // sanity check
    const point = { x: 0, y: 0 };
    if (!this._popup || !target)
      return point;

    // relative position
    const scrollY = (window.scrollY !== undefined) ? window.scrollY : window.pageYOffset;
    const scrollX = (window.scrollX !== undefined) ? window.scrollX : window.pageXOffset;

    // const popupRect = this._popup.getBoundingClientRect();
    const targetRect = target!.getBoundingClientRect();

    const { popupWidth, popupHeight } = this._getPopupDimensions();

    switch (position) {
      case Position.Top:
        point.y = scrollY + targetRect.top - popupHeight - offset - offsetArrow;
        point.x = scrollX + targetRect.left + (targetRect.width / 2) - (popupWidth / 2);
        break;

      case Position.TopLeft:
        point.y = scrollY + targetRect.top - popupHeight - offset - offsetArrow;
        point.x = scrollX + targetRect.left;
        break;

      case Position.TopRight:
        point.y = scrollY + targetRect.top - popupHeight - offset - offsetArrow;
        point.x = scrollX + targetRect.right - popupWidth;
        break;

      case Position.Bottom:
        point.y = scrollY + targetRect.bottom + offset + offsetArrow;
        point.x = scrollX + targetRect.left + (targetRect.width / 2) - (popupWidth / 2);
        break;

      case Position.BottomLeft:
        point.y = scrollY + targetRect.bottom + offset + offsetArrow;
        point.x = scrollX + targetRect.left;
        break;

      case Position.BottomRight:
        point.y = scrollY + targetRect.bottom + offset + offsetArrow;
        point.x = scrollX + targetRect.right - popupWidth;
        break;

      case Position.Left:
        point.y = scrollY + targetRect.top + (targetRect.height / 2) - (popupHeight / 2);
        point.x = scrollX + targetRect.left - popupWidth - offset - offsetArrow;
        break;

      case Position.Right:
        point.y = scrollY + targetRect.top + (targetRect.height / 2) - (popupHeight / 2);
        point.x = scrollX + targetRect.right + offset + offsetArrow;
        break;

      default:
        break;
    }

    return point;
  }

  private _toggleRelativePosition(): Position {
    const { target, position, offset } = this.props;

    if (!this._popup || !target)
      return position;

    if (this._isPositionAbsolute())
      return position;

    let newPosition = position;

    interface Rect {
      left: number;
      top: number;
      right: number;
      bottom: number;
    }

    // Note: Cannot use DOMRect yet since it's experimental and not available in all browsers (Nov. 2018)
    const viewportRect: Rect = { left: window.scrollX, top: window.scrollY, right: window.scrollX + window.innerWidth, bottom: window.scrollY + window.innerHeight };
    const targetRect = target.getBoundingClientRect();
    const { popupWidth, popupHeight } = this._getPopupDimensions();
    const containerStyle = window.getComputedStyle(target);
    const offsetArrow = (this.props.showArrow) ? 10 : 2;

    const bottomMargin = containerStyle.marginBottom ? parseFloat(containerStyle.marginBottom) : 0;
    if ((targetRect.bottom + popupHeight + bottomMargin + offsetArrow + offset) > viewportRect.bottom) {
      if (newPosition === Position.Bottom) newPosition = Position.Top;
      else if (newPosition === Position.BottomLeft) newPosition = Position.TopLeft;
      else if (newPosition === Position.BottomRight) newPosition = Position.TopRight;
    }

    const topMargin = containerStyle.marginTop ? parseFloat(containerStyle.marginTop) : 0;
    if ((targetRect.top - popupHeight - topMargin - offsetArrow - offset) < viewportRect.top) {
      if (newPosition === Position.Top) newPosition = Position.Bottom;
      else if (newPosition === Position.TopLeft) newPosition = Position.BottomLeft;
      else if (newPosition === Position.TopRight) newPosition = Position.BottomRight;
    }

    const leftMargin = containerStyle.marginLeft ? parseFloat(containerStyle.marginLeft) : 0;
    if ((targetRect.left - popupWidth - leftMargin - offsetArrow - offset) < viewportRect.left) {
      if (newPosition === Position.Left) newPosition = Position.Right;
    }

    const rightMargin = containerStyle.marginRight ? parseFloat(containerStyle.marginRight) : 0;
    if ((targetRect.right + popupWidth + rightMargin + offsetArrow + offset) > viewportRect.right) {
      if (newPosition === Position.Right) newPosition = Position.Left;
    }

    return newPosition;
  }

  // fit the popup within the extents of the view port
  private _fitPopup = (point: Point) => {
    const fittedPoint = point;

    if (!this._popup) {
      return fittedPoint;
    }

    // const popupRect = this._popup.getBoundingClientRect();
    const { popupWidth, popupHeight } = this._getPopupDimensions();
    const { innerWidth, innerHeight } = window;

    if (fittedPoint.y + popupHeight > innerHeight) {
      fittedPoint.y = innerHeight - popupHeight;
    }

    if (fittedPoint.x + popupWidth > innerWidth) {
      fittedPoint.x = innerWidth - popupWidth;
    }

    if (fittedPoint.y < 0) {
      fittedPoint.y = 0;
    }

    if (fittedPoint.x < 0) {
      fittedPoint.x = 0;
    }

    return fittedPoint;
  }

  public render() {
    const className = classnames(
      "popup",
      this._getClassNameByPosition(this.state.position),
      this.props.showShadow && "popup-shadow",
      this.props.showArrow && "arrow",
      this.props.className,
    );

    if (!this.props.isOpen) {
      return null;
    }

    return ReactDOM.createPortal(
      (
        <div className={className} data-testid="popup" style={{ top: this.state.top, left: this.state.left }} ref={(element) => { this._popup = element; }}>
          {this.props.children}
        </div>
      ), document.body);
  }
}

export default Popup;
