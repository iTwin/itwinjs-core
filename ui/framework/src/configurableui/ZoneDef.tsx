/*---------------------------------------------------------------------------------------------
| $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
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

/** Props of a Zone
 */
export interface ZoneProps {
  defaultState: ZoneState;
  allowsMerging: boolean;
  widgetProps: AnyWidgetProps[];

  applicationData?: any;
}

// -----------------------------------------------------------------------------
// ZoneDef
// -----------------------------------------------------------------------------

/** ZoneDef class.
 */
export class ZoneDef {
  public defaultState: ZoneState;
  public allowsMerging: boolean;
  public applicationData?: any;

  public isDefaultOpen: boolean = false;

  private _widgetDefs: WidgetDef[] = new Array<WidgetDef>();

  // public zoneIndex: number;
  // public reactZoneState: NZ_ZoneState;

  constructor(zoneProps: ZoneProps) {
    this.defaultState = zoneProps.defaultState;
    this.allowsMerging = zoneProps.allowsMerging;

    if (zoneProps.applicationData !== undefined)
      this.applicationData = zoneProps.applicationData;

    if (zoneProps.widgetProps) {
      zoneProps.widgetProps.map((widgetProps, _index) => {
        const widgetDef = WidgetDefFactory.Create(widgetProps);
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

  public addWidgetDef(widgetDef: WidgetDef) {
    this._widgetDefs.push(widgetDef);
  }

  public get widgetDefs(): WidgetDef[] {
    return this._widgetDefs;
  }

  public get widgetCount(): number {
    return this._widgetDefs.length;
  }

  public getOnlyWidgetDef(): WidgetDef | undefined {
    if (this.widgetCount === 1) {
      return this._widgetDefs[0];
    }
    return undefined;
  }

  public findWidgetDef(id: string): WidgetDef | undefined {
    return this.widgetDefs.find((element) => element.id === id);
  }

  public get isToolSettings(): boolean {
    if (this.widgetCount === 1)
      return this._widgetDefs[0].isToolSettings;
    return false;
  }

  public get isStatusBar(): boolean {
    if (this.widgetCount === 1)
      return this._widgetDefs[0].isStatusBar;
    return false;
  }

  public clearDefaultOpenUsed(): void {
    this.widgetDefs.map((widgetDef: WidgetDef) => {
      widgetDef.defaultOpenUsed = false;
    });
  }
}

/** Factory class to create a ZoneDef based on ZoneProps.
 */
export class ZoneDefFactory {
  public static Create(def?: ZoneProps): ZoneDef | undefined {
    if (def) {
      return new ZoneDef(def);
    }

    return undefined;
  }
}
