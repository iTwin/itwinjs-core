/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
/** @packageDocumentation
 * @module Frontstage
 */

import type { Draft } from "immer";
import produce from "immer";
import { StagePanelLocation, StagePanelSection } from "@itwin/appui-abstract";
import { UiEvent } from "@itwin/core-react";
import type { NineZoneState, PanelSide } from "@itwin/appui-layout-react";
import { FrontstageManager } from "../frontstage/FrontstageManager";
import { WidgetDef } from "../widgets/WidgetDef";
import { WidgetHost } from "../widgets/WidgetHost";
import type { StagePanelMaxSizeSpec, StagePanelProps, StagePanelZoneProps, StagePanelZonesProps } from "./StagePanel";
import type { ZoneLocation } from "../zones/Zone";
import { getStableWidgetProps } from "../zones/Zone";
import { UiFramework } from "../UiFramework";

/** Enum for StagePanel state.
 * @public
 */
export enum StagePanelState {
  Off,
  Minimized,
  Open,
  Popup,
}

/** Panel State Changed Event Args interface.
 * @public @deprecated
 */
export interface PanelStateChangedEventArgs {
  panelDef: StagePanelDef;
  panelState: StagePanelState;
}

/** Panel State Changed Event class.
 * @beta
 */
export class PanelStateChangedEvent extends UiEvent<PanelStateChangedEventArgs> { }

/** @internal */
export interface PanelSizeChangedEventArgs {
  panelDef: StagePanelDef;
  size: number | undefined;
}

/** @internal */
export class PanelSizeChangedEvent extends UiEvent<PanelSizeChangedEventArgs> { }

/**
 * A StagePanelDef represents each Stage Panel within a Frontstage.
 * @public
 */
export class StagePanelDef extends WidgetHost {
  private _panelState = StagePanelState.Open;
  private _defaultState = StagePanelState.Open;
  private _maxSizeSpec: StagePanelMaxSizeSpec | undefined;
  private _minSize: number | undefined;
  private _size: number | undefined;
  private _defaultSize: number | undefined;
  private _resizable = true;
  private _pinned = true;
  private _applicationData?: any;
  private _location: StagePanelLocation = StagePanelLocation.Left;
  private _panelZones = new StagePanelZonesDef();

  /** Constructor for PanelDef.
   */
  constructor() {
    super();
  }

  /** @internal */
  public get maxSizeSpec() { return this._maxSizeSpec; }

  /** @internal */
  public get minSize() { return this._minSize; }

  /** Default size of the panel */
  public get size() {
    // istanbul ignore next
    if ("1" === UiFramework.uiVersion)
      return this._size;

    // istanbul ignore else
    if (FrontstageManager.activeFrontstageDef) {
      const [_, size] = FrontstageManager.activeFrontstageDef.getPanelCurrentState(this);
      return size;
    }
    // istanbul ignore next
    return this._defaultSize;
  }

  public set size(size) {
    if (this._size === size)
      return;

    // istanbul ignore else
    if (UiFramework.uiVersion === "2") {
      const frontstageDef = FrontstageManager.activeFrontstageDef;
      // istanbul ignore else
      if (frontstageDef && frontstageDef.nineZoneState) {
        const side = toPanelSide(this.location);
        frontstageDef.nineZoneState = setPanelSize(frontstageDef.nineZoneState, side, size);
        const panel = frontstageDef.nineZoneState.panels[side];
        if (panel.size === this._size)
          return;
        size = panel.size;
      }
    }
    this._size = size;
    FrontstageManager.onPanelSizeChangedEvent.emit({
      panelDef: this,
      size,
    });
  }

  /** Indicates whether the panel is resizable. */
  // istanbul ignore next
  public get resizable(): boolean { return this._resizable; }

  /** Indicates whether the panel is pinned. */
  public get pinned(): boolean { return this._pinned; }

  /** Any application data to attach to this Panel. */
  public get applicationData(): any | undefined { return this._applicationData; }
  /** Location of panel. */
  public get location(): StagePanelLocation { return this._location; }

  /** Panel state. Defaults to PanelState.Open. */
  public get panelState() {
    if ("1" === UiFramework.uiVersion)
      return this._panelState;

    // istanbul ignore else
    if (FrontstageManager.activeFrontstageDef) {
      const [state] = FrontstageManager.activeFrontstageDef?.getPanelCurrentState(this);
      return state;
    }
    // istanbul ignore next
    return this.defaultState;
  }

  public set panelState(panelState: StagePanelState) {
    if (panelState === this._panelState)
      return;
    const frontstageDef = FrontstageManager.activeFrontstageDef;
    if (UiFramework.uiVersion === "2" && frontstageDef && frontstageDef.nineZoneState) {
      const side = toPanelSide(this.location);
      frontstageDef.nineZoneState = produce(frontstageDef.nineZoneState, (nineZone) => {
        const panel = nineZone.panels[side];
        switch (panelState) {
          case StagePanelState.Minimized: {
            panel.collapsed = true;
            break;
          }
          case StagePanelState.Open: {
            panel.collapsed = false;
            break;
          }
          case StagePanelState.Off: {
            panel.collapsed = true;
            break;
          }
        }
      });
    }
    this._panelState = panelState;
    FrontstageManager.onPanelStateChangedEvent.emit({
      panelDef: this,
      panelState,
    });
  }

