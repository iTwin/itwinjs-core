/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Widget
 */

import { Logger, BeUiEvent } from "@bentley/bentleyjs-core";
import { StagePanelLocation, StagePanelSection, UiItemsManager, UiItemsArbiter } from "@bentley/ui-abstract";

import { WidgetDef } from "./WidgetDef";
import { ZoneLocation } from "../zones/Zone";
import { UiFramework } from "../UiFramework";

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
  /** Get WidgetDefs matching the given criteria */
  getWidgetDefs(stageId: string, stageUsage: string, location: ZoneLocation | StagePanelLocation, section?: StagePanelSection): ReadonlyArray<WidgetDef> | undefined;
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
   */
  public addWidgetDef(widgetDef: WidgetDef, stageId: string | undefined, stageUsage: string | undefined, location: ZoneLocation | StagePanelLocation, section?: StagePanelSection): boolean {
    if (stageId === undefined && stageUsage === undefined) {
      Logger.logError(UiFramework.loggerCategory(this), `addWidgetDef: stageId or stageUsage param must be specified`);
      return false;
    }

    section = (section !== undefined) ? section : StagePanelSection.Start;
    const newWidget: WidgetInfo = { widgetDef, stageId, stageUsage, location, section };

    const oldWidgets = this._widgets.filter((info) => info.widgetDef.id !== widgetDef.id);
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
    section = (section !== undefined) ? section : StagePanelSection.Start;

    const widgetInfos = this._widgets.filter((info) => {
      return (!info.stageId || info.stageId === stageId)
        && (!info.stageUsage || info.stageUsage === stageUsage)
        && info.location === location
        && info.section === section;
    });

    let widgetDefs = widgetInfos.map((info) => info.widgetDef);

    // Consult the providers
    this._providers.forEach((p) => {
      const wds = p.getWidgetDefs(stageId, stageUsage, location, section);
      if (wds)
        widgetDefs = widgetDefs.concat(wds);
    });

    // Consult the UiItemsManager to get any "addon" widgets
    if (location in StagePanelLocation) {
      const widgets = UiItemsManager.getWidgets(stageId, stageUsage, location as StagePanelLocation, section);
      const updatedWidgets = UiItemsArbiter.updateWidgets(widgets);
      if (updatedWidgets.length > 0) {
        updatedWidgets.forEach((abstractProps) => {
          const wd = new WidgetDef(WidgetDef.createWidgetPropsFromAbstractProps(abstractProps));
          widgetDefs.push(wd);
        });
      }
    }

    return widgetDefs.length > 0 ? widgetDefs : undefined;
  }

}
