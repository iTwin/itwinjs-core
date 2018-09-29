/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Backstage */

import * as React from "react";
// import { CSSProperties } from "react";

import { UiFramework } from "../UiFramework";

import { ItemDefBase } from "./ItemDefBase";
import { ItemProps, CommandHandler } from "./ItemProps";
import { FrontstageManager } from "./FrontstageManager";
import { Icon } from "./IconLabelSupport";
import { WorkflowManager } from "./Workflow";

import { UiEvent } from "@bentley/ui-core";

import NZ_Backstage from "@bentley/ui-ninezone/lib/backstage/Backstage";
import NZ_BackstageItem from "@bentley/ui-ninezone/lib/backstage/Item";
import NZ_BackstageSeparator from "@bentley/ui-ninezone/lib/backstage/Separator";
import NZ_UserProfile from "@bentley/ui-ninezone/lib/backstage/UserProfile";

import { AccessToken } from "@bentley/imodeljs-clients";

// import { BackstageHide } from "../App"; // BARRY_TODO

// -----------------------------------------------------------------------------
// BackstageItemDef and sub-interfaces
// -----------------------------------------------------------------------------

/** Base properties for a [[Backstage]] item.
 */
export interface BackstageItemProps extends ItemProps {
  subtitleId?: string;
  subtitleExpr?: string;
}

/** Properties for a Frontstage launch Backstage item.
 */
export interface FrontstageLaunchBackstageItemProps extends BackstageItemProps {
  frontstageId: string;
}

/** Properties for a Command launch Backstage item.
 */
export interface CommandLaunchBackstageItemProps extends BackstageItemProps {
  commandId: string;
  commandHandler: CommandHandler;
}

/** Properties for a Task launch Backstage item.
 */
export interface TaskLaunchBackstageItemProps extends BackstageItemProps {
  workflowId: string;
  taskId: string;
}

// -----------------------------------------------------------------------------
// BackstageItem and subclasses
// -----------------------------------------------------------------------------

/** Base class for a [[Backstage]] item definition.
 */
export abstract class BackstageItemDef extends ItemDefBase {
  public subtitle: string = "";

  constructor(backstageItemDef: BackstageItemProps) {
    super(backstageItemDef);

    if (backstageItemDef) {
      this.subtitle = (backstageItemDef.subtitleId !== undefined) ? UiFramework.i18n.translate(backstageItemDef.subtitleId) : "";
      // subtitleExpr?: string;
    }

    this.execute = this.execute.bind(this);
  }

  public toolbarReactNode(_index: number): React.ReactNode { return null; }
}

/** Frontstage launch Backstage item definition.
 */
export class FrontstageLaunchBackstageItemDef extends BackstageItemDef {
  private _frontstageId: string = "";

  constructor(frontstageLauncherItemProps: FrontstageLaunchBackstageItemProps) {
    super(frontstageLauncherItemProps);

    if (frontstageLauncherItemProps)
      this._frontstageId = frontstageLauncherItemProps.frontstageId;
  }

  public execute(): void {
    Backstage.hide();

    const frontstageDef = FrontstageManager.findFrontstageDef(this._frontstageId);
    if (frontstageDef)
      FrontstageManager.setActiveFrontstageDef(frontstageDef);
  }

  public get id(): string {
    return this._frontstageId;
  }

  public get isActive(): boolean {
    return FrontstageManager.activeFrontstageId === this._frontstageId;
  }
}

/** Command launch Backstage item definition.
 */
export class CommandLaunchBackstageItemDef extends BackstageItemDef {
  private _commandId: string = "";
  private _commandHandler?: CommandHandler;

  constructor(commandBackstageItemProps: CommandLaunchBackstageItemProps) {
    super(commandBackstageItemProps);

    if (commandBackstageItemProps) {
      this._commandId = commandBackstageItemProps.commandId;
      this._commandHandler = commandBackstageItemProps.commandHandler;
    }
  }

  public execute(): void {
    Backstage.hide();

    if (this._commandHandler)
      this._commandHandler.execute(this._commandHandler.parameters);
  }

  public get id(): string {
    return this._commandId;
  }
}

/** Task launch Backstage item definition.
 */
export class TaskLaunchBackstageItemDef extends BackstageItemDef {
  private _taskId: string = "";
  private _workflowId: string = "";

  constructor(taskLaunchBackstageItemProps: TaskLaunchBackstageItemProps) {
    super(taskLaunchBackstageItemProps);

    if (taskLaunchBackstageItemProps) {
      this._taskId = taskLaunchBackstageItemProps.taskId;
      this._workflowId = taskLaunchBackstageItemProps.workflowId;
    }
  }

  public execute(): void {
    Backstage.hide();

    const workflow = WorkflowManager.findWorkflow(this._workflowId);
    if (workflow) {
      const task = workflow.getTask(this._taskId);
      if (task) {
        WorkflowManager.setActiveWorkflowAndTask(workflow, task);
      }
    }
  }

  public get id(): string {
    return this._workflowId + ":" + this._taskId;
  }
}

/** Separator Backstage item definition.
 */
export class SeparatorBackstageItemDef extends BackstageItemDef {

  constructor(separatorBackstageItemProps: BackstageItemProps) {
    super(separatorBackstageItemProps);

    this.isEnabled = false;
  }

