/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module SplitButton */

import * as React from "react";
import * as classnames from "classnames";

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
  label: string;
  /** Listens for click events on button area */
  onClick?: (event: any) => any;
  className?: string;
  /** specifies icon for Splitbutton component */
  icon?: string;
}

export interface SplitButtonState {
  expanded: boolean;
}

/**
 * SplitButton with a button on the left and a context menu on the right.
 */
export class SplitButton extends React.Component<SplitButtonProps, SplitButtonState> {
  private _arrowElement: HTMLElement | null = null;
  private _menu: ContextMenu | null = null;
  private closing: boolean = false;

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
        <div className={"split-button-arrow"} ref={(el) => { this._arrowElement = el; }} onClick={this.handleClick} tabIndex={0} onKeyUp={this.handleKeyUp}>
          <div className={classnames("split-button-arrow-icon", "icon", "icon-chevron-down")} >
          </div>
          <ContextMenu
            ref={(el) => { this._menu = el; }}
            selected={0}
            onSelect={this.handleClose}
            onBlur={this.handleClose}
            onEsc={this.handleClose}
            opened={this.state.expanded}
            autoflip={false}>
            {this.props.children}
          </ContextMenu>
        </div>
      </div>
    );
  }

  private handleKeyUp = (event: any) => {
    if ((event.keyCode === 13 /*<Return>*/ || event.keyCode === 40 /*<Down>*/) && !this.state.expanded) {
      this.closing = false;
      this.open();
    }
  }

  private open = () => {
    if (!this.state.expanded && !this.closing) {
      this.setState({ expanded: true }, () => {
        if (this._menu && this.state.expanded)
          this._menu.focus();
      });
    } else {
      this.closing = false;
    }
  }

  private handleClick = (event: any) => {
    if (this.state.expanded) {
      event.stopPropagation();
      this.setState({ expanded: false });
    } else {
      this.open();
    }
  }

  private handleClose = (event: any) => {
    if (this._arrowElement) {
      if (this.state.expanded && "target" in event && this._arrowElement.contains(event.target))
        this.closing = true;
      this.setState((_prevState) => ({ expanded: false }));
      this._arrowElement.focus();
    }
  }
}

export default SplitButton;
