/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Item */

import * as React from "react";

import { IModelApp, Tool } from "@bentley/imodeljs-frontend";

import { Icon } from "../shared/IconComponent";
import { FrontstageManager } from "../frontstage/FrontstageManager";
import { SyncUiEventDispatcher, SyncUiEventArgs, SyncUiEventId } from "../syncui/SyncUiEventDispatcher";
import { BaseItemState } from "../shared/ItemDefBase";
import { ToolItemProps, StringGetter } from "../shared/ItemProps";
import { UiFramework } from "../UiFramework";
import { Item, getToolbarItemProps } from "@bentley/ui-ninezone";
import { KeyboardShortcutManager } from "../keyboardshortcut/KeyboardShortcut";

/** Tool Button React Component.
 * @public
 */
export class ToolButton extends React.Component<ToolItemProps, BaseItemState> {
  private _componentUnmounting = false;
  private _label: string | StringGetter = "";

  /** @internal */
  public readonly state: Readonly<BaseItemState>;

  constructor(props: ToolItemProps) {
    super(props);

    if (props.label)
      this._label = props.label;
    else if (props.labelKey)
      this._label = UiFramework.i18n.translate(props.labelKey);

    this.state = {
      isVisible: undefined !== props.isVisible ? props.isVisible : true,
      isEnabled: undefined !== props.isEnabled ? props.isEnabled : true,
      isActive: undefined !== props.isActive ? props.isActive : false,
      isPressed: undefined !== props.isPressed ? props.isPressed : false,
    };
  }

  private _handleSyncUiEvent = (args: SyncUiEventArgs): void => {
    // istanbul ignore if
    if (this._componentUnmounting) return;

    let refreshState = false;
    let newState: BaseItemState = { ...this.state };

    // since this is a tool button automatically monitor the activation of tools so the active state of the button is updated.
    if (args.eventIds.has(SyncUiEventId.ToolActivated)) {
      newState.isActive = this.props.toolId === FrontstageManager.activeToolId;
      refreshState = true;
    }

    if (!refreshState && this.props.stateSyncIds && this.props.stateSyncIds.length > 0)
      refreshState = this.props.stateSyncIds.some((value: string): boolean => args.eventIds.has(value));
    if (refreshState) {
      if (this.props.stateFunc)
        newState = this.props.stateFunc(newState);
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

  private _execute = () => {
    if (this.props.execute) {
      this.props.execute();
    } else {
      const thisTool: typeof Tool | undefined = IModelApp.tools.find(this.props.toolId);
      // istanbul ignore else
      if (thisTool)
        (new thisTool()).run();
    }
  }

  private _handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === "Escape") {
      KeyboardShortcutManager.setFocusToHome();
    }
  }

  public get label(): string {
    let label = "";
    if (typeof this._label === "string")
      label = this._label;
    else
      label = this._label();
    return label;
  }

  public render(): React.ReactNode {
    if (!this.state.isVisible)
      return null;

    const icon = <Icon iconSpec={this.props.iconSpec} />;
    const toolbarItemProps = getToolbarItemProps(this.props);
    return (
      <Item
        {...toolbarItemProps}
        isActive={this.state.isActive}
        isDisabled={!this.state.isEnabled}
        title={this.label}
        key={this.props.toolId}
        onClick={this._execute}
        onKeyDown={this._handleKeyDown}
        icon={icon}
      />
    );
  }
}
