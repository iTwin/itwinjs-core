/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Item */

import * as React from "react";
import classnames from "classnames";

import { withOnOutsideClick, CommonProps, SizeProps, Icon } from "@bentley/ui-core";
import { ExpandableItem, Item } from "@bentley/ui-ninezone";

import { ItemProps, StringGetter } from "../shared/ItemProps";
import { BaseItemState } from "../shared/ItemDefBase";
import { SyncUiEventDispatcher, SyncUiEventArgs } from "../syncui/SyncUiEventDispatcher";
import { UiFramework } from "../UiFramework";
import { KeyboardShortcutManager } from "../keyboardshortcut/KeyboardShortcut";
import { BetaBadge } from "../betabadge/BetaBadge";

import "@bentley/ui-ninezone/lib/ui-ninezone/toolbar/item/expandable/group/Panel.scss";
import "./PopupButton.scss";

// cSpell:ignore popupbutton

// tslint:disable-next-line: variable-name
const DivWithOnOutsideClick = withOnOutsideClick((props: React.HTMLProps<HTMLDivElement>) => (<div {...props} />), undefined, false);

/** Arguments of [[PopupButtonChildrenRenderProp]].
 * @public
 */
export interface PopupButtonChildrenRenderPropArgs {
  closePanel: () => void;
}

/** Type of [[PopupButtonProps.children]] when used as render prop.
 * @public
 */
export type PopupButtonChildrenRenderProp = (args: PopupButtonChildrenRenderPropArgs) => React.ReactNode;

/** Properties for the [[PopupButton]] React component
 * @public
 */
export interface PopupButtonProps extends ItemProps, CommonProps {
  children?: React.ReactNode | PopupButtonChildrenRenderProp;
  onExpanded?: (expand: boolean) => void;
  onSizeKnown?: (size: SizeProps) => void;
  noPadding?: boolean;
}

const isFunction = <T extends (...args: any) => any>(node: React.ReactNode): node is T => {
  if (typeof node === "function")
    return true;
  return false;
};

/**
 * Used to provide custom popup button in toolbar.
 * @public
 */
export class PopupButton extends React.Component<PopupButtonProps, BaseItemState> {
  private _label: string | StringGetter = "";
  private _componentUnmounting = false;

  constructor(props: PopupButtonProps) {
    super(props);

    if (props.label)
      this._label = props.label;
    // istanbul ignore else
    else if (props.labelKey)
      this._label = UiFramework.i18n.translate(props.labelKey);

    this.state = {
      isVisible: undefined !== props.isVisible ? props.isVisible : true,
      isEnabled: undefined !== props.isEnabled ? props.isEnabled : true,
      isActive: undefined !== props.isActive ? props.isActive : false,
      isPressed: undefined !== props.isPressed ? props.isPressed : false,
    };
  }

  public get label(): string {
    let label = "";
    if (typeof this._label === "string")
      label = this._label;
    else
      label = this._label();
    return label;
  }

  private _toggleIsExpanded = () => {
    const isPressed = !this.state.isPressed;

    this.setState((prevState) => {
      return {
        ...prevState,
        isPressed,
      };
    });

    if (this.props.onExpanded)
      this.props.onExpanded(isPressed);
  }

  /** Minimizes the expandable component. */
  public minimize = () => {
    this.setState((prevState) => {
      return {
        ...prevState,
        isPressed: false,
      };
    });
  }

  private _handleSyncUiEvent = (args: SyncUiEventArgs): void => {
    // istanbul ignore if
    if (this._componentUnmounting) return;

    let refreshState = false;
    let newState: BaseItemState = { ...this.state };

    // istanbul ignore else
    if (!refreshState && this.props.stateSyncIds && this.props.stateSyncIds.length > 0)
      refreshState = this.props.stateSyncIds.some((value: string): boolean => args.eventIds.has(value));

    // istanbul ignore else
    if (refreshState) {
      // istanbul ignore else
      if (this.props.stateFunc)
        newState = this.props.stateFunc(newState);
      // istanbul ignore next
      if ((this.state.isActive !== newState.isActive) || (this.state.isEnabled !== newState.isEnabled) || (this.state.isVisible !== newState.isVisible)) {
        this.setState((_prevState) => ({ isActive: newState.isActive, isEnabled: newState.isEnabled, isVisible: newState.isVisible }));
      }
    }
  }

  public componentDidMount() {
    SyncUiEventDispatcher.onSyncUiEvent.addListener(this._handleSyncUiEvent);
  }

  public componentWillUnmount() {
    this._componentUnmounting = true;
    SyncUiEventDispatcher.onSyncUiEvent.removeListener(this._handleSyncUiEvent);
  }

  private _handleKeyDown = (e: React.KeyboardEvent): void => {
    // istanbul ignore next
    if (e.key === "Escape") {
      this.minimize();
      KeyboardShortcutManager.setFocusToHome();
    }
  }

  /** Renders PopupButton */
  public render() {
    if (!this.state.isVisible)
      return null;

    const icon = <Icon iconSpec={this.props.iconSpec} />;

    return (
      <ExpandableItem
        {...this.props}
        panel={this.getExpandedContent()}>
        <Item
          title={this.label}
          onClick={this._toggleIsExpanded}
          onKeyDown={this._handleKeyDown}
          icon={icon}
          onSizeKnown={this.props.onSizeKnown}
          badge={this.props.betaBadge && <BetaBadge />}
        />
      </ExpandableItem>
    );
  }

  /** Returns expanded content panel */
  private getExpandedContent(): React.ReactNode {
    if (!this.state.isPressed)
      return undefined;

    const classNames = classnames(
      "nz-toolbar-item-expandable-group-panel",
      this.props.noPadding && "uifw-popupbutton-noPadding",
    );

    return (
      <DivWithOnOutsideClick
        className={classNames}
        onOutsideClick={this.minimize}
      >
        {isFunction<PopupButtonChildrenRenderProp>(this.props.children) ? this.props.children({
          closePanel: this.minimize,
        }) : this.props.children}
      </DivWithOnOutsideClick>
    );
  }
}
