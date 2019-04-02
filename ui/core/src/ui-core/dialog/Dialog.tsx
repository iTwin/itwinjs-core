/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Dialog */

import * as React from "react";
import * as ReactDOM from "react-dom";
import * as classnames from "classnames";
import { withOnOutsideClick } from "../hocs/withOnOutsideClick";

const DivWithOutsideClick = withOnOutsideClick((props) => (<div {...props} />)); // tslint:disable-line:variable-name

import { UiCore } from "../UiCore";

import "./Dialog.scss";
import { Omit } from "../utils/typeUtils";

/** Enum for button types. Determines button label, and default button style.
 * @public
 */
export enum DialogButtonType {
  None = "",
  Close = "close",
  OK = "ok",
  Cancel = "cancel",
  Yes = "yes",
  No = "no",
  Retry = "retry",
}

/** Enum for button style.
 * @public
 */
export enum DialogButtonStyle {
  None = "",
  Primary = "uicore-buttons-primary",
  Hollow = "uicore-buttons-hollow",
  Blue = "uicore-buttons-blue",
}

/** Enum for dialog alignment
 * @public
 */
export enum DialogAlignment {
  TopLeft = "top-left", Top = "top", TopRight = "top-right",
  Left = "left", Center = "center", Right = "right",
  BottomLeft = "bottom-left", Bottom = "bottom", BottomRight = "bottom-right",
}

/** Interface for a given button in a button cluster
 * @public
 */
export interface DialogButton {
  /** type of button */
  type: DialogButtonType;
  /** Triggered on button click */
  onClick: () => void;
  /** Which bwc button style to decorate button width */
  buttonStyle?: DialogButtonStyle;
  /** Disable the button */
  disabled?: boolean;
}

/** Properties for the [[Dialog]] component
 * @public
 */
export interface DialogProps extends Omit<React.AllHTMLAttributes<HTMLDivElement>, "title"> {
  /** whether to show dialog or not */
  opened: boolean;
  /** Default alignment of dialog. Default: DialogAlignment.Center */
  alignment?: DialogAlignment;
  /** Title to show in title bar of dialog */
  title?: string | JSX.Element;
  /** Footer to show at bottom of dialog. Note: will override buttonCluster */
  footer?: string | JSX.Element;
  /** List of DialogButton objects specifying buttons and associated onClick events */
  buttonCluster?: DialogButton[];
  /** onClick event for X button for dialog */
  onClose?: () => void;
  /** 'keyup' event for <Esc> key */
  onEscape?: () => void;
  /** triggered when a click is triggered outside of this dialog. */
  onOutsideClick?: (event: MouseEvent) => any;
  /** minimum width that the dialog may be resized to. Default: 400 */
  minWidth?: number;
  /** minimum height that the dialog may be resized to. Default: 400 */
  minHeight?: number;
  /** maximum width that the dialog may be resized to. */
  maxWidth?: number;
  /** maximum height that the dialog may be resized to. */
  maxHeight?: number;
  /** initial x/left position of dialog. Displayed in px if value is a number, otherwise displayed in specified CSS unit. */
  x?: number;
  /** initial y/top position of dialog. Displayed in px if value is a number, otherwise displayed in specified CSS unit. */
  y?: number;
  /** initial width of dialog. Displayed in px if value is a number, otherwise displayed in specified CSS unit. Default: "50%" */
  width?: string | number;
  /** initial height of dialog. Displayed in px if value is a number, otherwise displayed in specified CSS unit. */
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

/** @internal */
interface DialogState {
  rightResizing: boolean;
  downResizing: boolean;
  moving: boolean;
  grabOffsetX: number;
  grabOffsetY: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

/**
 * Dialog React component with optional resizing and dragging functionality
 * @public
 */
export class Dialog extends React.Component<DialogProps, DialogState> {
  private _containerRef = React.createRef<HTMLDivElement>();
  public static defaultProps: Partial<DialogProps> = {
    alignment: DialogAlignment.Center,
    minWidth: 400,
    minHeight: 400,
    width: "50%",
    resizable: false,
    movable: false,
    modal: true,
  };

  /** @internal */
  public readonly state: Readonly<DialogState>;
  constructor(props: DialogProps) {
    super(props);
    this.state = {
      rightResizing: false,
      downResizing: false,
      moving: false,
      grabOffsetX: 0,
      grabOffsetY: 0,
    };
  }