  public execute(): void { }
  public get id(): string { return ""; }
}

////////////////////////////////////////////////////////////////////////////////////////////////////////

/** Frontstage launch Backstage item.
 */
export class FrontstageLaunchBackstageItem extends React.Component<FrontstageLaunchBackstageItemProps> {
  private _backstageItem: FrontstageLaunchBackstageItemDef;

  constructor(frontstageLauncherItemProps: FrontstageLaunchBackstageItemProps) {
    super(frontstageLauncherItemProps);

    this._backstageItem = new FrontstageLaunchBackstageItemDef(frontstageLauncherItemProps);
  }

  public render(): React.ReactNode {
    const icon = <Icon iconInfo={this._backstageItem.iconInfo} />;
    return (
      <NZ_BackstageItem key={this._backstageItem.id}
        isActive={this._backstageItem.isActive}
        isDisabled={!this._backstageItem.isEnabled}
        label={this._backstageItem.label}
        icon={icon}
        onClick={this._backstageItem.execute} />
    );
  }
}

/** Command launch Backstage item.
 */
export class CommandLaunchBackstageItem extends React.Component<CommandLaunchBackstageItemProps> {
  private _backstageItem: CommandLaunchBackstageItemDef;

  constructor(commandBackstageItemDef: CommandLaunchBackstageItemProps) {
    super(commandBackstageItemDef);

    this._backstageItem = new CommandLaunchBackstageItemDef(commandBackstageItemDef);
  }

  public render(): React.ReactNode {
    const icon = <Icon iconInfo={this._backstageItem.iconInfo} />;
    return (
      <NZ_BackstageItem key={this._backstageItem.id} label={this._backstageItem.label} icon={icon} onClick={this._backstageItem.execute} />
    );
  }
}

/** Task launch Backstage item.
 */
export class TaskLaunchBackstageItem extends React.Component<TaskLaunchBackstageItemProps> {
  private _backstageItem: TaskLaunchBackstageItemDef;

  constructor(taskLaunchBackstageItemDef: TaskLaunchBackstageItemProps) {
    super(taskLaunchBackstageItemDef);

    this._backstageItem = new TaskLaunchBackstageItemDef(taskLaunchBackstageItemDef);
  }

  public render(): React.ReactNode {
    const icon = <Icon iconInfo={this._backstageItem.iconInfo} />;
    return (
      <NZ_BackstageItem key={this._backstageItem.id} label={this._backstageItem.label} icon={icon} onClick={this._backstageItem.execute} />
    );
  }
}

/** Separator Backstage item.
 */
export class SeparatorBackstageItem extends React.Component<BackstageItemProps> {
  private static _sSeparatorBackstageItemKey: number;
  private _key: number;
  private _backstageItem: SeparatorBackstageItemDef;

  constructor(separatorBackstageItemDef: BackstageItemProps) {
    super(separatorBackstageItemDef);

    SeparatorBackstageItem._sSeparatorBackstageItemKey++;
    this._key = SeparatorBackstageItem._sSeparatorBackstageItemKey;

    this._backstageItem = new SeparatorBackstageItemDef(separatorBackstageItemDef);

    this._backstageItem.isEnabled = false;
  }

  public render(): React.ReactNode {
    return (
      <NZ_BackstageSeparator key={this._key} />
    );
  }
}

/** [[BackstageCloseEventEvent]] arguments.
 */
export interface BackstageCloseEventArgs {
  isVisible: boolean;
}

/** Backstage Close Event class.
 */
export class BackstageCloseEventEvent extends UiEvent<BackstageCloseEventArgs> { }

function closeBackStage() {
  // new BackstageHide().run();  // BARRY_TODO

  Backstage.onBackstageCloseEventEvent.emit({ isVisible: false });
}

/** Props for the [[Backstage]] React component.
 */
export interface BackstageProps {
  accessToken?: AccessToken;
  isVisible: boolean;
  className?: string;
  showOverlay?: boolean;
  style?: React.CSSProperties;
  onClose?: () => void;
}

/** Backstage React component.
 */
export class Backstage extends React.Component<BackstageProps> {
  private static _backstageCloseEventEvent: BackstageCloseEventEvent = new BackstageCloseEventEvent();
  public static get onBackstageCloseEventEvent(): BackstageCloseEventEvent { return Backstage._backstageCloseEventEvent; }

  constructor(props?: any, context?: any) {
    super(props, context);
  }

  public static hide(): void {
    closeBackStage();
  }

  private _getUserProfile(): React.ReactNode | undefined {
    if (this.props.accessToken) {
      const userProfile = this.props.accessToken.getUserProfile();
      if (userProfile) {
        return (
          <NZ_UserProfile firstName={userProfile.firstName} lastName={userProfile.lastName} email={userProfile.email} />
        );
      }
    }

    return undefined;
  }

  public render(): React.ReactNode {
    return (
      <>
        <NZ_Backstage
          isOpen={this.props.isVisible}
          showOverlay={this.props.showOverlay}
          onClose={closeBackStage}
          header={this._getUserProfile()}
          items={this.props.children}
        />
        <div onClick={closeBackStage} />
      </>
    );
  }
}

// -----------------------------------------------------------------------------
// export default
// -----------------------------------------------------------------------------
export default Backstage;
