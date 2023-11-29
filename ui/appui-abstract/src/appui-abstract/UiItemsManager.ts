/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
/** @packageDocumentation
 * @module UiItemsProvider
 */

import { BeEvent, Logger, MarkRequired } from "@itwin/core-bentley";
import { BackstageItem } from "./backstage/BackstageItem";
import { CommonStatusBarItem } from "./statusbar/StatusBarItem";
import { CommonToolbarItem, ToolbarOrientation, ToolbarUsage } from "./toolbars/ToolbarItem";
import { AbstractWidgetProps } from "./widget/AbstractWidgetProps";
import { AbstractZoneLocation, StagePanelLocation, StagePanelSection } from "./widget/StagePanel";
import { UiItemsProvider } from "./UiItemsProvider";

const loggerCategory = "appui-abstract.UiItemsManager";
/** Action taken by the application on item provided by a UiItemsProvider
 * @public @deprecated in 3.2. This was only used by the previously removed UiItemsArbiter.
 */
export enum UiItemsApplicationAction {
  /** Allow the change to the item */
  Allow,
  /** Disallow the change to the item */
  Disallow,
  /** Update the item during the change */
  Update,
}

/** UIProvider Registered Event Args interface.
 * @deprecated in 3.6. Use [UiItemsProviderRegisteredEventArgs]($appui-react) instead.
 * @public
 */
export interface UiItemProviderRegisteredEventArgs {
  providerId: string;
}

/** UiItemProviderOverrides allows the application that registers a provider to limit when it is allowed to provide items
 * @deprecated in 3.6. Use [AllowedUiItemsProviderOverrides]($appui-react) instead.
 * @public
 */
export interface AllowedUiItemProviderOverrides {
  /** allows providerId to be overridden in the items manager for cases where the same provider needs to provide different content to different stages
   * @beta
   */
  providerId?: string;
  /** if specified then the current stage's Usage will be compared before allowing any items to be provided
   * @beta
   */
  stageUsages?: string[];
  /** if specified then the current stage's Id will be compared before allowing any items to be provided
   * @beta
  */
  stageIds?: string[];
}

/** Allowed overrides applied to a UiItemsProvider the application that registers a provider to limit when it is allowed to provide items.
 * Note that if an override `providerId` is specified then either `stageIds` or `stageUsages` must be defined to limit when the provider's
 * items are allowed.
 * @deprecated in 3.6. Use [UiItemsProviderOverrides]($appui-react) instead.
 * @public
 */
export type UiItemProviderOverrides = MarkRequired<AllowedUiItemProviderOverrides, "providerId" | "stageUsages"> |
  MarkRequired<AllowedUiItemProviderOverrides, "providerId" | "stageIds"> |                                 // eslint-disable-line @typescript-eslint/indent
  MarkRequired<AllowedUiItemProviderOverrides, "stageIds"> |                                                // eslint-disable-line @typescript-eslint/indent
  MarkRequired<AllowedUiItemProviderOverrides, "stageUsages"> |                                             // eslint-disable-line @typescript-eslint/indent
  MarkRequired<AllowedUiItemProviderOverrides, "providerId" | "stageUsages" | "stageIds">;                  // eslint-disable-line @typescript-eslint/indent

/** Interface that defines an instance of a UiItemsProvider and its application specified overrides. */
interface UiItemProviderEntry {
  provider: UiItemsProvider;
  overrides?: UiItemProviderOverrides;
}

/** Controls registering of UiItemsProviders and calls the provider's methods when populating different parts of the User Interface.
 * @deprecated in 3.6. Use [UiItemsManager]($appui-react) instead.
 * @public
 */
export class UiItemsManager {
  private static _registeredUiItemsProviders: Map<string, UiItemProviderEntry> = new Map<string, UiItemProviderEntry>();

  /** For use in unit testing
   * @internal */
  public static clearAllProviders() {
    UiItemsManager._registeredUiItemsProviders.clear();
  }

  /** Event raised any time a UiProvider is registered or unregistered. */
  public static readonly onUiProviderRegisteredEvent = new BeEvent<(ev: UiItemProviderRegisteredEventArgs) => void>();

