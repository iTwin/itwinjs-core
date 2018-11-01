/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Item */

import * as React from "react";
import { Icon } from "./IconLabelSupport";

import { CommandItemProps, CommandHandler } from "./ItemProps";
import { ItemDefBase } from "./ItemDefBase";

import ToolbarIcon from "@bentley/ui-ninezone/lib/toolbar/item/Icon";

/** An Item that executes a Command.
 */
export class CommandItemDef extends ItemDefBase {
  public commandId: string = "";
  private _commandHandler?: CommandHandler;

  constructor(commandItemProps: CommandItemProps) {
    super(commandItemProps);

    this.commandId = commandItemProps.commandId ? commandItemProps.commandId : commandItemProps.toolId ? commandItemProps.toolId : "";
    this._commandHandler = commandItemProps.commandHandler;
  }

  public get isToolId(): boolean {
    return false;
  }

  public get id(): string {
    return this.commandId;
  }

  public execute(): void {
    if (this._commandHandler)
      this._commandHandler.execute(this._commandHandler.parameters);
  }

  public toolbarReactNode(index?: number): React.ReactNode {
    const key = (index !== undefined) ? index.toString() : this.id;
    let myClassNames: string = "";
    if (!this.isVisible) myClassNames += "item-hidden";
    if (!this.isEnabled) myClassNames += "nz-is-disabled";

    return (
      <ToolbarIcon
        className={myClassNames.length ? myClassNames : undefined} isDisabled={!this.isEnabled}
        title={this.label}
        key={key}
        onClick={this.execute}
        icon={
          <Icon iconInfo={this.iconInfo} />
        }
      />
    );
  }
}

/** An Item that executes a Tool.
 */
export class ToolItemDef extends CommandItemDef {
  public toolId: string = "";

  constructor(commandItemProps: CommandItemProps) {
    super(commandItemProps);

    this.toolId = commandItemProps.toolId ? commandItemProps.toolId : commandItemProps.commandId ? commandItemProps.commandId : "";
  }

  public get id(): string {
    return this.toolId;
  }

  public get isToolId(): boolean {
    return true;
  }

}
