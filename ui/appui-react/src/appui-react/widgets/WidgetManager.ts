/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
/** @packageDocumentation
 * @module Widget
 */

import { BeUiEvent, Logger } from "@itwin/core-bentley";
import type { AbstractWidgetProps} from "@itwin/appui-abstract";
import { AbstractZoneLocation, StagePanelLocation, StagePanelSection, UiItemsManager } from "@itwin/appui-abstract";
import { UiFramework } from "../UiFramework";
import { getStableWidgetProps, ZoneLocation } from "../zones/Zone";
import { WidgetDef } from "./WidgetDef";
import { createStableWidgetDef } from "./StableWidgetDef";

/** Information about WidgetDefs in the WidgetManager
 * @internal
 */
export interface WidgetInfo {
  widgetDef: WidgetDef;
  stageId?: string;
  stageUsage?: string;
  location: ZoneLocation | StagePanelLocation;
  section: StagePanelSection;
}

/** Arguments of [[this.onWidgetsChanged]] event.
 * @internal
 */
export interface WidgetsChangedEventArgs {
  readonly items: ReadonlyArray<WidgetInfo>;
}

/** Event class for [[this.onWidgetsChanged]].
 * @internal
 */
export class WidgetsChangedEvent extends BeUiEvent<WidgetsChangedEventArgs> { }

function isZoneLocation(location: ZoneLocation | StagePanelLocation): location is ZoneLocation {
  return location >= ZoneLocation.TopLeft && location <= ZoneLocation.BottomRight;
}

function getLocationName(location: ZoneLocation | StagePanelLocation) {
  return isZoneLocation(location) ? ZoneLocation[location] : StagePanelLocation[location];
}

function getWidgetManagerStableWidgetId(stageUsage: string | undefined, location: ZoneLocation | StagePanelLocation, section: StagePanelSection,
  index: number) {
  return `uifw-wm-${stageUsage || ""}-${getLocationName(location)}-${StagePanelSection[section]}-${index}`;
}

function getAddonStableWidgetId(stageUsage: string, location: StagePanelLocation, section: StagePanelSection, index: number) {
  return `uifw-addon-${stageUsage}-${StagePanelLocation[location]}-${StagePanelSection[section]}-${index}`;
}

/** Widget Manager class.
 * @beta
 */
export class WidgetManager {
  private _widgets: ReadonlyArray<WidgetInfo> = [];

  /** Event raised when Widgets are changed.
   * @internal
   */
  public readonly onWidgetsChanged = new WidgetsChangedEvent();

  /** @internal */
  public get widgetCount(): number {
    return this._widgets.length;
  }

  /** @internal */
  public get widgets(): ReadonlyArray<WidgetInfo> { return this._widgets; }
  public set widgets(w: ReadonlyArray<WidgetInfo>) {
    this._widgets = w;
    this.onWidgetsChanged.emit({ items: w });
  }

  /** Adds a WidgetDef for use in a Frontstage.
   * @note Added `widgetDef` must return unique id to correctly save/restore App layout.
   * Semi-stable id is generated when auto-generated `widgetDef` id is detected,
   * but correctness of such id depends on `addWidgetDef` call order and widget location.
   */
  public addWidgetDef(widgetDef: WidgetDef, stageId: string | undefined, stageUsage: string | undefined, location: ZoneLocation | StagePanelLocation, section?: StagePanelSection): boolean {
    if (stageId === undefined && stageUsage === undefined) {
      Logger.logError(UiFramework.loggerCategory(this), `addWidgetDef: stageId or stageUsage param must be specified`);
      return false;
    }

    section = (section !== undefined) ? section : StagePanelSection.Start;
    const index = this._widgets.reduce((acc, info) => {
      if (info.stageId === stageId && info.stageUsage === stageUsage && info.location === location && info.section === section)
        return acc + 1;
      return acc;
    }, 0);
    const stableId = getWidgetManagerStableWidgetId(stageUsage, location, section, index);
    const stableWidget = createStableWidgetDef(widgetDef, stableId);
    const newWidget: WidgetInfo = { widgetDef: stableWidget, stageId, stageUsage, location, section };

    const oldWidgets = this._widgets.filter((info) => info.widgetDef.id !== newWidget.widgetDef.id);
    const updatedWidgets = [
      ...oldWidgets,
      newWidget,
    ];
    this.widgets = updatedWidgets;

    return true;
  }

