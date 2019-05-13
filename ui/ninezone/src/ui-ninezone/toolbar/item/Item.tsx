/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Toolbar */

import * as classnames from "classnames";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { CommonProps } from "@bentley/ui-core";
import { ToolbarItem, ToolbarItemProps } from "../Toolbar";
import "./Item.scss";

/** Properties of [[Item]] component.
 * @beta
 */
export interface ItemProps extends CommonProps {
  /** button icon. */
  icon?: React.ReactNode;
  /** Describes if item is active. */
  isActive?: boolean;
  /** Describes if the item is disabled. */
  isDisabled?: boolean;
  /** Function called when the item is clicked. */
  onClick?: () => void;
  /** Function called when a key is pressed. */
  onKeyDown?: (e: React.KeyboardEvent) => void;
  /** Title for the item. */
  title?: string;
}

class ActualItem extends React.PureComponent<ItemProps> implements ToolbarItem {
  public readonly panel = document.createElement("div");
  public readonly history = document.createElement("div");

  public render() {
    const className = classnames(
      "nz-toolbar-item-item",
      this.props.isActive && "nz-active",
      this.props.isDisabled && "nz-disabled",
      this.props.className);

    const panel = ReactDOM.createPortal(<div className="nz-panel"></div>, this.panel);
    const history = ReactDOM.createPortal(<div className="nz-history"></div>, this.history);
    return (
      <button
        disabled={this.props.isDisabled}  // this is needed to prevent focusing/keyboard access to disabled buttons
        onClick={this.props.onClick}
        onKeyDown={this.props.onKeyDown}
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
}

/** Toolbar item component. Used in [[Toolbar]] component.
 * @beta
 */
export class Item extends React.PureComponent<ItemProps> {
  public render() {
    const toolbarItemProps = this.props as ToolbarItemProps<ActualItem>;
    return (
      <ActualItem
        {...this.props}
        ref={toolbarItemProps.toolbarItemRef}
      />
    );
  }
}
