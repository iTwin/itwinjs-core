/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Popup */

import * as React from "react";
import * as classnames from "classnames";

import Timer from "../utils/Timer";
import { CommonProps } from "../utils/Props";
import "./Popup.scss";

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
  isShown: boolean;
  /** show the popup when hovered over the target */
  showOnHover: boolean;
  /** time hovered over target to show the popup */
  showTime: number;
  /** time away from target to hide the popup */
  hideTime: number;
  /** Direction (relative to the target) to which the popup is expanded */
  position: Position;
  /** Fixed position in the viewport */
  fixedPosition?: { top: number, left: number };
  /** target element */
  context: HTMLElement | null;
  /** Function called when the popup is opened */
  onOpen?: () => void;
  /** Function called when the popup is closed */
  onClose?: () => void;
}

interface PopupState {
  isShown: boolean;
  position: Position;
}

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Popup React component */
export class Popup extends React.Component<PopupProps, PopupState> {
  private _popupRef = React.createRef<HTMLDivElement>();
  private _targetElement?: HTMLElement; // target element owning the popup
  private _targetElementOnMouseEnter: ((this: GlobalEventHandlers, ev: MouseEvent) => void) | null = null;
  private _targetElementOnMouseLeave: ((this: GlobalEventHandlers, ev: MouseEvent) => void) | null = null;

  private _hoverTimer: Timer;

  constructor(props: PopupProps, context?: any) {
    super(props, context);

    this.state = { isShown: this.props.isShown, position: this.props.position };
    this._hoverTimer = new Timer(this.props.showTime);
  }

  public static defaultProps: Partial<PopupProps> = {
    position: Position.Bottom,
    showShadow: true,
    showArrow: false,
    showOnHover: false,
    showTime: 300,
    hideTime: 300,
  };

  public componentDidMount() {
    const popupElement = this._popupRef.current;
    if (popupElement && popupElement.parentElement) {
      this._targetElement = popupElement.parentElement;
      this._targetElementOnMouseEnter = this._targetElement.onmouseenter;
      this._targetElementOnMouseLeave = this._targetElement.onmouseleave;
      this._targetElement.onmouseenter = this._onMouseEnter;
      this._targetElement.onmouseleave = this._onMouseLeave;
    }

    this._hoverTimer.delay = this.props.showTime;
  }

  public componentDidUpdate(previousProps: PopupProps) {
    if (this.props.isShown === previousProps.isShown)
      return;

    this._hoverTimer.delay = this.props.showTime;

    if (this.props.isShown) {
      this._onShow();
    } else {
      this._onClose();
    }
  }

  public componentWillUnmount() {
    this._hoverTimer.stop();
    document.body.removeEventListener("click", this._onBodyClick, false);
    document.body.removeEventListener("keydown", this._onEsc, false);

    if (this._targetElement) {
      this._targetElement.onmouseenter = this._targetElementOnMouseEnter;
      this._targetElement.onmouseleave = this._targetElementOnMouseLeave;
    }
  }

  private _onMouseEnter = () => {
    if (!this.props.showOnHover)
      return;

    this._hoverTimer.setOnExecute(() => { this._onShow(); });
    this._hoverTimer.start();
  }

  private _onMouseLeave = () => {
    if (!this.props.showOnHover)
      return;

    this._hoverTimer.stop();
    this._onClose();
  }

  private _onBodyClick = (event: MouseEvent): void => {

    const context = this._getContext();

    // Ignore clicks on the popover or button
    if (context === event.target) {
      return;
    }

    if (context && context.contains(event.target as Node)) {
      return;
    }

    if (this._popupRef.current && (this._popupRef.current === event.target || this._popupRef.current.contains(event.target as Node))) {
      return;
    }

    this._onClose();
  }

  private _onEsc = (event: KeyboardEvent): void => {
    // Esc key
    if (event.key === "Escape") {
      this._onClose();
    }
  }

  private _onShow() {
    if (this.state.isShown && !this.props.showOnHover) {
      return;
    }

    document.addEventListener("click", this._onBodyClick, true);
    document.addEventListener("keydown", this._onEsc, true);

    const newPosition = this.getPositionWithinViewport();
    this.setState({ position: newPosition, isShown: true }, () => {
      if (this.props.onOpen)
        this.props.onOpen();
    });
  }

  private _onClose() {
    if (!this.state.isShown) {
      return;
    }

    document.removeEventListener("click", this._onBodyClick, true);
    document.removeEventListener("keydown", this._onEsc, true);

    this.setState({ isShown: false, position: this.props.position }, () => {
      if (this.props.onClose)
        this.props.onClose();
    });
  }

