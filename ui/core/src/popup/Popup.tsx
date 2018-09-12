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
}

/** Popup component */
export class Popup extends React.Component<PopupProps, PopupState> {
  private _ref: HTMLElement | undefined;
  private _targetRef: HTMLElement | null = null; // target element owning the popup
  private _hoverTimer = new Timer(300);
  // private _boundingRect?: ClientRect | DOMRect;

  constructor(props: PopupProps, context?: any) {
    super(props, context);

    this.state = { isShown: this.props.isShown };
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

    // this._boundingRect = this._ref!.getBoundingClientRect();
    // alert("popup rect componentDidMount" + popupRect.top + " " + popupRect.bottom + " " + popupRect.height);
  }

  public componentDidUpdate(previousProps: PopupProps) {
    if (this.props.isShown === previousProps.isShown)
      return;

    this._hoverTimer.delay = this.props.showTime;
    // alert ("componentdidupdate " + this.props.isShown + " " + previousProps.isShown + " " + this.state.isShown + " " + previousState.isShown);
    if (this.props.isShown) {
      this._onShow();
    } else {
      this._onClose();
    }
  }

  public componentWillUnmount() {
    document.body.removeEventListener("click", this._onBodyClick, false);
    document.body.addEventListener("keydown", this._onEsc, false);

    this._hoverTimer.stop();
  }

  private _onMouseEnter = () => {
    if (!this.props.showOnHover)
      return;

    // alert ("on mouse enter");
    this._hoverTimer.setOnExecute(() => { this._onShow(); });
    this._hoverTimer.start();
  }

  private _onMouseLeave = () => {
    if (!this.props.showOnHover)
      return;

    // alert("on mouse leave");
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

    // alert ("onShow called");

    document.body.addEventListener("click", this._onBodyClick, false);
    document.body.addEventListener("keydown", this._onEsc, false);

    this.setState((_prevState) => ({ isShown: true }), () => {
      if (this.props.onOpen)
        this.props.onOpen();
    });
  }

  private _onClose() {
    if (!this.state.isShown) {
      return;
    }

    document.body.removeEventListener("click", this._onBodyClick, false);

    // alert ("onClose called");

    this.setState((_prevState) => ({ isShown: false }), () => {
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

  /* TODO: WORK IN PROGRESS */

  /*
$.fn.isOnScreen = function(){

    var win = $(window);

    var viewport = {
        top : win.scrollTop(),
        left : win.scrollLeft()
    };
    viewport.right = viewport.left + win.width();
    viewport.bottom = viewport.top + win.height();

    var bounds = this.offset();
    bounds.right = bounds.left + this.outerWidth();
    bounds.bottom = bounds.top + this.outerHeight();

    return (!(viewport.right < bounds.left || viewport.left > bounds.right || viewport.bottom < bounds.top || viewport.top > bounds.bottom));

};

  private withinViewport(): Position {
    if (this._boundingRect) {
      const rect = this._boundingRect;
      switch (this.props.position) {
        case Position.BottomRight: {
          if (rect.bottom > window.innerHeight) {
            return Position.TopRight;
          } else if ((rect.right - rect.width) < window.screenLeft) {
            return Position.BottomLeft;
          }
          break;
        }
        case Position.TopRight: {
          if (rect.top < window.screenTop) {
            return Position.BottomRight;
          } else if ((rect.right - rect.width) < window.innerWidth) {
            return Position.TopLeft;
          }
          break;
        }
        case Position.TopLeft: {
          if ((rect.left + rect.height) > window.screenTop) {
            return Position.TopRight;
          } else if ((rect.left + rect.height) > window.screenTop) {
            return Position.TopRight;
          }
          break;
        }
      }
    }

    return this.props.position;
  }
 */

  public render(): JSX.Element {
    // const position = this.withinViewport();
    const position = this.props.position;
    const className = classnames(
      "popup",
      this.getPositionClassName(position),
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