  /** @internal */
  public get defaultState() { return this._defaultState; }

  /** @internal */
  public get defaultSize() { return this._defaultSize; }

  /** Panel zones.
   * @internal
   */
  public get panelZones() {
    return this._panelZones;
  }

  /** @internal */
  public initializeFromProps(props?: StagePanelProps, panelLocation?: StagePanelLocation): void {
    if (panelLocation !== undefined)
      this._location = panelLocation;
    if (!props)
      return;
    this._size = props.size;
    this._defaultSize = props.size;
    this._maxSizeSpec = props.maxSize;
    this._minSize = props.minSize;
    if (panelLocation !== undefined)
      this._location = panelLocation;
    if (props.defaultState !== undefined) {
      this._panelState = props.defaultState;
      this._defaultState = props.defaultState;
    }
    this._resizable = props.resizable;
    if (props.pinned !== undefined)
      this._pinned = props.pinned;
    if (props.applicationData !== undefined)
      this._applicationData = props.applicationData;
    if (props.panelZones) {
      this._panelZones.initializeFromProps(props.panelZones, this._location);
    }

    if (props.widgets) {
      props.widgets.forEach((widgetNode, index) => {
        const stableId = `uifw-sp-${StagePanelLocation[this._location]}-${index}`;
        const stableProps = getStableWidgetProps(widgetNode.props, stableId);
        const widgetDef = new WidgetDef(stableProps);
        this.addWidgetDef(widgetDef);
      });
    }
  }

  /** Gets the list of Widgets. */
  public override get widgetDefs(): ReadonlyArray<WidgetDef> {
    const widgetDefs = [...super.widgetDefs];
    for (const [, panelZone] of this.panelZones) {
      widgetDefs.push(...panelZone.widgetDefs);
    }
    return widgetDefs;
  }

  /** Gets the list of Widgets (w/o StagePanelZone widgets).
   * @internal
   */
  public get panelWidgetDefs() {
    return super.widgetDefs;
  }

  /** @internal */
  public override updateDynamicWidgetDefs(stageId: string, stageUsage: string, location: ZoneLocation | StagePanelLocation, _section: StagePanelSection | undefined,
    widgetDefs: WidgetDef[], frontstageApplicationData?: any,
  ): void {
    this.panelZones.start.updateDynamicWidgetDefs(stageId, stageUsage, location, StagePanelSection.Start, widgetDefs, frontstageApplicationData);
    this.panelZones.middle.updateDynamicWidgetDefs(stageId, stageUsage, location, StagePanelSection.Middle, widgetDefs, frontstageApplicationData);
    this.panelZones.end.updateDynamicWidgetDefs(stageId, stageUsage, location, StagePanelSection.End, widgetDefs, frontstageApplicationData);
  }
}

/** @internal */
export type StagePanelZoneDefKeys = keyof Pick<StagePanelZonesDef, "start" | "middle" | "end">;

const stagePanelZoneDefKeys: StagePanelZoneDefKeys[] = ["start", "middle", "end"];

/** @internal */
export class StagePanelZonesDef {
  private _start = new StagePanelZoneDef();
  private _middle = new StagePanelZoneDef();
  private _end = new StagePanelZoneDef();

  public get start() {
    return this._start;
  }

  public get middle() {
    return this._middle;
  }

  public get end() {
    return this._end;
  }

  /** @internal */
  public initializeFromProps(props: StagePanelZonesProps, panelLocation: StagePanelLocation): void {
    if (props.start) {
      this.start.initializeFromProps(props.start, panelLocation, "start");
    }
    if (props.middle) {
      this.middle.initializeFromProps(props.middle, panelLocation, "middle");
    }
    if (props.end) {
      this.end.initializeFromProps(props.end, panelLocation, "end");
    }
  }

  /** @internal */
  public *[Symbol.iterator](): Iterator<[StagePanelZoneDefKeys, StagePanelZoneDef]> {
    for (const key of stagePanelZoneDefKeys) {
      const value = this[key];
      yield [key, value];
    }
    return undefined;
  }
}

/** @internal */
export class StagePanelZoneDef extends WidgetHost {
  /** @internal */
  public initializeFromProps(props: StagePanelZoneProps, panelLocation: StagePanelLocation, panelZone: StagePanelZoneDefKeys): void {
    props.widgets.forEach((widgetNode, index) => {
      const stableId = `uifw-spz-${StagePanelLocation[panelLocation]}-${panelZone}-${index}`;
      const stableProps = getStableWidgetProps(widgetNode.props, stableId);
      const widgetDef = new WidgetDef(stableProps);
      this.addWidgetDef(widgetDef);
    });
  }
}

/** @internal */
export function toPanelSide(location: StagePanelLocation): PanelSide {
  switch (location) {
    case StagePanelLocation.Bottom:
    case StagePanelLocation.BottomMost:
      return "bottom";
    case StagePanelLocation.Left:
      return "left";
    case StagePanelLocation.Right:
      return "right";
    case StagePanelLocation.Top:
    case StagePanelLocation.TopMost:
      return "top";
  }
}

/** @internal */
export const setPanelSize = produce((
  nineZone: Draft<NineZoneState>,
  side: PanelSide,
  size: number | undefined,
) => {
  const panel = nineZone.panels[side];
  panel.size = size === undefined ? size : Math.min(Math.max(size, panel.minSize), panel.maxSize);
});