  /** Removes a WidgetDef.
   */
  public removeWidgetDef(widgetId: string): boolean {
    let result = false;
    const updatedWidgets = this._widgets.filter((info) => info.widgetDef.id !== widgetId);

    if (updatedWidgets.length !== this._widgets.length) {
      this.widgets = updatedWidgets;
      result = true;
    }

    return result;
  }

  // Used when WidgetDefs are requested from UiItemProviders when uiVersion="1"
  private getStagePanelLocationFromZoneLocation(location: ZoneLocation): StagePanelLocation | undefined {
    switch (location) {
      case ZoneLocation.BottomCenter:
      case ZoneLocation.TopCenter:
      case ZoneLocation.TopRight:
      case ZoneLocation.TopLeft:
        return undefined; // an existing stage does not support appending widgets to these zones
      case ZoneLocation.BottomLeft:
      case ZoneLocation.CenterLeft:
        return StagePanelLocation.Left;
      case ZoneLocation.BottomRight:
      case ZoneLocation.CenterRight:
        return StagePanelLocation.Right;
    }
  }

  /** Gets WidgetDefs for a Frontstage location.
   */
  public getWidgetDefs(stageId: string, stageUsage: string, location: ZoneLocation | StagePanelLocation, section?: StagePanelSection,
    frontstageApplicationData?: any): ReadonlyArray<WidgetDef> | undefined {
    const definedSection = section === undefined ? StagePanelSection.Start : section;

    const widgetInfos = this._widgets.filter((info) => {
      return (!info.stageId || info.stageId === stageId)
        && (!info.stageUsage || info.stageUsage === stageUsage)
        && info.location === location
        && info.section === definedSection;
    });

    const widgetDefs = widgetInfos.map((info) => info.widgetDef);

    // Consult the UiItemsManager to get any Abstract widgets
    if (location in StagePanelLocation) {
      const widgets = UiItemsManager.getWidgets(stageId, stageUsage, location as StagePanelLocation, definedSection, frontstageApplicationData);
      widgets.forEach((abstractProps: AbstractWidgetProps, index: number) => {
        const props = WidgetDef.createWidgetPropsFromAbstractProps(abstractProps);
        const stableId = getAddonStableWidgetId(stageUsage, location as StagePanelLocation, definedSection, index);
        const stableProps = getStableWidgetProps(props, stableId);
        const wd = new WidgetDef(stableProps);
        widgetDefs.push(wd);
      });
    } else {
      // istanbul ignore else
      if (location in ZoneLocation) {
        const panelLocation = this.getStagePanelLocationFromZoneLocation(location as ZoneLocation);
        // istanbul ignore else
        if (panelLocation && location in AbstractZoneLocation) {
          const widgets = UiItemsManager.getWidgets(stageId, stageUsage, panelLocation, undefined, location as unknown as AbstractZoneLocation, frontstageApplicationData);
          widgets.forEach((abstractProps: AbstractWidgetProps, index: number) => {
            const props = WidgetDef.createWidgetPropsFromAbstractProps(abstractProps);
            const stableId = getAddonStableWidgetId(stageUsage, location as StagePanelLocation, definedSection, index);
            const stableProps = getStableWidgetProps(props, stableId);
            const wd = new WidgetDef(stableProps);
            widgetDefs.push(wd);
          });
        }
      }
    }

    return widgetDefs.length > 0 ? widgetDefs : undefined;
  }
}
