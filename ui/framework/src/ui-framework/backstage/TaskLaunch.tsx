/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Backstage */

import * as React from "react";
import { Logger } from "@bentley/bentleyjs-core";
import { SyncUiEventDispatcher, SyncUiEventArgs } from "../syncui/SyncUiEventDispatcher";
import { PropsHelper } from "../utils/PropsHelper";
import { WorkflowManager, TaskActivatedEventArgs } from "../workflow/Workflow";
import { UiFramework } from "../UiFramework";
import { BackstageItemProps, BackstageItemState, getBackstageItemStateFromProps, BackstageItem } from "./BackstageItem";
import { Backstage } from "./Backstage";

/** Properties for a [[TaskLaunchBackstageItem]] component
 * @public
 */
export interface TaskLaunchBackstageItemProps extends BackstageItemProps {
  /** Workflow Id */
  workflowId: string;
  /** Task Id */
  taskId: string;
}

/** Backstage item that activates a Task
 * @public
 */
export class TaskLaunchBackstageItem extends React.PureComponent<TaskLaunchBackstageItemProps, BackstageItemState> {

  /** @internal */
  public readonly state: Readonly<BackstageItemState>;
  private _componentUnmounting = false;  // used to ensure _handleSyncUiEvent callback is not processed after componentWillUnmount is called
  private _stateSyncIds: string[] = [];  // local version of syncId that are lower cased

  constructor(props: TaskLaunchBackstageItemProps) {
    super(props);

    if (props.stateSyncIds)
      this._stateSyncIds = props.stateSyncIds.map((value) => value.toLowerCase());

    const state = getBackstageItemStateFromProps(props);
    /* istanbul ignore else */
    if (this.props.isActive === undefined)
      state.isActive = WorkflowManager.activeTaskId === this.props.taskId && WorkflowManager.activeWorkflowId === this.props.workflowId;
    this.state = state;
  }

  public componentDidMount() {
    if (this.props.stateFunc && this._stateSyncIds.length > 0)
      SyncUiEventDispatcher.onSyncUiEvent.addListener(this._handleSyncUiEvent);
    WorkflowManager.onTaskActivatedEvent.addListener(this._handleTaskActivatedEvent);
  }

  public componentWillUnmount() {
    this._componentUnmounting = true;
    if (this.props.stateFunc && this._stateSyncIds.length > 0)
      SyncUiEventDispatcher.onSyncUiEvent.removeListener(this._handleSyncUiEvent);
    WorkflowManager.onTaskActivatedEvent.removeListener(this._handleTaskActivatedEvent);
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

  public get id(): string {
    return this.props.workflowId + ":" + this.props.taskId;
  }

  public execute = (): void => {
    Backstage.hide();

    const workflow = WorkflowManager.findWorkflow(this.props.workflowId);
    if (workflow) {
      const task = workflow.getTask(this.props.taskId);
      if (task)
        WorkflowManager.setActiveWorkflowAndTask(workflow, task); // tslint:disable-line:no-floating-promises
      else
        Logger.logError(UiFramework.loggerCategory(this), `Task with id '${this.props.taskId}' not found`);
    } else
      Logger.logError(UiFramework.loggerCategory(this), `Workflow with id '${this.props.workflowId}' not found`);
  }

  public componentDidUpdate(_prevProps: TaskLaunchBackstageItemProps) {
    const updatedState = getBackstageItemStateFromProps(this.props);
    updatedState.isActive = WorkflowManager.activeTaskId === this.props.taskId && WorkflowManager.activeWorkflowId === this.props.workflowId;
    if (!PropsHelper.isShallowEqual(updatedState, this.state))
      this.setState((_prevState) => updatedState);
  }

  private _handleTaskActivatedEvent = (args: TaskActivatedEventArgs) => {
    const isActive = args.taskId === this.props.taskId && args.workflowId === this.props.workflowId;
    /* istanbul ignore else */
    if (isActive !== this.state.isActive)
      this.setState({ isActive });
  }

  // TODO: add tooltip, subtitle, aria-label? to NZ_BackstageItem
  public render(): React.ReactNode {
    return (
      <BackstageItem
        icon={PropsHelper.getIcon(this.state.iconSpec)}
        isActive={this.state.isActive}
        isDisabled={!this.state.isEnabled}
        key={this.id}
        onClick={this.execute}
      >
        {this.state.label}
      </BackstageItem>
    );
  }
}
