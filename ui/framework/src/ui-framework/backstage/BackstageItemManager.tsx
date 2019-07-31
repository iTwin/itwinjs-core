/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Backstage */

import { Logger, BeEvent } from "@bentley/bentleyjs-core";
import { UiFramework } from "../UiFramework";
import * as React from "react";

const loggerCategory = "ui-framework.BackstageItemManager";

/** Specifies type of badge, if any, that should be overlaid on UI component.
 * @beta
 */
export enum BadgeType {
  /** No badge. */
  None = 0,
  /** Standard Technical Preview badge. */
  TechnicalPreview = 1,
}

/** Used to specify if the UI item's visibility or enable state is affected by the testFunc defined in [[ConditionalDisplaySpecification]].
 * @beta
 */
export enum ConditionalDisplayType {
  Visibility = 0,
  EnableState = 1,
}

/** Interface used to define a UI item whose display may change based on the current state of the application, such as the active view, the select element(s), etc.
 * @beta
 */
export interface ConditionalDisplaySpecification {
  type: ConditionalDisplayType;
  testFunc: () => boolean;
  syncEventIds: string[];  // sync ids that will trigger hideShowFunc to be reevaluated when fired
}

/** Used to specify the item type added to the backstage menu.
 * @beta
 */
export enum BackstageItemType {
  /** Item that executes an action function */
  ActionItem = 1,
  /** Item that activate a stage. */
  StageLauncher = 2,
  /** Item that will be created by a register backstage item provider. */
  CustomItem = 3,
}

/** Describes the data needed to insert a button into the backstage menu.
 * @beta
 */
export interface BackstageItemSpec {
  /** Require uniqueId for the item. To ensure uniqueness it is suggested that a namespace prefix of the plugin name be used. */
  itemId: string;
  /** GroupPriority specifies the group an item is in (recommend using values 1 through 100). Items are sorted by group and then item priority. When
   * group priority changes a separator is inserted.
   */
  groupPriority: number;
  /** Priority within a group (recommend using values 1 through 100) */
  itemPriority: number;
  /** type of item to be inserted */
  itemType: BackstageItemType;
  /** Label */
  label: string;
  /** Subtitle */
  subtitle?: string;
  /** Name of icon WebFont entry or if specifying an SVG symbol added by plug on use "svg:" prefix to imported symbol Id. */
  icon?: string;
  /** Tooltip. */
  toolTip?: string;
  /** if not specified no badge will be created. */
  badge?: BadgeType;
  /** if item's display is conditional then a ConditionalDisplaySpecification is specified. */
  condition?: ConditionalDisplaySpecification;
}

/** Describes the data needed to insert an action button into the backstage menu.
 * @beta
 */
export interface ActionItemSpec extends BackstageItemSpec {
  readonly itemType: BackstageItemType.ActionItem;
  execute: (args?: any) => void;
}

/** Describes the data needed to insert an action button into the backstage menu.
 * @beta
 */
export interface StageLauncher extends BackstageItemSpec {
  readonly itemType: BackstageItemType.StageLauncher;
  stageId: string;
}

/** Describes the data needed to insert an action button into the backstage menu.
 * @beta
 */
export interface StageLauncher extends BackstageItemSpec {
  readonly itemType: BackstageItemType.StageLauncher;
  stageId: string;
}

/** Describes the data needed to insert a custom item into the backstage menu.
 * @beta
 */
export interface CustomItemSpec extends BackstageItemSpec {
  readonly itemType: BackstageItemType.CustomItem;
  customItemProviderId: string;
}

/** BackstageItemProvider
 * @beta
 */
export interface BackstageItemProvider {
  /** Unique Id of provider */
  readonly id: string;
  /** Provides a list of BackstageItemSpecs for entries to add to the backstage menu. */
  provideBackstageItems: () => BackstageItemSpec[];
  /** Allow providing a custom BackstageItem */
  provideCustomBackstageItem?: (itemSpec: CustomItemSpec) => React.ReactNode;
}

/** BackstageItemProvider Registered Event Args interface.
 * @beta
 */
export interface BackstageItemProviderRegisteredEventArgs {
  providerId: string;
}

/**
 * Controls registering of BackstageItemProviders and calls the provider's methods when populating different parts of the User Interface.
 * @beta
 */
export class BackstageItemManager {
  private static _registeredBackstageItemProviders: Map<string, BackstageItemProvider> = new Map<string, BackstageItemProvider>();

  /** Event raised any time a UiProvider is registered or unregistered. */
  public static readonly onBackstageItemProviderRegisteredEvent = new BeEvent<(ev: BackstageItemProviderRegisteredEventArgs) => void>();

  /** Return true if there is any registered UiProvider. */
  public static get hasRegisteredProviders(): boolean {
    return this._registeredBackstageItemProviders.size > 0;
  }

