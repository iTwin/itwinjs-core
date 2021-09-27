/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Item
 */

import * as React from "react";
import { CommandHandler, OnItemExecutedFunc } from "@itwin/appui-abstract";
import { Orientation, SizeProps } from "@itwin/core-react";
import { ActionItemButton } from "../toolbar/ActionItemButton";
import { ItemDefBase } from "./ItemDefBase";
import { ItemProps } from "./ItemProps";

/** Abstract base class that is used by classes to execute an action when pressed.
 * @public
 */
export abstract class ActionButtonItemDef extends ItemDefBase {
  private _onItemExecuted?: OnItemExecutedFunc;

  /** Command Handler for the action button */
  protected _commandHandler?: CommandHandler;
  /** Parameters passed to the Command Handler */
  public parameters?: any;
  /** Size of the action button, as set by handleSizeKnown */
  public size?: SizeProps;
  /** The default button size for all action buttons */
  public static defaultButtonSize = 42;

  constructor(itemProps: ItemProps, onItemExecuted?: OnItemExecutedFunc) {
    super(itemProps);

    this.execute = this.execute.bind(this);
    this._onItemExecuted = onItemExecuted;
  }

  /** Called when the action button is invoked by a click or touch */
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

  /** Called when the size of the action button is initialized and the size is known */
  public handleSizeKnown = (size: SizeProps) => {
    this.size = size;
  };

  /** Determines the dimension in a given orientation */
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
  };

  /** @internal */
  public toolbarReactNode(index?: number): React.ReactNode {
    if (!this.isVisible) // eslint-disable-line deprecation/deprecation
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
