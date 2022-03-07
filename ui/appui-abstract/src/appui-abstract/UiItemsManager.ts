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
import { StageUsage } from "./items/StageUsage";

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
}

/**
 * Base implementation of a UiItemsProvider. The base class allows the user to pass in a function that is used to determine if the
 * active stage should be provided items. Derived provider classes should override the `xxxInternal` methods to provide items.
 * @public
 */
export class BaseUiItemsProvider implements UiItemsProvider {
  /*
   * @param providerId - unique identifier for this instance of the provider. This is required in case separate packages want
   * to set up custom stage with their own subset of standard tools.
   * @param isSupportedStage - optional function that will be called to determine if tools should be added to current stage. If not set and
   * the current stage's `usage` is set to `StageUsage.General` then the provider will add items to frontstage.
   */
  constructor(protected _providerId: string, public isSupportedStage?: (stageId: string, stageUsage: string, stageAppData?: any) => boolean) { }

  public get id(): string { return this._providerId; }
  public onUnregister(): void { }

  public unregister() {
    UiItemsManager.unregister(this._providerId);
  }

  /** Backstage items are not stage specific so no callback is used */
  public provideBackstageItems(): BackstageItem[] {
    return [];
  }

  public provideToolbarButtonItemsInternal(_stageId: string, _stageUsage: string, _toolbarUsage: ToolbarUsage, _toolbarOrientation: ToolbarOrientation, _stageAppData?: any): CommonToolbarItem[] {
    return [];
  }
  public provideToolbarButtonItems(stageId: string, stageUsage: string, toolbarUsage: ToolbarUsage, toolbarOrientation: ToolbarOrientation, stageAppData?: any): CommonToolbarItem[] {
    let provideToStage = false;

    if (this.isSupportedStage) {
      provideToStage = this.isSupportedStage(stageId, stageUsage, stageAppData);
    } else {
      provideToStage = (stageUsage === StageUsage.General);
    }

    return provideToStage ? this.provideToolbarButtonItemsInternal(stageId, stageUsage, toolbarUsage, toolbarOrientation, stageAppData) : [];
  }

  public provideStatusBarItemsInternal(_stageId: string, _stageUsage: string, _stageAppData?: any): CommonStatusBarItem[] {
    return [];
  }
  public provideStatusBarItems(stageId: string, stageUsage: string, stageAppData?: any): CommonStatusBarItem[] {
    let provideToStage = false;

    if (this.isSupportedStage) {
      provideToStage = this.isSupportedStage(stageId, stageUsage, stageAppData);
    } else {
      provideToStage = (stageUsage === StageUsage.General);
    }

    return provideToStage ? this.provideStatusBarItemsInternal(stageId, stageUsage, stageAppData) : [];
  }

  public provideWidgetsInternal(_stageId: string, _stageUsage: string, _location: StagePanelLocation, _section?: StagePanelSection, _stageAppData?: any): AbstractWidgetProps[] {
    return [];
  }

  public provideWidgets(stageId: string, stageUsage: string, location: StagePanelLocation, section?: StagePanelSection,
    _zoneLocation?: AbstractZoneLocation, stageAppData?: any): ReadonlyArray<AbstractWidgetProps> {
    let provideToStage = false;

    if (this.isSupportedStage) {
      provideToStage = this.isSupportedStage(stageId, stageUsage, stageAppData);
    } else {
      provideToStage = (stageUsage === StageUsage.General);
    }

    return provideToStage ? this.provideWidgetsInternal(stageId, stageUsage, location, section, stageAppData) : [];
  }
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
