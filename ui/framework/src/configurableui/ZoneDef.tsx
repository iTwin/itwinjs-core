/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Zone */

import { AnyWidgetProps, WidgetDef } from "./WidgetDef";
import { WidgetDefFactory } from "./WidgetFactory";

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

/** Properties of a Zone
 */
export interface ZoneProps {
  /** Default Zone state. Controls how the Zone is initially displayed. */
  defaultState: ZoneState;
  /** Indicates if other Zones may be merged with this Zone.  */
  allowsMerging: boolean;
  /** Properties for the Widgets in this Zone. */
  widgetProps: AnyWidgetProps[];
  /** Any application data to attach to this Zone. */
  applicationData?: any;
}

// -----------------------------------------------------------------------------
// ZoneDef
// -----------------------------------------------------------------------------

/**
 * A ZoneDef represents each zone within a Frontstage.
 */
export class ZoneDef {
  /** Default Zone state. Controls how the Zone is initially displayed. */
  public defaultState: ZoneState;
  /** Indicates if other Zones may be merged with this Zone.  */
  public allowsMerging: boolean;
  /** Any application data to attach to this Zone. */
  public applicationData?: any;
  /** Indicates if this Zone is open by default, based on defaultState.  */
  public isDefaultOpen: boolean = false;

  private _widgetDefs: WidgetDef[] = new Array<WidgetDef>();

  /** Constructor for ZoneDef.
   * @param zoneProps Properties for the Zone
   */
  constructor(zoneProps: ZoneProps) {
    this.defaultState = zoneProps.defaultState;
    this.allowsMerging = zoneProps.allowsMerging;

    if (zoneProps.applicationData !== undefined)
      this.applicationData = zoneProps.applicationData;

    if (zoneProps.widgetProps) {
      zoneProps.widgetProps.map((widgetProps, _index) => {
        const widgetDef = WidgetDefFactory.create(widgetProps);
        if (widgetDef) {
          this.addWidgetDef(widgetDef);

          if (!this.isDefaultOpen && this.defaultState === ZoneState.Open) {
            if (widgetDef.isDefaultOpen)
              this.isDefaultOpen = true;
          }
        }
      });
    }
  }

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
    return this.widgetDefs.find((element) => element.id === id);
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

  /** @hidden */
  public clearDefaultOpenUsed(): void {
    this.widgetDefs.map((widgetDef: WidgetDef) => {
      widgetDef.defaultOpenUsed = false;
    });
  }
}

/** Factory class to create a ZoneDef based on ZoneProps.
 */
export class ZoneDefFactory {
  /** Creates a ZoneDef based on Zone properties
   * @param zoneProps Properties for the Zone
   */
  public static Create(zoneProps?: ZoneProps): ZoneDef | undefined {
    if (zoneProps) {
      return new ZoneDef(zoneProps);
    }

    return undefined;
  }
}
