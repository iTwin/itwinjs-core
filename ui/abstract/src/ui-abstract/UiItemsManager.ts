/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module UiItemsProvider
 */

import { Logger, BeEvent } from "@bentley/bentleyjs-core";
import { CommonStatusBarItem } from "./statusbar/StatusBarItem";
import { StageUsage } from "./items/StageUsage";
import { CommonToolbarItem, ToolbarUsage, ToolbarOrientation } from "./toolbars/ToolbarItem";
import { BackstageItem } from "./backstage/BackstageItem";
import { StagePanelLocation, StagePanelSection } from "./widget/StagePanel";
import { AbstractWidgetProps } from "./widget/AbstractWidgetProps";

const loggerCategory = "ui-abstract.UiItemsProvider";

/** Action taken by the application on item provided by a UiItemsProvider
 * @beta
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
 * @beta
 */
export interface UiItemsProvider {
  /** id of provider */
  readonly id: string;

  /** UiItemsManager calls following method to get items to populate specific toolbars */
  provideToolbarButtonItems?: (stageId: string, stageUsage: StageUsage, toolbarUsage: ToolbarUsage, toolbarOrientation: ToolbarOrientation) => CommonToolbarItem[];
  /** UiItemsManager calls following method to augment base statusbar for stages that allow it. */
  provideStatusBarItems?: (stageId: string, stageUsage: StageUsage) => CommonStatusBarItem[];
  /** UiItemsManager calls following method to augment backstage items. */
  provideBackstageItems?: () => BackstageItem[];
  /** UiItemsManager calls following method to augment Widget lists */
  provideWidgets?: (stageId: string, stageUsage: string, location: StagePanelLocation, section?: StagePanelSection) => ReadonlyArray<AbstractWidgetProps>;

  /** Called if the application changed the Toolbar button item */
  onToolbarButtonItemArbiterChange?: (item: CommonToolbarItem, action: UiItemsApplicationAction) => void;
  /** Called if the application changed the StatusBar item */
  onStatusBarItemArbiterChange?: (item: CommonStatusBarItem, action: UiItemsApplicationAction) => void;
  /** Called if the application changed the Backstage item */
  onBackstageItemArbiterChange?: (item: BackstageItem, action: UiItemsApplicationAction) => void;
  /** Called when the application changes the Widget */
  onWidgetArbiterChange?: (widget: AbstractWidgetProps, action: UiItemsApplicationAction) => void;
}

/** UIProvider Registered Event Args interface.
 * @beta
 */
export interface UiItemProviderRegisteredEventArgs {
  providerId: string;
}

/**
 * Controls registering of UiItemsProviders and calls the provider's methods when populating different parts of the User Interface.
 * @beta
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
   * @param providerId
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
      Logger.logInfo(loggerCategory, `UiItemsProvider (${uiProvider.id}) is already loaded`);
    } else {
      UiItemsManager._registeredUiItemsProviders.set(uiProvider.id, uiProvider);
      Logger.logInfo(loggerCategory, `UiItemsProvider (${uiProvider.id}) loaded`);

      UiItemsManager.sendRegisteredEvent({ providerId: uiProvider.id } as UiItemProviderRegisteredEventArgs);
    }
  }

  /** Remove a specific UiItemsProvider from the list of available providers. */
  public static unregister(uiProviderId: string): void {
    if (!UiItemsManager.getUiItemsProvider(uiProviderId))
      return;

    UiItemsManager._registeredUiItemsProviders.delete(uiProviderId);
    Logger.logInfo(loggerCategory, `UiItemsProvider (${uiProviderId}) unloaded`);

    // trigger a refresh of the ui
    UiItemsManager.sendRegisteredEvent({ providerId: uiProviderId } as UiItemProviderRegisteredEventArgs);
  }

  /** Called when the application is populating a toolbar so that any registered UiItemsProvider can add tool buttons that either either execute
   * an action or specify a registered ToolId into toolbar.
   * @param toolBarId a string identifier that describes the toolbar being populated.
   * @param itemIds provides hierarchy of item Ids of the items that comprise the 'base' toolbar. This allows the caller to determine a relative position for buttons the provider provides.
   * @returns an array of error messages. The array will be empty if the load is successful, otherwise it is a list of one or more problems.
   */
  public static getToolbarButtonItems(stageId: string, stageUsage: StageUsage, toolbarUsage: ToolbarUsage, toolbarOrientation: ToolbarOrientation): CommonToolbarItem[] {
    const buttonItems: CommonToolbarItem[] = [];
    if (0 === UiItemsManager._registeredUiItemsProviders.size)
      return buttonItems;

    UiItemsManager._registeredUiItemsProviders.forEach((uiProvider: UiItemsProvider) => {
      // istanbul ignore else
      if (uiProvider.provideToolbarButtonItems) {
        uiProvider.provideToolbarButtonItems(stageId, stageUsage, toolbarUsage, toolbarOrientation)
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
  public static getStatusBarItems(stageId: string, stageUsage: StageUsage): CommonStatusBarItem[] {
    const statusBarItems: CommonStatusBarItem[] = [];

    if (0 === UiItemsManager._registeredUiItemsProviders.size)
      return statusBarItems;

    UiItemsManager._registeredUiItemsProviders.forEach((uiProvider: UiItemsProvider) => {
      // istanbul ignore else
      if (uiProvider.provideStatusBarItems) {
        uiProvider.provideStatusBarItems(stageId, stageUsage)
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
  public static getWidgets(stageId: string, stageUsage: string, location: StagePanelLocation, section?: StagePanelSection): ReadonlyArray<AbstractWidgetProps> {
    const widgets: AbstractWidgetProps[] = [];

    if (0 === UiItemsManager._registeredUiItemsProviders.size)
      return widgets;

    UiItemsManager._registeredUiItemsProviders.forEach((uiProvider: UiItemsProvider) => {
      // istanbul ignore else
      if (uiProvider.provideWidgets) {
        uiProvider.provideWidgets(stageId, stageUsage, location, section)
          .forEach((widget: AbstractWidgetProps) => widgets.push({ ...widget, providerId: uiProvider.id }));
      }
    });
    return widgets;
  }

}
