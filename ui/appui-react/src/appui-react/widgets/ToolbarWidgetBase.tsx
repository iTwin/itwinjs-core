/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import * as React from "react";
import { Orientation } from "@itwin/core-react";
import { Direction, ToolbarPanelAlignment } from "@itwin/appui-layout-react";
import { ItemList } from "../shared/ItemMap";
import { Toolbar } from "../toolbar/Toolbar";
import { ToolbarWidgetProps, WidgetDef } from "./WidgetDef";

/** A Toolbar Widget normally displayed in the top left & top right zones in the 9-Zone Layout system.
 * @deprecated in 3.0.
 * @public
 */
export class ToolbarWidgetDefBase extends WidgetDef {
  public horizontalDirection: Direction; // eslint-disable-line deprecation/deprecation
  public verticalDirection: Direction; // eslint-disable-line deprecation/deprecation

  public horizontalPanelAlignment: ToolbarPanelAlignment; // eslint-disable-line deprecation/deprecation
  public verticalPanelAlignment: ToolbarPanelAlignment; // eslint-disable-line deprecation/deprecation

  public horizontalItems?: ItemList;
  public verticalItems?: ItemList;
  private _toolbarBaseName = "";

  constructor(def: ToolbarWidgetProps) { // eslint-disable-line deprecation/deprecation
    super(def);

    // eslint-disable-next-line deprecation/deprecation
    this.horizontalDirection = (def.horizontalDirection !== undefined) ? def.horizontalDirection : Direction.Bottom;
    // eslint-disable-next-line deprecation/deprecation
    this.verticalDirection = (def.verticalDirection !== undefined) ? def.verticalDirection : Direction.Right;

    this.horizontalPanelAlignment = ToolbarPanelAlignment.Start; // eslint-disable-line deprecation/deprecation
    this.verticalPanelAlignment = ToolbarPanelAlignment.Start; // eslint-disable-line deprecation/deprecation

    this.horizontalItems = def.horizontalItems;
    this.verticalItems = def.verticalItems;
  }

  public set widgetBaseName(baseName: string) {
    this._toolbarBaseName = baseName;
  }
  public get widgetBaseName() {
    return this._toolbarBaseName;
  }

  public renderHorizontalToolbar(): React.ReactNode {
    const toolbarItems = this.horizontalItems;
    if (toolbarItems && toolbarItems.items.length) {
      return (
        <Toolbar
          toolbarId={`${this.widgetBaseName}-horizontal`}
          orientation={Orientation.Horizontal}
          expandsTo={this.horizontalDirection}
          panelAlignment={this.horizontalPanelAlignment}
          items={toolbarItems}
        />
      );
    }

    return null;
  }

  public renderVerticalToolbar(): React.ReactNode {
    const toolbarItems = this.verticalItems;
    if (toolbarItems && toolbarItems.items.length) {
      return (
        <Toolbar
          toolbarId={`${this.widgetBaseName}-vertical`}
          orientation={Orientation.Vertical}
          expandsTo={this.verticalDirection}
          panelAlignment={this.verticalPanelAlignment}
          items={toolbarItems}
        />
      );
    }

    return null;
  }
}