  /** Return number of registered UiProvider. */
  public static get registeredProviderIds() {
    const ids = [...UiItemsManager._registeredUiItemsProviders.keys()];
    return ids;
  }

  /** Return true if there is any registered UiProvider. */
  public static get hasRegisteredProviders(): boolean {
    return this._registeredUiItemsProviders.size > 0;
  }

  /**
   * Retrieves a previously loaded UiItemsProvider.
   * @param providerId id of the UiItemsProvider to get
   */
  public static getUiItemsProvider(providerId: string): UiItemsProvider | undefined {
    return UiItemsManager._registeredUiItemsProviders.get(providerId)?.provider;
  }

  private static sendRegisteredEvent(ev: UiItemProviderRegisteredEventArgs) {
    UiItemsManager.onUiProviderRegisteredEvent.raiseEvent(ev);
  }

  /**
   * Registers a UiItemsProvider with the UiItemsManager.
   * @param uiProvider the UI items provider to register.
   */
  public static register(uiProvider: UiItemsProvider, overrides?: UiItemProviderOverrides): void {
    const providerId = overrides?.providerId ?? uiProvider.id;

    if (UiItemsManager.getUiItemsProvider(providerId)) {
      Logger.logInfo(loggerCategory, `UiItemsProvider (${providerId}) is already loaded`);
    } else {
      UiItemsManager._registeredUiItemsProviders.set(providerId, { provider: uiProvider, overrides });
      Logger.logInfo(loggerCategory, `UiItemsProvider ${uiProvider.id} registered as ${providerId} `);

      UiItemsManager.sendRegisteredEvent({ providerId } as UiItemProviderRegisteredEventArgs);
    }
  }

  /** Remove a specific UiItemsProvider from the list of available providers. */
  public static unregister(uiProviderId: string): void {
    const provider = UiItemsManager.getUiItemsProvider(uiProviderId);
    if (!provider)
      return;

    provider.onUnregister && provider.onUnregister();

    UiItemsManager._registeredUiItemsProviders.delete(uiProviderId);
    Logger.logInfo(loggerCategory, `UiItemsProvider (${uiProviderId}) unloaded`);

    // trigger a refresh of the ui
    UiItemsManager.sendRegisteredEvent({ providerId: uiProviderId } as UiItemProviderRegisteredEventArgs);
  }

  private static allowItemsFromProvider(entry: UiItemProviderEntry, stageId?: string, stageUsage?: string) {
    // istanbul ignore else
    const overrides = entry.overrides;
    if (undefined !== stageId && overrides?.stageIds && !(overrides.stageIds.some((value: string) => value === stageId)))
      return false;
    if (undefined !== stageUsage && overrides?.stageUsages && !(overrides.stageUsages.some((value: string) => value === stageUsage)))
      return false;
    return true;
  }

  /** Called when the application is populating a toolbar so that any registered UiItemsProvider can add tool buttons that either either execute
   * an action or specify a registered ToolId into toolbar.
   * @param stageId a string identifier the active stage.
   * @param stageUsage the StageUsage of the active stage.
   * @param toolbarUsage usage of the toolbar
   * @param toolbarOrientation orientation of the toolbar
   * @returns an array of error messages. The array will be empty if the load is successful, otherwise it is a list of one or more problems.
   */
  public static getToolbarButtonItems(stageId: string, stageUsage: string, toolbarUsage: ToolbarUsage,
    toolbarOrientation: ToolbarOrientation, stageAppData?: any): CommonToolbarItem[] {
    const buttonItems: CommonToolbarItem[] = [];
    if (0 === UiItemsManager._registeredUiItemsProviders.size)
      return buttonItems;

    UiItemsManager._registeredUiItemsProviders.forEach((entry: UiItemProviderEntry) => {
      const uiProvider = entry.provider;
      const providerId = entry.overrides?.providerId ?? uiProvider.id;
      // istanbul ignore else
      if (uiProvider.provideToolbarButtonItems && this.allowItemsFromProvider(entry, stageId, stageUsage)) {
        uiProvider.provideToolbarButtonItems(stageId, stageUsage, toolbarUsage, toolbarOrientation, stageAppData)
          .forEach((spec: CommonToolbarItem) => {
            // ignore duplicate ids
            if (-1 === buttonItems.findIndex((existingItem) => spec.id === existingItem.id))
              buttonItems.push({ ...spec, providerId });
          });
      }
    });

    return buttonItems;
  }