  public render(): JSX.Element {
    const {
      opened, title, footer, buttonCluster, onClose, onEscape, onOutsideClick,
      minWidth, minHeight, x, y, width, height, maxHeight, maxWidth,
      backgroundStyle, titleStyle, footerStyle,
      modal, resizable, movable, className, alignment, ...props } = this.props;

    const containerStyle: React.CSSProperties = {
      margin: "",
      left: x, top: y,
      width, height,
    };
    if (this.props.movable && (this.state.x !== undefined || this.state.y !== undefined)) {
      // istanbul ignore else
      if (this.state.x !== undefined) {
        containerStyle.marginLeft = "0";
        containerStyle.marginRight = "0";
        containerStyle.left = this.state.x;
      }
      // istanbul ignore else
      if (this.state.y !== undefined) {
        containerStyle.marginTop = "0";
        containerStyle.marginBottom = "0";
        containerStyle.top = this.state.y;
      }
    }

    if (this.props.resizable && (this.state.width !== undefined || this.state.height !== undefined)) {
      if (this.state.width !== undefined)
        containerStyle.width = this.state.width;
      if (this.state.height !== undefined)
        containerStyle.height = this.state.height;
    }

    const buttons = this.getFooterButtons(this.props);

    const footerElement = footer || (<div className={"core-dialog-buttons"}>{buttons}</div>);

    return (
      <div
        className={classnames(
          "core-dialog",
          { "core-dialog-hidden": !modal, opened },
        )}
        style={this.props.backgroundStyle}
        data-testid="core-dialog-root"
        {...props}
      >
        {opened &&
          <DivWithOutsideClick onOutsideClick={this.props.onOutsideClick}>
            <div
              className={classnames("core-dialog-container", alignment)}
              style={containerStyle}
              data-testid="core-dialog-container"
            >
              <div className={"core-dialog-area"} ref={this._containerRef}>
                <div className={classnames(
                  "core-dialog-head",
                  { "core-dialog-movable": this.props.movable })}
                  data-testid="core-dialog-head"
                  onPointerDown={this._handleStartMove}>
                  <div className={"core-dialog-title"}>{this.props.title}</div>
                  <span
                    className={"core-dialog-close icon icon-close"}
                    data-testid="core-dialog-close"
                    onClick={this.props.onClose}
                  />
                </div>
                <div className={"core-dialog-content"} style={this.props.style}>
                  {this.props.children}
                </div>
                <div className={"core-dialog-footer"} style={this.props.footerStyle}>
                  {footerElement}
                </div>
              </div>
              <div
                className={classnames("core-dialog-drag", "core-dialog-drag-right", { "core-dialog-drag-enabled": this.props.resizable })}
                data-testid="core-dialog-drag-right"
                onPointerDown={this._handleStartResizeRight}
              ></div>
              <div
                className={classnames("core-dialog-drag", "core-dialog-drag-bottom-mid", { "core-dialog-drag-enabled": this.props.resizable })}
                data-testid="core-dialog-drag-bottom"
                onPointerDown={this._handleStartResizeDown}
              > </div>
              <div
                className={classnames("core-dialog-drag", "core-dialog-drag-bottom-right", { "core-dialog-drag-enabled": this.props.resizable })}
                data-testid="core-dialog-drag-bottom-right"
                onPointerDown={this._handleStartResizeDownRight}
              ></div>
            </div>
          </DivWithOutsideClick>
        }
      </div>
    );
  }

  private getFooterButtons(props: DialogProps) {
    const buttons: React.ReactNode[] = [];
    if (props.buttonCluster) {
      props.buttonCluster.forEach((button: DialogButton, index: number) => {
        let buttonText = "";
        let buttonClass = classnames("core-dialog-button", `dialog-button-${button.type}`);
        switch (button.type) {
          case DialogButtonType.OK:
            buttonText = UiCore.i18n.translate("UiCore:dialog.ok");
            buttonClass = classnames(buttonClass, button.buttonStyle || "uicore-buttons-primary");
            break;
          case DialogButtonType.Retry:
            buttonText = UiCore.i18n.translate("UiCore:dialog.retry");
            buttonClass = classnames(buttonClass, button.buttonStyle || "uicore-buttons-primary");
            break;
          case DialogButtonType.Yes:
            buttonText = UiCore.i18n.translate("UiCore:dialog.yes");
            buttonClass = classnames(buttonClass, button.buttonStyle || "uicore-buttons-primary");
            break;
          case DialogButtonType.No:
            buttonText = UiCore.i18n.translate("UiCore:dialog.no");
            buttonClass = classnames(buttonClass, button.buttonStyle || "uicore-buttons-hollow");
            break;
          case DialogButtonType.Cancel:
            buttonText = UiCore.i18n.translate("UiCore:dialog.cancel");
            buttonClass = classnames(buttonClass, button.buttonStyle || "uicore-buttons-hollow");
            break;
          case DialogButtonType.Close:
            buttonText = UiCore.i18n.translate("UiCore:dialog.close");
            buttonClass = classnames(buttonClass, button.buttonStyle || "uicore-buttons-hollow");
            break;
        }
        buttons.push(<button className={buttonClass} disabled={button.disabled} key={index.toString()} onClick={button.onClick}>{buttonText}</button>);
      });
    }
    return buttons;
  }

