/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Dialog */

import * as React from "react";
import * as classnames from "classnames";

import UiCore from "../UiCore";

import "@bentley/bwc/lib/buttons/classes.scss";
import "./Dialog.scss";

/** Enum for button types. Determines button label, and default button style. */
export enum ButtonType {
  None = "",
  Close = "close",
  OK = "ok",
  Cancel = "cancel",
  Yes = "yes",
  No = "no",
  Retry = "retry",
}

/** Enum for button style. */
export enum ButtonStyle {
  None = "",
  Primary = "bwc-buttons-primary",
  Hollow = "bwc-buttons-hollow",
  Blue = "bwc-buttons-blue",
}

/** Enum for dialog alignment */
export enum DialogAlignment {
    TopLeft = "top-left", Top = "top", TopRight = "top-right",
    Left = "left", Center = "center", Right = "right",
    BottomLeft = "bottom-left", Bottom = "bottom", BottomRight = "bottom-right",
}

/** interface for a given button in a button cluster */
export interface ButtonCluster {
  /** type of button */
  type: ButtonType;
  /** Triggered on button click */
  onClick: () => void;
  /** Which bwc button style to decorate button width */
  buttonStyle?: ButtonStyle;
}
type Omit<T, K> = Pick<T, Exclude<keyof T, K>>;
/** Property interface for Dialog */
export interface DialogProps extends Omit<React.AllHTMLAttributes<HTMLDivElement>, "title"> {
  /** whether to show dialog or not */
  opened: boolean;
  /** Default alignment of dialog. Default: DialogAlignment.Center */
  alignment?: DialogAlignment;
  /** Title to show in titlebar of dialog */
  title?: string | JSX.Element;
  /** Footer to show at bottom of dialog. Note: will override buttonCluster */
  footer?: string | JSX.Element;
  /** List of ButtonCluster objects specifying buttons and associated onClick events */
  buttonCluster?: ButtonCluster[];
  /** onClick event for X button for dialog */
  onClose?: () => void;
  /** 'keyup' event for <Esc> key */
  onEscape?: () => void;
  /** minimum width that the dialog may be resized to. Default: 400 */
  minWidth?: number;
  /** minimum height that the dialog may be resized to. Default: 400 */
  minHeight?: number;
  /** maximum width that the dialog may be resized to. */
  maxWidth?: number;
  /** maximum height that the dialog may be resized to. */
  maxHeight?: number;
  /** initial width of dialog.
   * Displayed in px if value is a number, otherwise displayed in specified CSS unit.
   * Default: "50%"
   */
  width?: string | number;
  /** initial height of dialog.
   * Displayed in px if value is a number, otherwise displayed in specified CSS unit.
   * Default: ""
   */
  height?: string | number;
  /** Custom CSS Style for overlay */
  backgroundStyle?: React.CSSProperties;
  /** Custom CSS Style for title */
  titleStyle?: React.CSSProperties;
  /** Custom CSS Style for footer */
  footerStyle?: React.CSSProperties;
  /** Whether to show background overlay. Default: true */
  modal?: boolean;
  /** Whether user can resize dialog with cursor. Default: false */
  resizable?: boolean;
  /** Whether user can move dialog with cursor. Default: false */
  movable?: boolean;
}

/** @hidden */
export interface DialogState {
  rightResizing: boolean;
  downResizing: boolean;
  moving: boolean;
  grabOffsetX: number;
  grabOffsetY: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Dialog component with optional resizing and dragging functionality
 */
export class Dialog extends React.Component<DialogProps, DialogState> {
  private _containerElement: HTMLElement | null = null;
  public static defaultProps: Partial<DialogProps> = {
    alignment: DialogAlignment.Center,
    minWidth: 400,
    minHeight: 400,
    width: "50%",
    height: "",
    resizable: false,
    movable: false,
    modal: true,
  };