  /** Called when the application is populating the statusbar so that any registered UiItemsProvider can add status fields
   * @param stageId a string identifier the active stage.
   * @param stageUsage the StageUsage of the active stage.
   * @returns An array of CommonStatusBarItem that will be used to create controls for the status bar.
   */
  public static getStatusBarItems(stageId: string, stageUsage: string, stageAppData?: any): CommonStatusBarItem[] {
    const statusBarItems: CommonStatusBarItem[] = [];

    if (0 === UiItemsManager._registeredUiItemsProviders.size)
      return statusBarItems;

    UiItemsManager._registeredUiItemsProviders.forEach((entry: UiItemProviderEntry) => {
      const uiProvider = entry.provider;
      const providerId = entry.overrides?.providerId ?? uiProvider.id;

      // istanbul ignore else
      if (uiProvider.provideStatusBarItems && this.allowItemsFromProvider(entry, stageId, stageUsage)) {
        uiProvider.provideStatusBarItems(stageId, stageUsage, stageAppData)
          .forEach((item: CommonStatusBarItem) => {
            // ignore duplicate ids
            if (-1 === statusBarItems.findIndex((existingItem) => item.id === existingItem.id))
              statusBarItems.push({ ...item, providerId });
          });
      }
    });

    return statusBarItems;
  }

  /** Called when the application is populating the statusbar so that any registered UiItemsProvider can add status fields
   * @returns An array of BackstageItem that will be used to create controls for the backstage menu.
   */
  public static getBackstageItems(): BackstageItem[] {
    const backstageItems: BackstageItem[] = [];

    if (0 === UiItemsManager._registeredUiItemsProviders.size)
      return backstageItems;

    UiItemsManager._registeredUiItemsProviders.forEach((entry: UiItemProviderEntry) => {
      const uiProvider = entry.provider;
      const providerId = entry.overrides?.providerId ?? uiProvider.id;

      // istanbul ignore else
      if (uiProvider.provideBackstageItems) { // Note: We do not call this.allowItemsFromProvider here as backstage items
        uiProvider.provideBackstageItems()    //       should not be considered stage specific. If they need to be hidden
          .forEach((item: BackstageItem) => { //       the isHidden property should be set to a ConditionalBooleanValue
            // ignore duplicate ids
            if (-1 === backstageItems.findIndex((existingItem) => item.id === existingItem.id))
              backstageItems.push({ ...item, providerId });
          });
      }
    });
    return backstageItems;
  }

  /** Called when the application is populating the Stage Panels so that any registered UiItemsProvider can add widgets
   * @param stageId a string identifier the active stage.
   * @param stageUsage the StageUsage of the active stage.
   * @param location the location within the stage.
   * @param section the section within location.
   * @returns An array of AbstractWidgetProps that will be used to create widgets.
   */
  public static getWidgets(stageId: string, stageUsage: string, location: StagePanelLocation, section?: StagePanelSection, zoneLocation?: AbstractZoneLocation, stageAppData?: any): ReadonlyArray<AbstractWidgetProps> {
    const widgets: AbstractWidgetProps[] = [];

    if (0 === UiItemsManager._registeredUiItemsProviders.size)
      return widgets;

    UiItemsManager._registeredUiItemsProviders.forEach((entry: UiItemProviderEntry) => {
      const uiProvider = entry.provider;
      const providerId = entry.overrides?.providerId ?? uiProvider.id;

      // istanbul ignore else
      if (uiProvider.provideWidgets && this.allowItemsFromProvider(entry, stageId, stageUsage)) {
        uiProvider.provideWidgets(stageId, stageUsage, location, section, zoneLocation, stageAppData)
          .forEach((widget: AbstractWidgetProps) => {
            // ignore duplicate ids
            if (-1 === widgets.findIndex((existingItem) => widget.id === existingItem.id))
              widgets.push({ ...widget, providerId });
          });
      }
    });
    return widgets;
  }

}
