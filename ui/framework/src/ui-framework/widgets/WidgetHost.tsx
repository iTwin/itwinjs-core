/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Widget */

import { WidgetDef } from "./WidgetDef";

/**
 * A WidgetHost represents a definition that hosts one or most Widgets in a Frontstage.
 * @public
 */
export class WidgetHost {

  private _widgetDefs: WidgetDef[] = new Array<WidgetDef>();

  /** Constructor for WidgetHost.
   */
  constructor() { }

  /** Adds a WidgetDef to the list of Widgets.
   * @param widgetDef  Definition of the Widget to add
   */
  public addWidgetDef(widgetDef: WidgetDef) {
    this._widgetDefs.push(widgetDef);
  }

  /** Gets the list of Widgets. */
  public get widgetDefs(): WidgetDef[] {
    return this._widgetDefs;
  }

  /** Gets the number of Widgets. */
  public get widgetCount(): number {
    return this._widgetDefs.length;
  }

  /** If there is only one Widget in the Panel, gets the single WidgetDef.
   * @returns The single WidgetDef if there is only one Widget; otherwise, undefined is returned.
   */
  public getSingleWidgetDef(): WidgetDef | undefined {
    if (this.widgetCount === 1) {
      return this._widgetDefs[0];
    }
    return undefined;
  }

  /** Finds a WidgetDef with a given Id.
   * @param id  Id of the WidgetDef to find
   * @returns The WidgetDef if found; otherwise, undefined is returned.
   */
  public findWidgetDef(id: string): WidgetDef | undefined {
    return this.widgetDefs.find((widgetDef: WidgetDef) => widgetDef.id === id);
  }
}