  /** @hidden */
  public readonly state: Readonly<DialogState> = {
    rightResizing: false,
    downResizing: false,
    moving: false,
    grabOffsetX: 0,
    grabOffsetY: 0,
    x: 0, y: 0,
    width: 0, height: 0,
  };

  public render(): JSX.Element {
    const { opened, title, footer, buttonCluster, onClose, onEscape, minWidth, minHeight, width, height, backgroundStyle, titleStyle, footerStyle, modal, resizable, movable, className, ...props } = this.props;

    const containerStyle: React.CSSProperties = {
      margin: "",
      left: "",
      top: "",
      width: this.props.width,
      height: this.props.height,
    };
    if (this.props.movable) {
      containerStyle.margin = "0";
      containerStyle.left = this.state.x;
      containerStyle.top = this.state.y;
    }

    if (this.props.resizable) {
      containerStyle.width = this.state.width;
      containerStyle.height = this.state.height;
    }

    const buttons: JSX.Element[] = [];
    if (this.props.buttonCluster) {
      this.props.buttonCluster.forEach((button: ButtonCluster, index: number) => {
        let buttonText = "";
        let buttonClass = classnames("dialog-button", button.type ? `dialog-button-${button.type}` : "");

        switch (button.type) {
          case ButtonType.OK:
            buttonText = UiCore.i18n.translate("UiCore:dialog.ok");
            buttonClass = classnames(buttonClass, button.buttonStyle || "bwc-buttons-primary");
            break;
          case ButtonType.Retry:
            buttonText = UiCore.i18n.translate("UiCore:dialog.retry");
            buttonClass = classnames(buttonClass, button.buttonStyle || "bwc-buttons-primary");
            break;
          case ButtonType.Yes:
            buttonText = UiCore.i18n.translate("UiCore:dialog.yes");
            buttonClass = classnames(buttonClass, button.buttonStyle || "bwc-buttons-primary");
            break;
          case ButtonType.No:
            buttonText = UiCore.i18n.translate("UiCore:dialog.no");
            buttonClass = classnames(buttonClass, button.buttonStyle || "bwc-buttons-hollow");
            break;
          case ButtonType.Cancel:
            buttonText = UiCore.i18n.translate("UiCore:dialog.cancel");
            buttonClass = classnames(buttonClass, button.buttonStyle || "bwc-buttons-hollow");
            break;
          case ButtonType.Close:
            buttonText = UiCore.i18n.translate("UiCore:dialog.close");
            buttonClass = classnames(buttonClass, button.buttonStyle || "bwc-buttons-hollow");
            break;
        }

        buttons.push(
          <button className={buttonClass} key={index.toString()} onClick={button.onClick}>{buttonText}</button>);
      });
    }

    const footerElement = footer || (<div className={"dialog-buttons"}>{buttons}</div>);

    return (
      <div {...props} className={classnames(
        "dialog",
        {
          "dialog-open": this.props.opened,
          "dialog-hidden": !this.props.modal,
        },
      )} style={this.props.backgroundStyle}>
        <div
          className={classnames("dialog-container", this.props.alignment)}
          style={containerStyle}
        >
          <div className={"dialog-area"} ref={(el) => { this._containerElement = el; }}>
            <div className={classnames(
              "dialog-head",
              { "dialog-movable": this.props.movable })}
              onMouseDown={this._handleStartMove}>
              <div className={"dialog-title"}>{this.props.title}</div>
              <span
                className={"dialog-close icon icon-close"}
                onClick={this.props.onClose}
              />
            </div>
            <div className={"dialog-content"} style={this.props.style}>
              {this.props.children}
            </div>
            <div className={"dialog-footer"} style={this.props.footerStyle}>
              {footerElement}
            </div>
          </div>
          <div
            className={classnames("dialog-drag", "dialog-drag-right", { "dialog-drag-enabled": this.props.resizable })}
            onTouchStart={this._handleStartResizeRight}
            onMouseDown={this._handleStartResizeRight}></div>
          <div
            className={classnames("dialog-drag", "dialog-drag-bottom-mid", { "dialog-drag-enabled": this.props.resizable })}
            onTouchStart={this._handleStartResizeDown}
            onMouseDown={this._handleStartResizeDown}></div>
          <div
            className={classnames("dialog-drag", "dialog-drag-bottom-right", { "dialog-drag-enabled": this.props.resizable })}
            onTouchStart={this._handleStartResizeDownRight}
            onMouseDown={this._handleStartResizeDownRight}></div>
        </div>
      </div>
    );
  }

