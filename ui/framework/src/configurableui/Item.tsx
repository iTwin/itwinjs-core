/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Item */

import * as React from "react";

import { IModelApp, Tool } from "@bentley/imodeljs-frontend";

import ConfigurableUIManager from "./ConfigurableUIManager";
import { Icon } from "./IconLabelSupport";
import { ToolUiProvider } from "./ToolUiProvider";
import { FrontstageManager, ToolActivatedEventArgs } from "./FrontstageManager";
import { ToolItemProps, CommandItemProps, CommandHandler } from "./ItemProps";
import { ItemDefBase } from "./ItemDefBase";
import { ConfigurableUIControlType } from "./ConfigurableUIControl";

import ToolbarIcon from "@bentley/ui-ninezone/lib/toolbar/item/Icon";

/** @module Item */

/** An Item that launches a Tool.
 */
export class ToolItemDef extends ItemDefBase {
  public toolId: string;
  private _toolUiProvider: ToolUiProvider | undefined;
  private _execute?: () => any;

  constructor(toolItemProps: ToolItemProps) {
    super(toolItemProps);

    this.toolId = toolItemProps.toolId;

    if (toolItemProps.execute !== undefined)
      this._execute = toolItemProps.execute;
  }

  public get id(): string {
    return this.toolId;
  }

  public execute(): void {
    if (FrontstageManager.activeFrontstageDef)
      FrontstageManager.activeFrontstageDef.setActiveToolItem(this);

    if (this._execute) {
      this._execute();
    } else {
      const thisTool: typeof Tool | undefined = IModelApp.tools.find(this.toolId);
      if (thisTool)
        (new thisTool()).run();
    }

  }

  public onActivated(): void {
  }

  public get isActive(): boolean {
    return FrontstageManager.activeToolId === this.toolId;
  }

  public toolbarReactNode(index?: number): React.ReactNode {
    const key = (index !== undefined) ? index.toString() : this.id;

    return (
      <ToolbarIcon
        className={!this.isVisible ? "item-hidden" : undefined}
        isActive={FrontstageManager.activeToolId === this.toolId}
        isDisabled={!this.isEnabled}
        key={key}
        onClick={this.execute}
        icon={
          <Icon iconInfo={this.iconInfo} />
        }
      />
    );
  }

  public get toolUiProvider(): ToolUiProvider | undefined {
    // TODO - should call getConfigurable if widget is sharable
    if (!this._toolUiProvider && ConfigurableUIManager.isControlRegistered(this.toolId)) {
      const toolUiProvider = ConfigurableUIManager.createControl(this.toolId, this.id) as ToolUiProvider;
      if (toolUiProvider) {
        if (toolUiProvider.getType() !== ConfigurableUIControlType.ToolUiProvider) {
          throw Error("ToolItemDef.toolUiProvider error: toolId '" + this.toolId + "' is registered to a control that is NOT a ToolUiProvider");
        }

        this._toolUiProvider = toolUiProvider;
        if (this._toolUiProvider) {
          this._toolUiProvider.toolItem = this;
        }
      }
    }

    return this._toolUiProvider;
  }
}

/** An Item that executes a Command.
 */
export class CommandItemDef extends ItemDefBase {
  public commandId: string;
  private _commandHandler?: CommandHandler;

  constructor(commandItemProps: CommandItemProps) {
    super(commandItemProps);

    this.commandId = commandItemProps.commandId;
    this._commandHandler = commandItemProps.commandHandler;
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

    return (
      <ToolbarIcon
        className={!this.isVisible ? "item-hidden" : undefined}
        isDisabled={!this.isEnabled}
        key={key}
        onClick={this.execute}
        icon={
          <Icon iconInfo={this.iconInfo} />
        }
      />
    );
  }
}
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export interface ItemButtonState {
  itemDef: ItemDefBase;
}

/** Command Button React Component.
 */
export class CommandButton extends React.Component<CommandItemProps, ItemButtonState> {

  /** hidden */
  public readonly state: Readonly<ItemButtonState>;

  constructor(commandItemProps: CommandItemProps) {
    super(commandItemProps);

    this.state = { itemDef: new CommandItemDef(commandItemProps) };
  }

  public static getDerivedStateFromProps(newProps: CommandItemProps, state: ItemButtonState): ItemButtonState | null {
    if (newProps.commandId !== state.itemDef.id) {
      return { itemDef: new CommandItemDef(newProps) };
    }

    return null;
  }

  public render(): React.ReactNode {
    return (
      this.state.itemDef.toolbarReactNode()
    );
  }
}

export interface ToolItemButtonState {
  itemDef: ToolItemDef;
  activeTool: boolean;
}

/** Tool Button React Component.
 */
export class ToolButton extends React.Component<ToolItemProps, ToolItemButtonState> {

  /** hidden */
  public readonly state: Readonly<ToolItemButtonState>;

  constructor(props: ToolItemProps) {
    super(props);

    const itemDef = new ToolItemDef(props);
    this.state = { itemDef, activeTool: (itemDef.toolId === FrontstageManager.activeToolId) };
  }

  public static getDerivedStateFromProps(newProps: ToolItemProps, state: ToolItemButtonState): ToolItemButtonState | null {
    if (newProps.toolId !== state.itemDef.id) {
      return { itemDef: new ToolItemDef(newProps), activeTool: state.activeTool };
    }

    return null;
  }

  private _handleToolActivatedEvent = (args: ToolActivatedEventArgs) => {
    this.setState((_prevState) => ({ activeTool: (this.state.itemDef.toolId === args.toolId) }));
  }

  public componentDidMount() {
    FrontstageManager.onToolActivatedEvent.addListener(this._handleToolActivatedEvent);
  }

  public componentWillUnmount() {
    FrontstageManager.onToolActivatedEvent.removeListener(this._handleToolActivatedEvent);
  }

  public render(): React.ReactNode {
    return (
      this.state.itemDef.toolbarReactNode()
    );
  }
}
