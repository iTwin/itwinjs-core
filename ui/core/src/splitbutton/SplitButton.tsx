/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module SplitButton */

import * as React from "react";
import classnames from "classnames";

import { ContextMenu } from "../contextmenu/ContextMenu";

import "./SplitButton.scss";

// TODO: implement
/** @hidden */
export enum SplitButtonActionType {
  ContextMenu,
  List,
}

/** Property interface for SplitButton */
export interface SplitButtonProps {
  /** Label to display in click area. */
  label: string | React.ReactNode;
  /** Listens for click events on button area */
  onClick?: (event: any) => any;
  className?: string;
  /** specifies icon for Splitbutton component */
  icon?: string;
}

interface SplitButtonState {
  expanded: boolean;
}

/**
 * SplitButton with a button on the left and a context menu on the right.
 */
export class SplitButton extends React.Component<SplitButtonProps, SplitButtonState> {
  private _arrowElement: HTMLElement | null = null;
  private _menu: ContextMenu | null = null;
  private _closing: boolean = false;

  /** @hidden */
  public readonly state: Readonly<SplitButtonState> = { expanded: false };

  public render(): JSX.Element {
    let icon = (<></>);
    if (this.props.icon !== undefined) {
      icon = (
        <span className={classnames("icon", this.props.icon)} />
      );
    }
    return (
      <div className={classnames("split-button", this.props.className, { expanded: this.state.expanded })}>
        <div onClick={this.props.onClick} className={"split-button-label"}>{icon} {this.props.label}</div>
        <div className={"split-button-arrow"} ref={(el) => { this._arrowElement = el; }} onClick={this._handleClick} tabIndex={0} onKeyUp={this._handleKeyUp}>
          <div className={classnames("split-button-arrow-icon", "icon", "icon-chevron-down")} >
          </div>
          <ContextMenu
            ref={(el) => { this._menu = el; }}
            selected={0}
            onSelect={this._handleClose}
            onBlur={this._handleClose}
            onEsc={this._handleClose}
            opened={this.state.expanded}
            autoflip={false}>
            {this.props.children}
          </ContextMenu>
        </div>
      </div>
    );
  }

  private _handleKeyUp = (event: any) => {
    if ((event.keyCode === 13 /*<Return>*/ || event.keyCode === 40 /*<Down>*/) && !this.state.expanded) {
      this._closing = false;
      this._open();
    }
  }

  private _open = () => {
    if (!this.state.expanded && !this._closing) {
      this.setState({ expanded: true }, () => {
        if (this._menu && this.state.expanded)
          this._menu.focus();
      });
    } else {
      this._closing = false;
    }
  }

  private _handleClick = (event: any) => {
    if (this.state.expanded) {
      event.stopPropagation();
      this.setState({ expanded: false });
    } else {
      this._open();
    }
  }

  private _handleClose = (event: any) => {
    if (this._arrowElement) {
      if (this.state.expanded && "target" in event && this._arrowElement.contains(event.target))
        this._closing = true;
      this.setState((_prevState) => ({ expanded: false }));
      this._arrowElement.focus();
    }
  }
}

export default SplitButton;
