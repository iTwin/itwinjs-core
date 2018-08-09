/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module Widget */

import * as React from "react";

import ConfigurableUiManager from "./ConfigurableUiManager";
import { WidgetDef, ToolbarWidgetProps } from "./WidgetDef";
import { ItemList } from "./ItemFactory";

import Toolbar from "@bentley/ui-ninezone/lib/toolbar/Toolbar";
import { Direction } from "@bentley/ui-ninezone/lib/utilities/Direction";

/** A Toolbar Widget normally displayed in the top left & top right zones in the 9-Zone Layout system.
 */
export class ToolbarWidgetDefBase extends WidgetDef {
  private _horizontalIds: string[];
  private _verticalIds: string[];
  public horizontalItems!: ItemList;
  public horizontalDirection: Direction;
  public verticalItems!: ItemList;
  public verticalDirection: Direction;

  constructor(def: ToolbarWidgetProps) {
    super(def);

    this._horizontalIds = (def.horizontalIds !== undefined) ? def.horizontalIds : [];
    this._verticalIds = (def.verticalIds !== undefined) ? def.verticalIds : [];
    this.horizontalDirection = (def.horizontalDirection !== undefined) ? def.horizontalDirection : Direction.Bottom;
    this.verticalDirection = (def.verticalDirection !== undefined) ? def.verticalDirection : Direction.Right;
  }

  public resolveItems(): void {
    if (this.horizontalItems && this.verticalItems)
      return;

    this.horizontalItems = new ItemList();
    this.verticalItems = new ItemList();

    this._horizontalIds.map((id, _index) => {
      const item = ConfigurableUiManager.findItem(id);
      if (item)
        this.horizontalItems.addItem(item);
    });

    this._verticalIds.map((id, _index) => {
      const item = ConfigurableUiManager.findItem(id);
      if (item)
        this.verticalItems.addItem(item);
    });
  }

  private renderToolbarItems(itemList: ItemList): React.ReactNode[] | null {
    if (itemList && itemList.items) {
      return (
        itemList.items.map((item, index) => {
          return item.toolbarReactNode(index);
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

export default ToolbarWidgetDefBase;
