/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as ReactDOM from "react-dom";
import * as classnames from "classnames";
import { CommonProps } from "@bentley/ui-core";
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
  position: Position; // direction to which the popup is expanded
  onClose?: () => void; // called to close the popup (click outside)
}

interface PopupState {
  isShown: boolean;
}

/** Popup component */
export class Popup extends React.Component<PopupProps, PopupState> {
  private _ref: HTMLElement | undefined;
  private _targetRef: HTMLElement | null = null; // target element owning the popup

  constructor(props: PopupProps, context?: any) {
    super(props, context);

    this.state = { isShown: this.props.isShown! };
  }

  public static defaultProps: Partial<PopupProps> = {
    position: Position.Bottom,
    showShadow: true,
    showOverlay: false,
    showArrow: false,
  };

  public componentDidUpdate() {
    const node = ReactDOM.findDOMNode(this) as Element;
    if (node && node.parentElement) {
      this._targetRef = node.parentElement;
    }

    if (this.props.isShown) {
      this._onShow();
    } else {
      this._onClose();
    }
  }

  private _onBodyClick = (event: any): void => {
    // Ignore clicks on the popover or button
    if (this._targetRef === event.target) {
      return;
    }

    if (this._targetRef && this._targetRef.contains(event.target)) {
      return;
    }

    if (this._ref && (this._ref === event.target || this._ref.contains(event.target))) {
      return;
    }

    this._onClose();
  }

  public setRef = (element: HTMLDivElement) => {
    this._ref = element;
  }

  private _onShow () {
    if (this.state.isShown)
      return;

    document.body.addEventListener("click", this._onBodyClick, false);

    this.setState({ isShown: true });
  }

  private _onClose () {
    if (!this.state.isShown)
      return;

    document.body.removeEventListener("click", this._onBodyClick, false);

    this.setState({ isShown: false }, () => {
      if (this.props.onClose)
        this.props.onClose();
    });
  }

  private getPositionClassName(): string {
    switch (this.props.position!) {
      case Position.TopLeft:
        return classnames ("popup-top-left");
      case Position.TopRight:
        return classnames ("popup-top-right");
      case Position.BottomLeft:
        return classnames ("popup-bottom-left");
      case Position.BottomRight:
        return classnames ("popup-bottom-right");
      case Position.Top:
        return classnames ("popup-top");
      case Position.Left:
        return classnames ("popup-left");
      case Position.Right:
        return classnames ("popup-right");
      default:
        return classnames ("popup-bottom");
    }
  }

  public render(): JSX.Element {
    const className = classnames (
      "popup",
      this.getPositionClassName(),
      this.props.showShadow && !this.props.showArrow && "popup-shadow",
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