  private _getContext = () => this.props.context || this._targetElement;

  private getPositionClassName(position: Position): string {
    switch (position) {
      case Position.TopLeft:
        return classnames("popup-top-left");
      case Position.TopRight:
        return classnames("popup-top-right");
      case Position.BottomLeft:
        return classnames("popup-bottom-left");
      case Position.BottomRight:
        return classnames("popup-bottom-right");
      case Position.Top:
        return classnames("popup-top");
      case Position.Left:
        return classnames("popup-left");
      case Position.Right:
        return classnames("popup-right");
      default:
        return classnames("popup-bottom");
    }
  }

  private getPositionWithinViewport(): Position {
    const popupElement = this._popupRef.current;

    if (!popupElement || !this._targetElement)
      return this.props.position;
    // Note: Cannot use DOMRect yet since it's experimental and not available in all browsers (Nov. 2018)
    const viewportRect: Rect = { left: window.scrollX, top: window.scrollY, right: window.scrollX + window.innerWidth, bottom: window.scrollY + window.innerHeight };
    const targetRect = this._targetElement.getBoundingClientRect();
    const popupRect = popupElement.getBoundingClientRect();
    const containerStyle = window.getComputedStyle(this._targetElement);
    const offset = (this.props.showArrow) ? 10 : 2;

    switch (this.props.position) {
      case Position.BottomRight: {
        const bottomMargin = containerStyle.marginBottom ? parseFloat(containerStyle.marginBottom) : 0;
        if ((targetRect.bottom + popupRect.height + bottomMargin + offset) > viewportRect.bottom) {
          return Position.TopRight;
        }
        break;
      }

      case Position.TopRight: {
        const topMargin = containerStyle.marginTop ? parseFloat(containerStyle.marginTop) : 0;
        if ((targetRect.top - popupRect.height - topMargin - offset) < viewportRect.top) {
          return Position.BottomRight;
        }
        break;
      }

      case Position.TopLeft: {
        const topMargin = containerStyle.marginTop ? parseFloat(containerStyle.marginTop) : 0;
        if ((targetRect.top - popupRect.height - topMargin - offset) < viewportRect.top) {
          return Position.BottomLeft;
        }
        break;
      }

      case Position.BottomLeft: {
        const bottomMargin = containerStyle.marginBottom ? parseFloat(containerStyle.marginBottom) : 0;
        if ((targetRect.bottom + popupRect.height + bottomMargin + offset) > viewportRect.bottom) {
          return Position.TopLeft;
        }
        break;
      }

      case Position.Bottom: {
        const bottomMargin = containerStyle.marginBottom ? parseFloat(containerStyle.marginBottom) : 0;
        if ((targetRect.bottom + popupRect.height + bottomMargin + offset) > viewportRect.bottom) {
          return Position.Top;
        }
        break;
      }

      case Position.Top: {
        const topMargin = containerStyle.marginTop ? parseFloat(containerStyle.marginTop) : 0;
        if ((targetRect.top - popupRect.height - topMargin - offset) < viewportRect.top) {
          return Position.Bottom;
        }
        break;
      }

      case Position.Left: {
        const leftMargin = containerStyle.marginLeft ? parseFloat(containerStyle.marginLeft) : 0;
        if ((targetRect.left - popupRect.width - leftMargin - offset) < viewportRect.left) {
          return Position.Right;
        }
        break;
      }

      case Position.Right: {
        const rightMargin = containerStyle.marginRight ? parseFloat(containerStyle.marginRight) : 0;
        if ((targetRect.right + popupRect.width + rightMargin + offset) > viewportRect.right) {
          return Position.Left;
        }
        break;
      }
    }

    return this.props.position;
  }

  public render(): JSX.Element {
    const className = classnames(
      "popup",
      this.getPositionClassName(this.state.position),
      this.props.showShadow && "popup-shadow",
      this.state.isShown && "visible",
      this.props.showArrow && "arrow",
      this.props.className,
    );

    let style: React.CSSProperties | undefined;
    if (this.props.fixedPosition) {
      style = {
        top: this.props.fixedPosition.top,
        left: this.props.fixedPosition.left,
        position: "fixed",
      };
    }

    return (
      <div style={style} className={className} ref={this._popupRef} data-testid="core-popup">
        {this.props.children}
      </div>
    );
  }
}

export default Popup;
