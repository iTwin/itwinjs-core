/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
/** @packageDocumentation
 * @module Zone
 */

import type { WidgetDef } from "../widgets/WidgetDef";
import { WidgetHost } from "../widgets/WidgetHost";
import type { ZoneProps } from "./Zone";
import { ZoneLocation } from "./Zone";

/** Zone State enum.
 * @public @deprecated
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
 * @public
 */
export class ZoneDef extends WidgetHost {
  private _initialWidth: number | undefined = undefined;
  private _zoneState: ZoneState = ZoneState.Open;
  private _allowsMerging: boolean = false;
  private _applicationData?: any;
  private _mergeWithZone?: ZoneLocation;
  private _zoneLocation: ZoneLocation = ZoneLocation.TopLeft;

  /** Zone state.  Defaults to ZoneState.Open. @deprecated */
  public get zoneState(): ZoneState { return this._zoneState; }
  /** Indicates if other Zones may be merged with this Zone. Defaults to false. @deprecated */
  public get allowsMerging(): boolean { return this._allowsMerging; }
  /** Any application data to attach to this Zone. */
  public get applicationData(): any | undefined { return this._applicationData; }
  /** Indicates with which other zone to merge. @deprecated */
  public get mergeWithZone(): ZoneLocation | undefined { return this._mergeWithZone; }

  /** The Zone's location.
   * @internal
   */
  public get zoneLocation(): ZoneLocation { return this._zoneLocation; }
  public set zoneLocation(zoneLocation: ZoneLocation) { this._zoneLocation = zoneLocation; }

  /** Initial zone width. */
  public get initialWidth(): number | undefined {
    return this._initialWidth;
  }

  /** Constructor for ZoneDef.
   */
  constructor() {
    super();
  }

  /** Determines if this Zone is for Tool Settings. */
  public get isToolSettings(): boolean {
    const singleWidgetDef = this.getSingleWidgetDef();
    if (singleWidgetDef)
      return singleWidgetDef.isToolSettings;
    return false;
  }

  /** Determines if this Zone is for the Status Bar. */
  public get isStatusBar(): boolean {
    const singleWidgetDef = this.getSingleWidgetDef();
    if (singleWidgetDef)
      return singleWidgetDef.isStatusBar;
    return false;
  }

  /** Determines if the Zone should fill the available space. */
  public get shouldFillZone(): boolean {
    return this.widgetDefs.some((widgetDef: WidgetDef) => widgetDef.fillZone);
  }

  /** @internal */
  public setInitialWidth(width: number | undefined) {
    this._initialWidth = width;
  }

  /** @internal */
  public initializeFromProps(props: ZoneProps): void {
    if (props.defaultState)
      this._zoneState = props.defaultState;
    if (props.allowsMerging !== undefined)
      this._allowsMerging = props.allowsMerging;
    if (props.applicationData !== undefined)
      this._applicationData = props.applicationData;
    if (props.mergeWithZone !== undefined)
      this._mergeWithZone = props.mergeWithZone;
    this.setInitialWidth(props.initialWidth);
  }
}
