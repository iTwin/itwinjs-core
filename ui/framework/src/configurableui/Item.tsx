/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Item */

import * as React from "react";

import { Icon } from "./IconComponent";
import { CommandItemProps, ToolItemProps, CommandHandler } from "./ItemProps";
import { ItemDefBase } from "./ItemDefBase";
import { ItemProps } from "./ItemProps";

import { Item } from "@bentley/ui-ninezone";

/** Abstract base class that is used by classes to execute an action when pressed. */
export abstract class ActionButtonItemDef extends ItemDefBase {
  protected _commandHandler?: CommandHandler;
  public parameters?: any;
  public isActive?: boolean = false;

  constructor(itemProps?: ItemProps) {
    super(itemProps);
    if (itemProps) {
      this.isActive = (itemProps.isActive !== undefined) ? itemProps.isActive : false;
    }

    this.execute = this.execute.bind(this);
  }

  public execute(): void {
    if (this._commandHandler && this._commandHandler.execute) {
      if (this._commandHandler.getCommandArgs)
        this._commandHandler.execute(this._commandHandler.getCommandArgs());
      else
        this._commandHandler.execute(this._commandHandler.parameters);
    }
  }

  public toolbarReactNode(index?: number): React.ReactNode {
    if (!this.isVisible)
      return null;

    const key = (index !== undefined) ? index.toString() : this.id;
    const icon = <Icon iconSpec={this.iconSpec} />;

    return (
      <Item
        isDisabled={!this.isEnabled}
        title={this.label}
        key={key}
        onClick={this.execute}
        icon={icon}
      />
    );
  }
}

/** An Item that executes a Command.
 */
export class CommandItemDef extends ActionButtonItemDef {
  public commandId: string = "";

  constructor(commandItemProps: CommandItemProps) {
    super(commandItemProps);

    if (commandItemProps.execute) {
      this._commandHandler = { execute: commandItemProps.execute, parameters: commandItemProps.parameters, getCommandArgs: commandItemProps.getCommandArgs };
    }

    this.commandId = commandItemProps.commandId;
  }

  public get isToolId(): boolean {
    return false;
  }

  public get id(): string {
    return this.commandId;
  }
}

/** An Item that starts the execution of a Tool.
 */
export class ToolItemDef extends ActionButtonItemDef {
  public toolId: string = "";

  constructor(commandItemProps: ToolItemProps) {
    super(commandItemProps);

    if (commandItemProps.execute) {
      this._commandHandler = { execute: commandItemProps.execute, parameters: commandItemProps.parameters, getCommandArgs: commandItemProps.getCommandArgs };
    }

    this.toolId = commandItemProps.toolId;
  }

  public get isToolId(): boolean {
    return false;
  }

  public get id(): string {
    return this.toolId;
  }
}
