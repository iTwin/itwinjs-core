/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Widget */

import * as React from "react";

import { WidgetDef, ToolbarWidgetProps } from "./WidgetDef";
import { ItemList } from "../shared/ItemMap";
import { ActionButtonItemDef } from "../shared/ActionButtonItemDef";

import { Toolbar, Direction } from "@bentley/ui-ninezone";

/** A Toolbar Widget normally displayed in the top left & top right zones in the 9-Zone Layout system.
 * @public
 */
export class ToolbarWidgetDefBase extends WidgetDef {
  public horizontalDirection: Direction;
  public verticalDirection: Direction;

  public horizontalItems?: ItemList;
  public verticalItems?: ItemList;

  constructor(def: ToolbarWidgetProps) {
    super(def);

    this.horizontalDirection = (def.horizontalDirection !== undefined) ? def.horizontalDirection : Direction.Bottom;
    this.verticalDirection = (def.verticalDirection !== undefined) ? def.verticalDirection : Direction.Right;

    this.horizontalItems = def.horizontalItems;
    this.verticalItems = def.verticalItems;
  }

  private renderToolbarItems(itemList: ItemList): React.ReactNode[] | null {
    if (itemList && itemList.items) {
      return (
        itemList.items.map((item, index) => {
          if (item instanceof ActionButtonItemDef)
            return item.toolbarReactNode(index);
          return null;
        })
      );
    }

    return null;
  }

  public renderHorizontalToolbar = (): React.ReactNode | null => {
    if (this.horizontalItems && this.horizontalItems.items.length) {
      return (
        <Toolbar
          expandsTo={this.horizontalDirection}
          items={this.renderToolbarItems(this.horizontalItems)}
        />
      );
    }

    return null;
  }

  public renderVerticalToolbar = (): React.ReactNode | null => {
    if (this.verticalItems && this.verticalItems.items.length) {
      return (
        <Toolbar
          expandsTo={this.verticalDirection}
          items={this.renderToolbarItems(this.verticalItems)}
        />
      );
    }

    return null;
  }
}
