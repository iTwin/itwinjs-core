/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Widget */

import * as React from "react";

import { WidgetDef, ToolbarWidgetProps } from "./WidgetDef";
import { ItemList } from "../shared/ItemMap";

import { Direction, ToolbarPanelAlignment } from "@bentley/ui-ninezone";
import { Toolbar } from "../toolbar/Toolbar";
import { Orientation } from "@bentley/ui-core";

/** A Toolbar Widget normally displayed in the top left & top right zones in the 9-Zone Layout system.
 * @public
 */
export class ToolbarWidgetDefBase extends WidgetDef {
  public horizontalDirection: Direction;
  public verticalDirection: Direction;

  public horizontalPanelAlignment: ToolbarPanelAlignment;
  public verticalPanelAlignment: ToolbarPanelAlignment;

  public horizontalItems?: ItemList;
  public verticalItems?: ItemList;

  constructor(def: ToolbarWidgetProps) {
    super(def);

    this.horizontalDirection = (def.horizontalDirection !== undefined) ? def.horizontalDirection : Direction.Bottom;
    this.verticalDirection = (def.verticalDirection !== undefined) ? def.verticalDirection : Direction.Right;

    this.horizontalPanelAlignment = ToolbarPanelAlignment.Start;
    this.verticalPanelAlignment = ToolbarPanelAlignment.Start;

    this.horizontalItems = def.horizontalItems;
    this.verticalItems = def.verticalItems;
  }

  public renderHorizontalToolbar = (): React.ReactNode | null => {
    if (this.horizontalItems && this.horizontalItems.items.length) {
      return (
        <Toolbar
          orientation={Orientation.Horizontal}
          expandsTo={this.horizontalDirection}
          panelAlignment={this.horizontalPanelAlignment}
          items={this.horizontalItems}
        />
      );
    }

    return null;
  }

  public renderVerticalToolbar = (): React.ReactNode | null => {
    if (this.verticalItems && this.verticalItems.items.length) {
      return (
        <Toolbar
          orientation={Orientation.Vertical}
          expandsTo={this.verticalDirection}
          panelAlignment={this.verticalPanelAlignment}
          items={this.verticalItems}
        />
      );
    }

    return null;
  }
}
