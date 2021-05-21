/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import { BeUiEvent, Logger } from "@bentley/bentleyjs-core";
import { StagePanelLocation, StagePanelSection, UiItemsArbiter, UiItemsManager } from "@bentley/ui-abstract";
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

/** Event class for [[this.onWidgetProvidersChanged]].
 * @internal
 */
export class WidgetProvidersChangedEvent extends BeUiEvent<WidgetProvidersChangedEventArgs> { }

/** Arguments of [[this.onWidgetProvidersChanged]] event.
 * @internal
 */
export interface WidgetProvidersChangedEventArgs {
  readonly providers: ReadonlyArray<WidgetProvider>;
}

/** Event class for [[this.onWidgetsChanged]].
 * @internal
 */
export class WidgetsChangedEvent extends BeUiEvent<WidgetsChangedEventArgs> { }

/** Widget Provider interface.
 * @beta
 */
export interface WidgetProvider {
  /** Id of provider */
  readonly id: string;
  /** Get WidgetDefs matching the given criteria.
   * @note It is recommended to provide custom unique ids to returned widget defs.
   * Semi-stable id is used when auto-generated `widgetDef` id is detected,
   * but correctness of such id depends on widget index in the returned array.
   */
  getWidgetDefs(stageId: string, stageUsage: string, location: ZoneLocation | StagePanelLocation, section?: StagePanelSection): ReadonlyArray<WidgetDef> | undefined;
}

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

function getWidgetProviderStableWidgetId(providerId: string, stageUsage: string, location: ZoneLocation | StagePanelLocation,
  section: StagePanelSection, index: number) {
  return `uifw-wp-${providerId}-${stageUsage}-${getLocationName(location)}-${StagePanelSection[section]}-${index}`;
}

function getAddonStableWidgetId(stageUsage: string, location: StagePanelLocation, section: StagePanelSection, index: number) {
  return `uifw-addon-${stageUsage}-${StagePanelLocation[location]}-${StagePanelSection[section]}-${index}`;
}

/** Widget Manager class.
 * @beta
 */
export class WidgetManager {
  private _widgets: ReadonlyArray<WidgetInfo> = [];
  private _providers: ReadonlyArray<WidgetProvider> = [];

  /** Event raised when Widgets are changed.
   * @internal
   */
  public readonly onWidgetsChanged = new WidgetsChangedEvent();

  /** Event raised when WidgetProviders are changed.
   * @internal
   */
  public readonly onWidgetProvidersChanged = new WidgetProvidersChangedEvent();

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

  /** @internal */
  public get providers(): ReadonlyArray<WidgetProvider> { return this._providers; }
  public set providers(p: ReadonlyArray<WidgetProvider>) {
    this._providers = p;
    this.onWidgetProvidersChanged.emit({ providers: p });
  }

  /** Adds a WidgetDef Provider
   */
  public addWidgetProvider(widgetProvider: WidgetProvider): void {
    const oldProviders = this._providers.filter((p) => p.id !== widgetProvider.id);
    const updatedProviders = [
      ...oldProviders,
      widgetProvider,
    ];
    this.providers = updatedProviders;
  }

  /** Removes a WidgetDef Provider
   */
  public removeWidgetProvider(providerId: string): boolean {
    let result = false;
    const updatedProviders = this._providers.filter((p) => p.id !== providerId);

    if (updatedProviders.length !== this._providers.length) {
      this.providers = updatedProviders;
      result = true;
    }

    return result;
  }

  /** Gets WidgetDefs for a Frontstage location.
   */
  public getWidgetDefs(stageId: string, stageUsage: string, location: ZoneLocation | StagePanelLocation, section?: StagePanelSection): ReadonlyArray<WidgetDef> | undefined {
    const definedSection = section === undefined ? StagePanelSection.Start : section;

    const widgetInfos = this._widgets.filter((info) => {
      return (!info.stageId || info.stageId === stageId)
        && (!info.stageUsage || info.stageUsage === stageUsage)
        && info.location === location
        && info.section === definedSection;
    });

    let widgetDefs = widgetInfos.map((info) => info.widgetDef);

    // Consult the registered WidgetProviders
    this._providers.forEach((p, index) => {
      const wds = p.getWidgetDefs(stageId, stageUsage, location, definedSection);
      if (wds) {
        const stableWds = wds.map((wd) => {
          const stableId = getWidgetProviderStableWidgetId(p.id, stageUsage, location, definedSection, index);
          return createStableWidgetDef(wd, stableId);
        });
        widgetDefs = widgetDefs.concat(stableWds);
      }
    });

    // Consult the UiItemsManager to get any Abstract widgets
    if (location in StagePanelLocation) {
      const widgets = UiItemsManager.getWidgets(stageId, stageUsage, location as StagePanelLocation, definedSection);
      const updatedWidgets = UiItemsArbiter.updateWidgets(widgets);
      updatedWidgets.forEach((abstractProps, index) => {
        const props = WidgetDef.createWidgetPropsFromAbstractProps(abstractProps);
        const stableId = getAddonStableWidgetId(stageUsage, location as StagePanelLocation, definedSection, index);
        const stableProps = getStableWidgetProps(props, stableId);
        const wd = new WidgetDef(stableProps);
        widgetDefs.push(wd);
      });
    }

    return widgetDefs.length > 0 ? widgetDefs : undefined;
  }
}
