/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */
/** @packageDocumentation
 * @module UiItemsProvider
 */

import { BeEvent, Logger } from "@itwin/core-bentley";
import { BackstageItem } from "./backstage/BackstageItem";
import { CommonStatusBarItem } from "./statusbar/StatusBarItem";
import { CommonToolbarItem, ToolbarOrientation, ToolbarUsage } from "./toolbars/ToolbarItem";
import { AbstractWidgetProps } from "./widget/AbstractWidgetProps";
import { AbstractZoneLocation, StagePanelLocation, StagePanelSection } from "./widget/StagePanel";
import { loggerCategory } from "./utils/misc";

/** Action taken by the application on item provided by a UiItemsProvider
 * @public
 */
export enum UiItemsApplicationAction {
  /** Allow the change to the item */
  Allow,
  /** Disallow the change to the item */
  Disallow,
  /** Update the item during the change */
  Update,
}

/** Describes interface of objects that want to provide UI component to the running IModelApp.
 * @public
 */
export interface UiItemsProvider {
  /** id of provider */
  readonly id: string;

  /** UiItemsManager calls following method to get items to populate specific toolbars */
  provideToolbarButtonItems?: (stageId: string, stageUsage: string, toolbarUsage: ToolbarUsage, toolbarOrientation: ToolbarOrientation, stageAppData?: any) => CommonToolbarItem[];
  /** UiItemsManager calls following method to augment base statusbar for stages that allow it. */
  provideStatusBarItems?: (stageId: string, stageUsage: string, stageAppData?: any) => CommonStatusBarItem[];
  /** UiItemsManager calls following method to augment backstage items. */
  provideBackstageItems?: () => BackstageItem[];
  /** UiItemsManager calls following method to augment Widget lists.
   * @note Returned widgets must provide unique `AbstractWidgetProps["id"]` to correctly save/restore App layout.
   */
  provideWidgets?: (stageId: string, stageUsage: string, location: StagePanelLocation, section?: StagePanelSection,
    zoneLocation?: AbstractZoneLocation, stageAppData?: any) => ReadonlyArray<AbstractWidgetProps>;
  /** Function called when the provider is unregistered via `ItemsManager.unregister` to allow provider to do cleanup. */
  onUnregister?: () => void;
  /** Called if the application changed the Toolbar button item */
  onToolbarButtonItemArbiterChange?: (item: CommonToolbarItem, action: UiItemsApplicationAction) => void;
  /** Called if the application changed the StatusBar item */
  onStatusBarItemArbiterChange?: (item: CommonStatusBarItem, action: UiItemsApplicationAction) => void;
  /** Called if the application changed the Backstage item */
  onBackstageItemArbiterChange?: (item: BackstageItem, action: UiItemsApplicationAction) => void;
  /** Called if the application changed the Widget */
  onWidgetArbiterChange?: (widget: AbstractWidgetProps, action: UiItemsApplicationAction) => void;
}

/** UIProvider Registered Event Args interface.
 * @public
 */
export interface UiItemProviderRegisteredEventArgs {
  providerId: string;
}

/**
 * Controls registering of UiItemsProviders and calls the provider's methods when populating different parts of the User Interface.
 * @public
 */
export class UiItemsManager {
  private static _registeredUiItemsProviders: Map<string, UiItemsProvider> = new Map<string, UiItemsProvider>();

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
    return UiItemsManager._registeredUiItemsProviders.get(providerId);
  }

  private static sendRegisteredEvent(ev: UiItemProviderRegisteredEventArgs) {
    UiItemsManager.onUiProviderRegisteredEvent.raiseEvent(ev);
  }

  /**
   * Registers a UiItemsProvider with the UiItemsManager.
   * @param uiProvider the UI items provider to register.
   */
  public static register(uiProvider: UiItemsProvider): void {
    if (UiItemsManager.getUiItemsProvider(uiProvider.id)) {
      Logger.logInfo(loggerCategory(this), `UiItemsProvider (${uiProvider.id}) is already loaded`);
    } else {
      UiItemsManager._registeredUiItemsProviders.set(uiProvider.id, uiProvider);
      Logger.logInfo(loggerCategory(this), `UiItemsProvider (${uiProvider.id}) loaded`);

      UiItemsManager.sendRegisteredEvent({ providerId: uiProvider.id } as UiItemProviderRegisteredEventArgs);
    }
  }

  /** Remove a specific UiItemsProvider from the list of available providers. */
  public static unregister(uiProviderId: string): void {
    const provider = UiItemsManager.getUiItemsProvider(uiProviderId);
    if (!provider)
      return;

    provider.onUnregister && provider.onUnregister();

    UiItemsManager._registeredUiItemsProviders.delete(uiProviderId);
    Logger.logInfo(loggerCategory(this), `UiItemsProvider (${uiProviderId}) unloaded`);

    // trigger a refresh of the ui
    UiItemsManager.sendRegisteredEvent({ providerId: uiProviderId } as UiItemProviderRegisteredEventArgs);
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

    UiItemsManager._registeredUiItemsProviders.forEach((uiProvider: UiItemsProvider) => {
      // istanbul ignore else
      if (uiProvider.provideToolbarButtonItems) {
        uiProvider.provideToolbarButtonItems(stageId, stageUsage, toolbarUsage, toolbarOrientation, stageAppData)
          .forEach((spec: CommonToolbarItem) => buttonItems.push({ ...spec, providerId: uiProvider.id }));
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

    UiItemsManager._registeredUiItemsProviders.forEach((uiProvider: UiItemsProvider) => {
      // istanbul ignore else
      if (uiProvider.provideStatusBarItems) {
        uiProvider.provideStatusBarItems(stageId, stageUsage, stageAppData)
          .forEach((item: CommonStatusBarItem) => statusBarItems.push({ ...item, providerId: uiProvider.id }));
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

    UiItemsManager._registeredUiItemsProviders.forEach((uiProvider: UiItemsProvider) => {
      // istanbul ignore else
      if (uiProvider.provideBackstageItems) {
        uiProvider.provideBackstageItems()
          .forEach((item: BackstageItem) => backstageItems.push({ ...item, providerId: uiProvider.id }));
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

    UiItemsManager._registeredUiItemsProviders.forEach((uiProvider: UiItemsProvider) => {
      // istanbul ignore else
      if (uiProvider.provideWidgets) {
        uiProvider.provideWidgets(stageId, stageUsage, location, section, zoneLocation, stageAppData)
          .forEach((widget: AbstractWidgetProps) => widgets.push({ ...widget, providerId: uiProvider.id }));
      }
    });
    return widgets;
  }

}
