/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Item
 */

import * as React from "react";

import { CommandHandler, OnItemExecutedFunc } from "@bentley/ui-abstract";
import { Orientation, SizeProps } from "@bentley/ui-core";

import { ItemDefBase } from "./ItemDefBase";
import { ActionItemButton } from "../toolbar/ActionItemButton";
import { ItemProps } from "./ItemProps";

/** Abstract base class that is used by classes to execute an action when pressed.
 * @public
 */
export abstract class ActionButtonItemDef extends ItemDefBase {
  protected _commandHandler?: CommandHandler;
  public parameters?: any;
  public size?: SizeProps;
  public static defaultButtonSize = 42;
  private _onItemExecuted?: OnItemExecutedFunc;

  constructor(itemProps: ItemProps, onItemExecuted?: OnItemExecutedFunc) {
    super(itemProps);

    this.execute = this.execute.bind(this);
    this._onItemExecuted = onItemExecuted;
  }

  public execute(): void {
    if (this._commandHandler && this._commandHandler.execute) {
      if (this._commandHandler.getCommandArgs)
        this._commandHandler.execute(this._commandHandler.getCommandArgs());
      else
        this._commandHandler.execute(this._commandHandler.parameters);
    }

    // istanbul ignore else
    if (this._onItemExecuted)
      this._onItemExecuted(this);
  }

  public handleSizeKnown = (size: SizeProps) => {
    this.size = size;
  }

  public getDimension(orientation: Orientation): number {
    let dimension = ActionButtonItemDef.defaultButtonSize;
    if (this.size)
      dimension = (orientation === Orientation.Horizontal) ? this.size.width : this.size.height;

    return dimension;
  }

  /** @internal */
  public static getRandomId(): string {
    return (Math.floor(Math.random() * 100) + 1000).toString();
  }

  /** @internal */
  public getKey = (index?: number): string => {
    const key = (!!this.id) ? this.id : (index !== undefined) ? index.toString() : ActionButtonItemDef.getRandomId();
    return key;
  }

  /** @internal */
  public toolbarReactNode(index?: number): React.ReactNode {
    if (!this.isVisible)
      return null;

    const key = this.getKey(index);

    return (
      <ActionItemButton
        key={key}
        actionItem={this}
        onSizeKnown={this.handleSizeKnown}
      />
    );
  }
}
