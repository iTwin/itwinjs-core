/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as ReactDOM from "react-dom";
import * as classnames from "classnames";
import Timer from "../utils/Timer";
import { CommonProps } from "../Props";
import "./Popup.scss";

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

export interface PopupProps extends CommonProps {
  showShadow: boolean; // show or hide the box shadow
  showOverlay: boolean; // show or hide the overlay
  showArrow: boolean; // show or hide the arrow
  isShown: boolean; // indicate if the popup is shown or not
  showOnHover: boolean;
  showTime: number;
  hideTime: number;
  position: Position; // direction to which the popup is expanded
  context: HTMLElement | null;
  onOpen?: () => void; // called when the Popover opens.
  onClose?: () => void; // called when the Popover closes.
}

interface PopupState {
  isShown: boolean;
  position: Position;
}

/** Popup component */
export class Popup extends React.Component<PopupProps, PopupState> {
  private _ref: HTMLElement | undefined;
  private _targetRef: HTMLElement | null = null; // target element owning the popup
  private _hoverTimer = new Timer(300);

  constructor(props: PopupProps, context?: any) {
    super(props, context);

    this.state = { isShown: this.props.isShown, position: this.props.position };
  }

  public static defaultProps: Partial<PopupProps> = {
    position: Position.Bottom,
    showShadow: true,
    showOverlay: false,
    showArrow: false,
    showOnHover: false,
    showTime: 300,
    hideTime: 300,
  };

  public componentDidMount() {
    const node = ReactDOM.findDOMNode(this) as Element;
    if (node && node.parentElement) {
      this._targetRef = node.parentElement;
      this._targetRef.onmouseenter = this._onMouseEnter;
      this._targetRef.onmouseleave = this._onMouseLeave;
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
    document.body.addEventListener("keydown", this._onEsc, false);
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

  private _onBodyClick = (event: any): void => {

    const context = this._getContext();

    // Ignore clicks on the popover or button
    if (context === event.target) {
      return;
    }

    if (context && context.contains(event.target)) {
      return;
    }

    if (this._ref && (this._ref === event.target || this._ref.contains(event.target))) {
      return;
    }

    // alert ("body click");
    this._onClose();
  }

  private _onEsc = (event: any): void => {
    // Esc key
    if (event.keyCode === 27) {
      this._onClose();
    }
  }

  private _onShow() {
    if (this.state.isShown && !this.props.showOnHover) {
      return;
    }

    document.body.addEventListener("click", this._onBodyClick, false);
    document.body.addEventListener("keydown", this._onEsc, false);

    const newPosition = this.withinViewport();
    this.setState((_prevState) => ({ position: newPosition, isShown: true }), () => {
      if (this.props.onOpen)
        this.props.onOpen();
    });
  }

  private _onClose() {
    if (!this.state.isShown) {
      return;
    }

    document.body.removeEventListener("click", this._onBodyClick, false);
    document.body.removeEventListener("keydown", this._onEsc, false);

    this.setState((_prevState) => ({ isShown: false, position: this.props.position }), () => {
      if (this.props.onClose)
        this.props.onClose();
    });
  }

  public setRef = (element: HTMLDivElement) => {
    this._ref = element;
  }

  private _getContext = () => this.props.context || this._targetRef;

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

  private withinViewport(): Position {
    const node = ReactDOM.findDOMNode(this) as Element;
    if (node && this._targetRef) {
      const viewportRect = new DOMRect(window.scrollX, window.scrollY, window.scrollX + window.innerWidth, window.scrollY + window.innerHeight);
      const targetRect = this._targetRef!.getBoundingClientRect();
      const popupRect = node.getBoundingClientRect();
      const containerStyle = window.getComputedStyle(this._targetRef!);
      const offset = (this.props.showArrow) ? 12 : 4;

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

    // const overlayClassName = classnames("popup-overlay", this.props.showOverlay && "show");
    return (
      <div className={className} ref={this.setRef}>
        {this.props.children}
      </div>
    );
  }
}

// <div className={overlayClassName}/>

export default Popup;
