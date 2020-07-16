/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module SplitButton
 */

import "./SplitButton.scss";
import classnames from "classnames";
import * as React from "react";
import { ContextMenu } from "../contextmenu/ContextMenu";
import { Icon, IconSpec } from "../icons/IconComponent";
import { CommonProps } from "../utils/Props";

// TODO: implement
/** @internal */
export enum SplitButtonActionType {
  ContextMenu,
  List,
}

/** Properties for [[SplitButton]] component
 * @public
 */
export interface SplitButtonProps extends CommonProps {
  /** Label to display in click area. */
  label: string | React.ReactNode;
  /** Listens for click events on button area */
  onClick?: (event: any) => any;
  /** Listens for execute on button area */
  onExecute?: () => any;
  /** Specifies icon for Splitbutton component */
  icon?: IconSpec;
  /** Indicates whether to draw a border around the button */
  drawBorder?: boolean;
  /** ToolTip text */
  toolTip?: string;
}

/** @internal */
interface SplitButtonState {
  expanded: boolean;
}

/**
 * SplitButton with an action button on the left and an arrow button that displays a context menu on the right.
 * @public
 */
export class SplitButton extends React.Component<SplitButtonProps, SplitButtonState> {
  private _arrowElement = React.createRef<HTMLDivElement>();
  private _buttonRef = React.createRef<HTMLDivElement>();
  private _menu: ContextMenu | null = null;
  private _closing: boolean = false;

  /** @internal */
  public readonly state: Readonly<SplitButtonState> = { expanded: false };

  constructor(props: SplitButtonProps) {
    super(props);
  }

  public render(): JSX.Element {
    let icon = (<></>);
    if (this.props.icon !== undefined) {
      icon = (
        <Icon iconSpec={this.props.icon} />
      );
    }

    const classNames = classnames(
      "core-split-button",
      this.props.className,
      this.state.expanded && "core-expanded",
      this.props.drawBorder && "core-split-button-border");

    return (
      <div data-testid="core-split-button-root" title={this.props.toolTip}
        className={classNames}
        style={this.props.style}
        tabIndex={0}
        onKeyUp={this._handleKeyUp}
        ref={this._buttonRef}
      >
        <div data-testid="core-split-button-label" onClick={this.props.onClick} className={"core-split-button-label"}>{icon} {this.props.label}</div>
        <div className={classnames("core-split-button-divider", this.props.drawBorder && "core-split-button-border")} />
        <div className={"core-split-button-arrow"} ref={this._arrowElement} onClick={this._handleArrowClick}>
          <div className={classnames("core-split-button-arrow-icon", "icon", "icon-chevron-down")} />
          <ContextMenu
            ref={(el) => { this._menu = el; }}
            selectedIndex={0}
            onSelect={this._handleClose}
            onOutsideClick={this._handleClose}
            onEsc={this._handleClose}
            opened={this.state.expanded}
            autoflip={false}>
            {this.props.children}
          </ContextMenu>
        </div>
      </div>
    );
  }

  private _handleKeyUp = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      this.props.onExecute && this.props.onExecute();
    } else if (event.key === "ArrowDown" && !this.state.expanded) {
      this._closing = false;
      this._open();
    } else {
      this._closing = false;
    }
  }

  private _open = () => {
    // istanbul ignore else
    if (!this.state.expanded && !this._closing) {
      this.setState(
        { expanded: true },
        () => {
          // istanbul ignore else
          if (this._menu && this.state.expanded)
            this._menu.focus();
        });
    } else {
      this._closing = false;
    }
  }

  private _handleArrowClick = (event: React.MouseEvent) => {
    if (this.state.expanded) {
      event.stopPropagation();
      this.setState({ expanded: false });
      this._closing = false;
    } else {
      this._open();
    }
  }

  private _handleClose = (event: any) => {
    // istanbul ignore else
    if (this._arrowElement.current && this._buttonRef.current) {
      // istanbul ignore next
      if (this.state.expanded && "target" in event && this._arrowElement.current.contains(event.target))
        this._closing = true;
      this.setState((_prevState) => ({ expanded: false }));
      this._buttonRef.current.focus();
    }
  }
}
