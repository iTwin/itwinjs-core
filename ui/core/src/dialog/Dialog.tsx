/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
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

/** interface for a given button in a button cluster */
export interface ButtonCluster {
  /** type of button */
  type: ButtonType;
  /** Triggered on button click */
  onClick: () => void;
  /** Which bwc button style to decorate button width */
  buttonStyle?: ButtonStyle;
}

/** Property interface for Dialog */
export interface DialogProps {
  /** whether to show dialog or not */
  opened: boolean;
  /** Title to show in titlebar of dialog  */
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
  /** Custom CSS Style for dialog content area */
  style?: React.CSSProperties;
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

    const footer = this.props.footer || (<div className={"dialog-buttons"}>{buttons}</div>);

    return (
      <div className={classnames(
        "dialog",
        {
          "dialog-open": this.props.opened,
          "dialog-hidden": !this.props.modal,
        },
        )} style={this.props.backgroundStyle}>
        <div
          className={"dialog-container"}
          ref={(el) => { this._containerElement = el; }}
          style={containerStyle}
        >
          <div className={"dialog-area"}>
            <div className={classnames(
              "dialog-head",
              { "dialog-movable": this.props.movable })}
              onMouseDown={this.handleStartMove}>
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
              {footer}
            </div>
          </div>
          <div
            className={classnames("dialog-drag", "dialog-drag-right", { "dialog-drag-enabled": this.props.resizable })}
            onTouchStart={this.handleStartResizeRight}
            onMouseDown={this.handleStartResizeRight}></div>
          <div
            className={classnames("dialog-drag", "dialog-drag-bottom-mid", { "dialog-drag-enabled": this.props.resizable })}
            onTouchStart={this.handleStartResizeDown}
            onMouseDown={this.handleStartResizeDown}></div>
          <div
            className={classnames("dialog-drag", "dialog-drag-bottom-right", { "dialog-drag-enabled": this.props.resizable })}
            onTouchStart={this.handleStartResizeDownRight}
            onMouseDown={this.handleStartResizeDownRight}></div>
        </div>
      </div>
      );
  }

  public componentDidMount(): void {
    this.setInitial();
    window.addEventListener("mouseup", this.handleMouseUp);
    window.addEventListener("touchend", this.handleMouseUp);

    window.addEventListener("mousemove", this.handleMouseMove);
    window.addEventListener("touchmove", this.handleMouseMove);

    window.addEventListener("keyup", this.handleKeyUp);
  }

  public componentWillUnmount(): void {
    window.removeEventListener("mouseup", this.handleMouseUp);
    window.removeEventListener("touchend", this.handleMouseUp);

    window.removeEventListener("mousemove", this.handleMouseMove);
    window.removeEventListener("touchmove", this.handleMouseMove);

    window.addEventListener("keyup", this.handleKeyUp);
  }

  private handleKeyUp = (event: any) => {
    if (event.keyCode === 27 && this.props.opened && this.props.onEscape) {
      this.props.onEscape();
    }
  }

  private setInitial = () => {
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

  private handleStartResizeRight = (event: any): void => {
    event.preventDefault();
    this.setState((_prevState) => ({
      rightResizing: true,
    }));
  }

  private handleStartResizeDown = (event: any): void => {
    event.preventDefault();
    this.setState((_prevState) => ({
      downResizing: true,
    }));
  }

  private handleStartResizeDownRight = (event: any): void => {
    event.preventDefault();
    this.setState((_prevState) => ({
      downResizing: true,
      rightResizing: true,
    }));
  }

  private handleStartMove = (event: any): void => {
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

  private handleMouseMove = (event: any): void => {
    if (this.state) {
      let { x, y, width, height } = this.state;
      if (this.props.resizable) {
        if (this.state.rightResizing) {
          const centerX = event.clientX;
          width = Math.max(this.props.movable ? (centerX - this.state.x) : ((centerX - window.innerWidth / 2) * 2), this.props.minWidth || 400);
        }
        if (this.state.downResizing) {
          const centerY = event.clientY;
          height = Math.max(centerY - (this.props.movable ? this.state.y : 100), this.props.minHeight || 400);
        }

      }
      if (this.props.movable && this.state.moving) {
        x = event.clientX - this.state.grabOffsetX;
        y = event.clientY - this.state.grabOffsetY;
      }
      this.setState((_prevState) => ({ x, y, width, height }));
    }
  }

  private handleMouseUp = (_event: any): void => {
    this.setState((_prevState) => ({
      rightResizing: false,
      downResizing: false,
      moving: false,
      grabOffsetX: 0,
      grabOffsetY: 0,
    }));
  }
}

export default Dialog;