  public componentDidMount(): void {
    window.addEventListener("pointerup", this._handlePointerUp, true);
    window.addEventListener("pointermove", this._handlePointerMove, true);

    document.addEventListener("keyup", this._handleKeyUp, true);
  }

  public componentWillUnmount(): void {
    window.removeEventListener("pointerup", this._handlePointerUp, true);

    window.removeEventListener("pointermove", this._handlePointerMove, true);

    document.removeEventListener("keyup", this._handleKeyUp, true);
  }

  private _handleKeyUp = (event: KeyboardEvent) => {
    if (event.key === "Escape" && this.props.opened && this.props.onEscape) {
      this.props.onEscape();
    }
  }

  private _handleStartResizeRight = (event: React.PointerEvent): void => {
    event.preventDefault();
    this.setState({ rightResizing: true });
  }

  private _handleStartResizeDown = (event: React.PointerEvent): void => {
    event.preventDefault();
    this.setState({ downResizing: true });
  }

  private _handleStartResizeDownRight = (event: React.PointerEvent): void => {
    event.preventDefault();
    this.setState({ downResizing: true, rightResizing: true });
  }

  private _handleStartMove = (event: React.PointerEvent): void => {
    if (!this.props.movable)
      return;

    event.preventDefault();
    // istanbul ignore else
    if (this._containerRef.current) {
      const rect = this._containerRef.current.getBoundingClientRect();
      const grabOffsetX = event.clientX - rect.left;
      const grabOffsetY = event.clientY - rect.top;
      this.setState({
        grabOffsetX,
        grabOffsetY,
        moving: true,
      });
    }
  }

  private _handlePointerMove = (event: PointerEvent): void => {
    if ((!this.props.resizable && !this.props.movable) || !this._containerRef.current)
      return;

    const { minWidth, maxWidth, minHeight, maxHeight, movable } = this.props;
    let { x, y, width, height } = this.state;
    // istanbul ignore else
    if (x === undefined) { // if x is undefined, so is y, width, and height
      const rect = this._containerRef.current.getBoundingClientRect();
      width = rect.width, height = rect.height, x = rect.left, y = rect.top;
    }
    if (this.props.resizable) {
      if (this.state.rightResizing) {
        const centerX = event.clientX;
        width = movable ? (centerX - x) : ((centerX - window.innerWidth / 2) * 2);
        width = Math.max(width, minWidth!);
        if (maxWidth !== undefined)
          width = Math.min(width, maxWidth);
        this.setState({ width });
      }
      if (this.state.downResizing) {
        const centerY = event.clientY;
        height = movable ? (centerY - y!) : ((centerY - window.innerHeight / 2) * 2);
        height = Math.max(height, minHeight!);
        if (maxHeight !== undefined)
          height = Math.min(height, maxHeight);
        this.setState({ height });
      }

    }
    if (movable && this.state.moving) {
      x = event.clientX - this.state.grabOffsetX;
      y = event.clientY - this.state.grabOffsetY;
      this.setState({ x, y });
    }
  }

  private _handlePointerUp = (_event: PointerEvent): void => {
    if (!this.props.movable && !this.props.resizable)
      return;

    this.setState({
      rightResizing: false,
      downResizing: false,
      moving: false,
      grabOffsetX: 0,
      grabOffsetY: 0,
    });
  }
}

/** Properties for the [[GlobalDialog]] component
 * @public
 */
export interface GlobalDialogProps extends DialogProps {
  identifier?: string;
}

/** GlobalDialog React component used to display a [[Dialog]] on the top of screen
 * @public
 */
export class GlobalDialog extends React.Component<GlobalDialogProps> {
  private _container: HTMLDivElement;
  constructor(props: GlobalDialogProps) {
    super(props);
    this._container = document.createElement("div");
    this._container.id = props.identifier !== undefined ? `dialog-${props.identifier}` : "core-dialog";
    let rt = document.getElementById("core-dialog-root") as HTMLDivElement;
    if (!rt) {
      rt = document.createElement("div");
      rt.id = "core-dialog-root";
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
    const { identifier, ...props } = this.props;
    return ReactDOM.createPortal(
      <Dialog {...props} />
      , this._container);
  }
}
