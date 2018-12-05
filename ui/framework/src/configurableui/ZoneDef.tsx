/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Zone */

import { WidgetDef } from "./WidgetDef";
import { ZoneLocation } from "./Frontstage";

// -----------------------------------------------------------------------------
// ZoneProps
// -----------------------------------------------------------------------------

/** Zone State enum.
 */
export enum ZoneState {
  Off,
  Minimized,
  Open,
  Popup,
  Floating,
}

/**
 * A ZoneDef represents each zone within a Frontstage.
 */
export class ZoneDef {
  /** Zone state.  Defaults to ZoneState.Open. */
  public zoneState: ZoneState = ZoneState.Open;
  /** Indicates if other Zones may be merged with this Zone. Defaults to false.  */
  public allowsMerging: boolean = false;
  /** Any application data to attach to this Zone. */
  public applicationData?: any;
  /** Indicates with which other zone to merge. */
  public mergeWithZone?: ZoneLocation;

  private _widgetDefs: WidgetDef[] = new Array<WidgetDef>();

  /** Constructor for ZoneDef.
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

  /** If there is only one Widget in the Zone, gets the single WidgetDef.
   * @returns The single WidgetDef if there is only one Widget; otherwise, undefined is returned.
   */
  public getOnlyWidgetDef(): WidgetDef | undefined {
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

  /** Determines if this Zone is for Tool Settings. */
  public get isToolSettings(): boolean {
    if (this.widgetCount === 1)
      return this._widgetDefs[0].isToolSettings;
    return false;
  }

  /** Determines if this Zone is for the Status Bar. */
  public get isStatusBar(): boolean {
    if (this.widgetCount === 1)
      return this._widgetDefs[0].isStatusBar;
    return false;
  }

  /** Determines if the Zone should fill the available space. */
  public get shouldFillZone(): boolean {
    return this.widgetDefs.some((widgetDef: WidgetDef) => widgetDef.fillZone);
  }
}
