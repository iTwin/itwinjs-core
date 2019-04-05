/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import * as classnames from "classnames";
import { CommonProps } from "@bentley/ui-ninezone";
import { Popup, Position } from "@bentley/ui-core";
import "./ContextMenu.scss";

/** Properties for [[ContextMenuItem]] component */
export interface MenuItem {
  /** Name of the context menu item */
  name?: string;
  /** Optional icon */
  icon?: string;
  /** Disabled */
  disabled?: boolean;
  /** Checked or not */
  checked?: boolean;
  /** Separator */
  isSeparator?: boolean;
  /** Called when the item is clicked */
  onClick?: () => void;
}

/**
 * A context menu item.
 */
export class ContextMenuItem extends React.Component<MenuItem> {

  private _onClick = (event: any) => {
    event.stopPropagation();
    if (!this.props.disabled && !this.props.isSeparator && this.props.onClick) {
      this.props.onClick();
    }
  }

  public render() {
    const menuClassName = classnames (
      "contextmenu-portal-item",
      this.props.disabled && "disabled",
      this.props.checked && "checked",
    );

    return (
      <>
        {this.props.isSeparator && <div className="separator" onClick={this._onClick} />}
        {!this.props.isSeparator &&
          <li className={menuClassName} onClick={this._onClick}>
            {this.props.checked && <span className="icon icon-checkmark" />}
            {(this.props.icon && !this.props.checked) && <span className={classnames("user-icon icon", this.props.icon)} />}
            <span>{this.props.name}</span>
          </li>
        }
      </>
    );
  }
}

/** Properties for [[ContextMenu]] component */
export interface ContextMenuProps extends CommonProps {
  /** Show or hide the context menu */
  isOpened: boolean;
  /** Position the context menu relative to the parent */
  position: Position;
  /** List of context menu items */
  items?: MenuItem[];
  /** Called when the mouse is clicked outside the context menu */
  onClickOutside?: () => void;
  /** parent element */
  parent: HTMLElement | null;
}

export class ContextMenu extends React.Component<ContextMenuProps> {
  public render() {
    const { items, parent, position, isOpened, onClickOutside } = this.props;
    return (
      <Popup isOpen={isOpened} target={parent} position={position} onClose={onClickOutside}>
        <div className="contextmenu-portal">
          <ul>
            {items && items.map((item: MenuItem, index: number) => (
              <ContextMenuItem key={index} name={item.name} icon={item.icon} disabled={item.disabled} onClick={item.onClick} isSeparator={item.isSeparator} />
              ))
            }
            {this.props.children}
          </ul>
        </div>
      </Popup>
    );
  }
}