  private static sendRegisteredEvent(ev: BackstageItemProviderRegisteredEventArgs) {
    BackstageItemManager.onBackstageItemProviderRegisteredEvent.raiseEvent(ev);
  }

  /**
   * Retrieves a previously loaded BackstageItemProvider.
   * @param providerId
   */
  public static getBackstageItemProvider(providerId: string): BackstageItemProvider | undefined {
    return BackstageItemManager._registeredBackstageItemProviders.get(providerId);
  }

  /**
   * Registers a BackstageItemProvider with the BackstageItemManager.
   * @param itemProvider a newly instantiated subclass of Plugin.
   * @returns an array of error messages. The array will be empty if the load is successful, otherwise it is a list of one or more problems.
   */
  public static register(itemProvider: BackstageItemProvider): void {
    // istanbul ignore if
    if (BackstageItemManager.getBackstageItemProvider(itemProvider.id)) {
      Logger.logInfo(loggerCategory, `BackstageItemProvider (${itemProvider.id}) is already loaded`);
    } else {
      BackstageItemManager._registeredBackstageItemProviders.set(itemProvider.id, itemProvider);
      Logger.logInfo(loggerCategory, `BackstageItemProvider (${itemProvider.id}) loaded`);
    }
    BackstageItemManager.sendRegisteredEvent({ providerId: itemProvider.id } as BackstageItemProviderRegisteredEventArgs);
  }

  /** Remove a specific BackstageItemProvider from the list of available providers. */
  public static unregister(itemProviderId: string): void {
    // istanbul ignore else
    if (BackstageItemManager.getBackstageItemProvider(itemProviderId)) {
      BackstageItemManager._registeredBackstageItemProviders.delete(itemProviderId);
      Logger.logInfo(loggerCategory, `BackstageItemProvider (${itemProviderId}) unloaded`);
    }

    BackstageItemManager.sendRegisteredEvent({ providerId: itemProviderId } as BackstageItemProviderRegisteredEventArgs);
  }

  /** Called when the application is populating backstage so that any registered BackstageItemProvider can add their own items.
   */
  public static getBackstageItemSpecs(): BackstageItemSpec[] {
    const itemSpecs: BackstageItemSpec[] = [];
    // istanbul ignore else
    if (BackstageItemManager._registeredBackstageItemProviders.size > 0) {
      BackstageItemManager._registeredBackstageItemProviders.forEach((itemProvider: BackstageItemProvider) => {
        // istanbul ignore else
        if (itemProvider.provideBackstageItems) {
          itemProvider.provideBackstageItems().forEach((spec: BackstageItemSpec) => itemSpecs.push(spec));
        }
      });
    }

    return itemSpecs;
  }

  /** Method to create JSON object for a stage launcher item */
  public static createFrontstageLauncherItemSpec(frontstageId: string, groupPriority: number, itemPriority: number, label: string, subTitle?: string, toolTip?: string, iconSpec?: string): StageLauncher {
    return (
      {
        itemType: BackstageItemType.StageLauncher,
        itemId: frontstageId,
        stageId: frontstageId,
        groupPriority,
        itemPriority,
        icon: iconSpec,
        label: UiFramework.i18n.translate(label),
        subtitle: subTitle ? UiFramework.i18n.translate(subTitle) : undefined,
        toolTip: toolTip ? UiFramework.i18n.translate(toolTip) : undefined,
      });
  }

  /** Method to create JSON object for a command launcher item */
  public static createCommandLauncherItemSpec(itemId: string, groupPriority: number, itemPriority: number, execute: () => void, label: string, subTitle?: string, toolTip?: string, iconSpec?: string): ActionItemSpec {
    return (
      {
        itemType: BackstageItemType.ActionItem,
        itemId,
        execute,
        groupPriority,
        itemPriority,
        icon: iconSpec,
        label: UiFramework.i18n.translate(label),
        subtitle: subTitle ? UiFramework.i18n.translate(subTitle) : undefined,
        toolTip: toolTip ? UiFramework.i18n.translate(toolTip) : undefined,
      });
  }

  /** Method to create JSON object for a custom backstage item */
  public static createCustomBackstageItemSpec(providerId: string, itemId: string, groupPriority: number, itemPriority: number, label: string, subTitle?: string, toolTip?: string, iconSpec?: string): CustomItemSpec {
    return (
      {
        itemType: BackstageItemType.CustomItem,
        customItemProviderId: providerId,
        itemId,
        groupPriority,
        itemPriority,
        icon: iconSpec,
        label: UiFramework.i18n.translate(label),
        subtitle: subTitle ? UiFramework.i18n.translate(subTitle) : undefined,
        toolTip: toolTip ? UiFramework.i18n.translate(toolTip) : undefined,
      });
  }

}
