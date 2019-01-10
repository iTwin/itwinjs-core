/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Toolbar */

import * as classnames from "classnames";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { CommonProps } from "../../utilities/Props";
import { ToolbarItem, ToolbarItemProps } from "../Toolbar";
import "./Icon.scss";

/** Properties of [[Item]] component */
export interface ItemProps extends CommonProps {
  /** button icon. */
  icon?: React.ReactNode;
  /** Describes if item is active. */
  isActive?: boolean;
  /** Describes if the item is disabled. */
  isDisabled?: boolean;
  /** Function called when the item is clicked. */
  onClick?: () => void;
  /** Title for the item. */
  title?: string;
}

/** Toolbar item component. Used in [[Toolbar]] */
class ItemComponent extends React.PureComponent<ItemProps> implements ToolbarItem {
  public readonly panel = document.createElement("div");
  public readonly history = document.createElement("div");

  public render() {
    const className = classnames(
      "nz-toolbar-item-icon",
      this.props.isActive && "nz-is-active",
      this.props.isDisabled && "nz-is-disabled",
      this.props.className);

    const panel = ReactDOM.createPortal(<div className="nz-panel"></div>, this.panel);
    const history = ReactDOM.createPortal(<div className="nz-history"></div>, this.history);
    return (
      <button
        disabled={this.props.isDisabled}  // this is needed to prevent focusing/keyboard access to disabled buttons
        onClick={this._handleClick}
        className={className}
        style={this.props.style}
        title={this.props.title}
      >
        <div className="nz-icon">
          {this.props.icon}
        </div>
        {panel}
        {history}
      </button>
    );
  }

  private _handleClick = () => {
    if (this.props.isDisabled)
      return;

    this.props.onClick && this.props.onClick();
  }
}

export class Item extends React.PureComponent<ItemProps> {
  public render() {
    const toolbarItemProps = this.props as ToolbarItemProps<ItemComponent>;
    return (
      <ItemComponent
        {...this.props}
        ref={toolbarItemProps.toolbarItemRef}
      />
    );
  }
}
