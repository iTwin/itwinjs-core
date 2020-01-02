/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Backstage */

import * as React from "react";

import { Logger } from "@bentley/bentleyjs-core";
import { CommandHandler } from "@bentley/ui-abstract";
import { BackstageItem as NZ_BackstageItem } from "@bentley/ui-ninezone";
import { withSafeArea } from "../safearea/SafeAreaContext";
import { SyncUiEventDispatcher, SyncUiEventArgs } from "../syncui/SyncUiEventDispatcher";
import { PropsHelper } from "../utils/PropsHelper";
import { UiFramework } from "../UiFramework";
import { Backstage } from "./Backstage";
import { BackstageItemProps, BackstageItemState } from "./BackstageItemProps";
import { BackstageItemUtilities } from "./BackstageItemUtilities";

// cspell:ignore safearea

// tslint:disable-next-line:variable-name
const BackstageItem = withSafeArea(NZ_BackstageItem);

/** Properties for a [[CommandLaunchBackstageItem]] component
 * @public
 */
export interface CommandLaunchBackstageItemProps extends BackstageItemProps, CommandHandler {
  /** Unique Id for this backstage item. */
  commandId: string;
}

/** Backstage item that launches a Command
 * @public
 */
export class CommandLaunchBackstageItem extends React.PureComponent<CommandLaunchBackstageItemProps, BackstageItemState> {

  /** @internal */
  public readonly state: Readonly<BackstageItemState>;
  private _componentUnmounting = false;  // used to ensure _handleSyncUiEvent callback is not processed after componentWillUnmount is called
  private _stateSyncIds: string[] = [];  // local version of syncId that are lower cased

  constructor(props: CommandLaunchBackstageItemProps) {
    super(props);

    if (props.stateSyncIds)
      this._stateSyncIds = props.stateSyncIds.map((value) => value.toLowerCase());

    this.state = BackstageItemUtilities.getBackstageItemStateFromProps(props);
  }

  public componentDidMount() {
    if (this.props.stateFunc && this._stateSyncIds.length > 0)
      SyncUiEventDispatcher.onSyncUiEvent.addListener(this._handleSyncUiEvent);
  }

  public componentWillUnmount() {
    this._componentUnmounting = true;
    /* istanbul ignore else */
    if (this.props.stateFunc && this._stateSyncIds.length > 0)
      SyncUiEventDispatcher.onSyncUiEvent.removeListener(this._handleSyncUiEvent);
  }

  private _handleSyncUiEvent = (args: SyncUiEventArgs): void => {
    /* istanbul ignore next */
    if (this._componentUnmounting)
      return;

    /* istanbul ignore else */
    if (SyncUiEventDispatcher.hasEventOfInterest(args.eventIds, this._stateSyncIds)) {
      /* istanbul ignore else */
      if (this.props.stateFunc) {
        const newState = this.props.stateFunc(this.state);
        /* istanbul ignore else */

        if (!PropsHelper.isShallowEqual(newState, this.state))
          this.setState((_prevState) => newState);
      }
    }
  }

  public execute = (): void => {
    Backstage.hide();

    if (this.props.execute) {
      if (this.props.getCommandArgs)
        this.props.execute(this.props.getCommandArgs());
      else
        this.props.execute(this.props.parameters);
    } else
      Logger.logError(UiFramework.loggerCategory(this), `'${this.props.commandId}' has no execute() function`);
  }

  public componentDidUpdate(_prevProps: CommandLaunchBackstageItemProps) {
    const updatedState = BackstageItemUtilities.getBackstageItemStateFromProps(this.props);
    if (!PropsHelper.isShallowEqual(updatedState, this.state))
      this.setState((_prevState) => updatedState);
  }

  // TODO: add tooltip, subtitle, aria-label? to NZ_BackstageItem
  public render(): React.ReactNode {
    return (
      <BackstageItem
        icon={PropsHelper.getIcon(this.state.iconSpec)}
        isActive={this.state.isActive}
        isDisabled={!this.state.isEnabled}
        key={this.props.commandId}
        onClick={this.execute}
      >
        {this.state.label}
      </BackstageItem>
    );
  }
}