  public componentDidMount(): void {
    this._setInitial();
    window.addEventListener("mouseup", this._handleMouseUp);
    window.addEventListener("touchend", this._handleMouseUp);

    window.addEventListener("mousemove", this._handleMouseMove);
    window.addEventListener("touchmove", this._handleMouseMove);

    window.addEventListener("keyup", this._handleKeyUp);
  }

  public componentWillUnmount(): void {
    window.removeEventListener("mouseup", this._handleMouseUp);
    window.removeEventListener("touchend", this._handleMouseUp);

    window.removeEventListener("mousemove", this._handleMouseMove);
    window.removeEventListener("touchmove", this._handleMouseMove);

    window.addEventListener("keyup", this._handleKeyUp);
  }

  private _handleKeyUp = (event: any) => {
    if (event.keyCode === 27 && this.props.opened && this.props.onEscape) {
      this.props.onEscape();
    }
  }

  private _setInitial = () => {
    if (this._containerElement) {
      const rect = this._containerElement.getBoundingClientRect();
      this.setState((_prevState) => ({
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
      }));
    }
  }

  private _handleStartResizeRight = (event: any): void => {
    event.preventDefault();
    this.setState((_prevState) => ({
      rightResizing: true,
    }));
  }

  private _handleStartResizeDown = (event: any): void => {
    event.preventDefault();
    this.setState((_prevState) => ({
      downResizing: true,
    }));
  }

  private _handleStartResizeDownRight = (event: any): void => {
    event.preventDefault();
    this.setState((_prevState) => ({
      downResizing: true,
      rightResizing: true,
    }));
  }

  private _handleStartMove = (event: any): void => {
    event.preventDefault();
    if (this._containerElement) {
      const rect = this._containerElement.getBoundingClientRect();
      const grabOffsetX = event.clientX - rect.left;
      const grabOffsetY = event.clientY - rect.top;
      this.setState && this.setState((_prevState) => ({
        grabOffsetX,
        grabOffsetY,
        moving: true,
      }));
    }
  }

  private _handleMouseMove = (event: any): void => {
    const { minWidth, maxWidth, minHeight, maxHeight, movable } = this.props;
    let { x, y, width, height } = this.state;
    if (this.props.resizable) {
      if (this.state.rightResizing) {
        const centerX = event.clientX;
        width = movable ? (centerX - x) : ((centerX - window.innerWidth / 2) * 2);
        width = Math.max(width, minWidth!);
        if (maxWidth !== undefined)
          width = Math.min(width, maxWidth);
      }
      if (this.state.downResizing) {
        const centerY = event.clientY;
        height = movable ? (centerY - y) : ((centerY - window.innerHeight / 2) * 2);
        height = Math.max(height, minHeight!);
        if (maxHeight !== undefined)
          height = Math.min(height, maxHeight);
      }

    }
    if (movable && this.state.moving) {
      x = event.clientX - this.state.grabOffsetX;
      y = event.clientY - this.state.grabOffsetY;
    }
    this.setState({ x, y, width, height });
  }

  private _handleMouseUp = (_event: any): void => {
    this.setState({
      rightResizing: false,
      downResizing: false,
      moving: false,
      grabOffsetX: 0,
      grabOffsetY: 0,
    });
  }
}

export default Dialog;
