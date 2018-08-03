/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Item */

import * as React from "react";

import { IModelApp, Tool } from "@bentley/imodeljs-frontend";

import ConfigurableUiManager from "./ConfigurableUiManager";
import { Icon } from "./IconLabelSupport";
import { ToolUiProvider } from "./ToolUiProvider";
import { FrontstageManager, ToolActivatedEventArgs } from "./FrontstageManager";
import { MessageDirection, MessageItemProps, PageItemProps, ToolItemProps, CommandItemProps, CommandHandler } from "./ItemProps";
import { ItemDefBase } from "./ItemDefBase";

import ToolbarIcon from "@bentley/ui-ninezone/lib/toolbar/item/Icon";

/** @module Item */

/** An Item that sends a Message.
 */
export class MessageItemDef extends ItemDefBase {
  public messageId: string;
  public direction: MessageDirection;

  public isActive: boolean = false;
  public isToggle: boolean = false;

  public messageData?: string;
  public messageDataExpr?: string;
  public overrideMessageId?: string;

  constructor(messageItemDef: MessageItemProps) {
    super(messageItemDef);

    this.messageId = messageItemDef.messageId;
    this.direction = messageItemDef.direction;

    if (messageItemDef.isActive !== undefined)
      this.isActive = messageItemDef.isActive;
    if (messageItemDef.isToggle !== undefined)
      this.isToggle = messageItemDef.isToggle;

    if (messageItemDef.messageData !== undefined)
      this.messageData = messageItemDef.messageData;
    if (messageItemDef.messageDataExpr !== undefined)
      this.messageDataExpr = messageItemDef.messageDataExpr;
    if (messageItemDef.overrideMessageId !== undefined)
      this.overrideMessageId = messageItemDef.overrideMessageId;
  }

  public get id(): string {
    return this.messageId;
  }

  public execute(): void {
    // TODO
    window.alert("Message '" + this.id + "' launch");
  }

  public toolbarReactNode(index?: number): React.ReactNode {
    const key = (index !== undefined) ? index.toString() : this.id;

    return (
      <ToolbarIcon
        key={key}
        onClick={this.execute}
        icon={
          <Icon iconInfo={this.iconInfo} />
        }
      />
    );
  }
}

/** An Item that opens a Page.
 */
export class PageItemDef extends ItemDefBase {
  public pageId: string;
  public sourceFile?: string;
  public isDialog?: boolean = false;

  constructor(pageItemDef: PageItemProps) {
    super(pageItemDef);

    this.pageId = pageItemDef.pageId;

    if (pageItemDef.sourceFile !== undefined)
      this.sourceFile = pageItemDef.sourceFile;
    if (pageItemDef.isDialog !== undefined)
      this.isDialog = pageItemDef.isDialog;
  }

  public get id(): string {
    return this.pageId;
  }

  public execute(): void {
    // TODO
    window.alert("Page '" + this.id + "' launch");
  }

  public toolbarReactNode(index?: number): React.ReactNode {
    const key = (index !== undefined) ? index.toString() : this.id;

    return (
      <ToolbarIcon
        key={key}
        onClick={this.execute}
        icon={
          <Icon iconInfo={this.iconInfo} />
        }
      />
    );
  }
}

/** An Item that launches a Tool.
 */
export class ToolItemDef extends ItemDefBase {
  public toolId: string;
  private _toolUiProvider: ToolUiProvider | undefined;
  private _execute?: () => any;

  constructor(toolItemDef: ToolItemProps) {
    super(toolItemDef);

    this.toolId = toolItemDef.toolId;

    if (toolItemDef.execute !== undefined)
      this._execute = toolItemDef.execute;
  }

  public get id(): string {
    return this.toolId;
  }

  public execute(): void {
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
        isActive={FrontstageManager.activeToolId === this.toolId}
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
    if (!this._toolUiProvider) {
      this._toolUiProvider = ConfigurableUiManager.createConfigurable(this.toolId, this.id) as ToolUiProvider;
      if (this._toolUiProvider) {
        this._toolUiProvider.toolItem = this;
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

    if (commandItemProps.commandHandler !== undefined)
      this._commandHandler = commandItemProps.commandHandler;
  }

  public get id(): string {
    return this.commandId;
  }

  public execute(): void {
    // TODO
    if (this._commandHandler && this._commandHandler.execute)
      this._commandHandler.execute();
    else
      window.alert("Command '" + this.id + "' launch");
  }

  public toolbarReactNode(index?: number): React.ReactNode {
    const key = (index !== undefined) ? index.toString() : this.id;

    return (
      <ToolbarIcon
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

/** Message Button React Component.
 */
export class MessageButton extends React.Component<MessageItemProps, ItemButtonState> {

  /** hidden */
  public readonly state: Readonly<ItemButtonState>;

  constructor(messageItemProps: MessageItemProps) {
    super(messageItemProps);

    this.state = { itemDef: new MessageItemDef(messageItemProps) };
  }

  public static getDerivedStateFromProps(newProps: MessageItemProps, state: ItemButtonState): ItemButtonState | null {
    if (newProps.messageId !== state.itemDef.id) {
      return { itemDef: new MessageItemDef(newProps) };
    }

    return null;
  }

  public render(): React.ReactNode {
    return (
      this.state.itemDef.toolbarReactNode()
    );
  }
}

/** Page Button React Component.
 */
export class PageButton extends React.Component<PageItemProps, ItemButtonState> {

  /** hidden */
  public readonly state: Readonly<ItemButtonState>;

  constructor(pageItemProps: PageItemProps) {
    super(pageItemProps);

    this.state = { itemDef: new PageItemDef(pageItemProps) };
  }

  public static getDerivedStateFromProps(newProps: PageItemProps, state: ItemButtonState): ItemButtonState | null {
    if (newProps.pageId !== state.itemDef.id) {
      return { itemDef: new PageItemDef(newProps) };
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

  private handleToolActivatedEvent = (args: ToolActivatedEventArgs) => {
    this.setState((_prevState) => ({ activeTool: (this.state.itemDef.toolId === args.toolId) }));
  }

  public componentDidMount() {
    FrontstageManager.ToolActivatedEvent.addListener(this.handleToolActivatedEvent);
  }

  public componentWillUnmount() {
    FrontstageManager.ToolActivatedEvent.removeListener(this.handleToolActivatedEvent);
  }

  public render(): React.ReactNode {
    return (
      this.state.itemDef.toolbarReactNode()
    );
  }
}
