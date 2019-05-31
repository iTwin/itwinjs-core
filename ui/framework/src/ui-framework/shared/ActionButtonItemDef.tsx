/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Item */

import * as React from "react";

import { CommandHandler, ItemProps } from "./ItemProps";
import { ItemDefBase } from "./ItemDefBase";

import { Size } from "@bentley/ui-ninezone";
import { Orientation } from "@bentley/ui-core";
import { ActionItemButton } from "../toolbar/ActionItemButton";

/** Abstract base class that is used by classes to execute an action when pressed.
 * @public
 */
export abstract class ActionButtonItemDef extends ItemDefBase {
  protected _commandHandler?: CommandHandler;
  public parameters?: any;
  public size?: Size;

  constructor(itemProps: ItemProps) {
    super(itemProps);

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

  public handleSizeKnown = (size: Size) => {
    this.size = size;
  }

  public getDimension(orientation: Orientation): number {
    let dimension = 0;
    if (this.size)
      dimension = (orientation === Orientation.Horizontal ? this.size.width : this.size.height) + 1;
    return dimension;
  }

  public toolbarReactNode(_index?: number): React.ReactNode {
    if (!this.isVisible)
      return null;

    return (
      <ActionItemButton
        actionItem={this}
        onSizeKnown={this.handleSizeKnown}
      />
    );
  }
}
