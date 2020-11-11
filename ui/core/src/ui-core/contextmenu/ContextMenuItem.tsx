/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ContextMenu
 */

import * as React from "react";
import classnames from "classnames";
import { BadgeType, SpecialKey } from "@bentley/ui-abstract";
import { CommonProps } from "../utils/Props";
import { ContextMenu } from "./ContextMenu";
import { BadgeUtilities } from "../badge/BadgeUtilities";
import { TildeFinder } from "./TildeFinder";
import { Icon, IconSpec } from "../icons/IconComponent";

/** Properties for the [[ContextMenuItem]] component
 * @public
 */
export interface ContextMenuItemProps extends React.AllHTMLAttributes<HTMLDivElement>, CommonProps {
  onSelect?: (event: any) => any;
  /** @internal */
  onHotKeyParsed?: (hotKey: string) => void;
  /** Icon to display in the left margin. */
  icon?: IconSpec;
  /** Disables any onSelect calls, hover/keyboard highlighting, and grays item. */
  disabled?: boolean;
  /** Badge to be overlaid on the item. */
  badgeType?: BadgeType;
  /** Icon to display in the right margin. */
  iconRight?: IconSpec;
  /** Hide the icon container. */
  hideIconContainer?: boolean;
  /** @internal */
  onHover?: () => any;
  /* @internal */
  isSelected?: boolean;
  /** @internal */
  parentMenu?: ContextMenu;
}

/** @internal */
interface ContextMenuItemState {
  hotKey?: string;
}

/**
 * Menu Item class for use within a [[ContextMenu]] component.
 * @public
 */
export class ContextMenuItem extends React.PureComponent<ContextMenuItemProps, ContextMenuItemState> {
  private _root: HTMLElement | null = null;
  private _lastChildren: React.ReactNode;
  private _parsedChildren: React.ReactNode;
  /** @internal */
  public static defaultProps: Partial<ContextMenuItemProps> = {
    disabled: false,
    isSelected: false,
  };
  constructor(props: ContextMenuItemProps) {
    super(props);
  }
  /** @internal */
  public readonly state: Readonly<ContextMenuItemState> = {};
  public render(): JSX.Element {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { onClick, className, style, onSelect, icon, disabled, onHover, isSelected, parentMenu, onHotKeyParsed, badgeType, iconRight,
      ...props } = this.props;
    const badge = BadgeUtilities.getComponentForBadgeType(badgeType);

    if (this._lastChildren !== this.props.children) {
      this._parsedChildren = TildeFinder.findAfterTilde(this.props.children).node;
      this._lastChildren = this.props.children;
    }

    return (
      <div
        {...props}
        ref={(el) => { this._root = el; }}
        onClick={this._handleClick}
        style={style}
        onFocus={this._handleFocus}
        onKeyUp={this._handleKeyUp}
        onMouseOver={this._handleMouseOver}
        data-testid={"core-context-menu-item"}
        className={classnames("core-context-menu-item", className,
          disabled && "core-context-menu-disabled",
          isSelected && "core-context-menu-is-selected")
        }
        role="menuitem"
        tabIndex={isSelected ? 0 : -1}
        aria-disabled={disabled}
      >
        {!this.props.hideIconContainer && <div className="core-context-menu-icon">
          {icon !== undefined && <Icon iconSpec={icon} />}
        </div>}
        <div className={"core-context-menu-content"}>
          {this._parsedChildren}
        </div>
        {iconRight &&
          <div className={classnames("core-context-menu-icon", "core-context-menu-icon-right")}>
            <Icon iconSpec={iconRight} />
          </div>
        }
        {badge &&
          <div className="core-context-menu-badge">
            {badge}
          </div>
        }
      </div>
    );
  }

  public componentDidMount() {
    this._updateHotkey(this.props.children);
  }

  public componentDidUpdate(prevProps: ContextMenuItemProps) {
    if (this.props.children !== prevProps.children) {
      this._updateHotkey(this.props.children);
    }
  }

  private _updateHotkey = (node: React.ReactNode) => {
    const hotKey = TildeFinder.findAfterTilde(node).character;
    if (hotKey && hotKey !== this.state.hotKey) {
      this.setState({ hotKey });
      if (this.props.onHotKeyParsed)
        this.props.onHotKeyParsed(hotKey);
    }
  };

  private _handleFocus = (event: React.FocusEvent<HTMLDivElement>) => {
    event.stopPropagation();
  };

  private _handleMouseOver = (_event: React.MouseEvent<HTMLDivElement>) => {
    // istanbul ignore else
    if (this._root && this._root.style.visibility !== "hidden" && this.props.onHover) {
      this.props.onHover();
    }
  };

  public select = () => {
    // istanbul ignore else
    if (this._root) {
      this._root.click();
      if (this.props.parentMenu && this.props.parentMenu.props.parentSubmenu)
        this.props.parentMenu.props.parentSubmenu.close(true);
    }
  };

  private _handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (this.props.onClick)
      this.props.onClick(event);
    if (this.props.onSelect)
      this.props.onSelect(event);
  };

  private _handleKeyUp = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === SpecialKey.Enter && this.props.onSelect !== undefined) {
      this.props.onSelect(event);
    }
  };
}
