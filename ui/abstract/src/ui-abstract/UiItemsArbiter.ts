/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module UiItemsProvider
 */

import { Logger } from "@bentley/bentleyjs-core";
import { BackstageItem } from "./backstage/BackstageItem";
import { CommonStatusBarItem } from "./statusbar/StatusBarItem";
import { CommonToolbarItem } from "./toolbars/ToolbarItem";
import { UiAbstract } from "./UiAbstract";
import { UiItemsApplicationAction, UiItemsManager } from "./UiItemsManager";
import { AbstractWidgetProps } from "./widget/AbstractWidgetProps";

/** Application for items provided by a UiItemsProvider
 * @beta
 */
export interface UiItemsApplication {
  /** Validate and optionally update a Toolbar button item */
  validateToolbarButtonItem?: (item: CommonToolbarItem) => { updatedItem: CommonToolbarItem, action: UiItemsApplicationAction };
  /** Validate and optionally update a StatusBar item */
  validateStatusBarItem?: (item: CommonStatusBarItem) => { updatedItem: CommonStatusBarItem, action: UiItemsApplicationAction };
  /** Validate and optionally update a Backstage item */
  validateBackstageItem?: (item: BackstageItem) => { updatedItem: BackstageItem, action: UiItemsApplicationAction };
  /** Validate and optionally update a Widget */
  validateWidget?: (widget: AbstractWidgetProps) => { updatedWidget: AbstractWidgetProps, action: UiItemsApplicationAction };
}

/** Arbitrates between the [[UiItemsApplication]] and a [[UiItemsProvider]]
 * @beta
 */
export class UiItemsArbiter {
  private static _uiItemsApplication?: UiItemsApplication;

  /** The UiItemsApplication implementation. The application should set this to validate items from the extensions. */
  public static get uiItemsApplication(): UiItemsApplication | undefined { return UiItemsArbiter._uiItemsApplication; }
  public static set uiItemsApplication(app: UiItemsApplication | undefined) {
    // uiItemsApplication can only be set once
    if (UiItemsArbiter._uiItemsApplication === undefined)
      UiItemsArbiter._uiItemsApplication = app;
    else
      Logger.logError(UiAbstract.loggerCategory(this), `uiItemsApplication can only be set once`);
  }

  /** @internal */
  public static clearApplication(): void {
    UiItemsArbiter._uiItemsApplication = undefined;
  }

  /** @internal */
  public static updateToolbarButtonItems(items: ReadonlyArray<CommonToolbarItem>): ReadonlyArray<CommonToolbarItem> {
    let returnedItems = items;

    // istanbul ignore else
    if (UiItemsArbiter.uiItemsApplication && UiItemsArbiter.uiItemsApplication.validateToolbarButtonItem) {
      const updatedItems: CommonToolbarItem[] = [];

      items.forEach((item) => {
        const { updatedItem, action } = UiItemsArbiter.uiItemsApplication!.validateToolbarButtonItem!(item);
        if ((UiItemsApplicationAction.Allow === action || UiItemsApplicationAction.Update === action) && updatedItem) {
          updatedItems.push(updatedItem);
        }

        if ((UiItemsApplicationAction.Update === action || UiItemsApplicationAction.Disallow === action) && updatedItem && item.providerId) {
          const uiProvider = UiItemsManager.getUiItemsProvider(item.providerId);
          // istanbul ignore else
          if (uiProvider && uiProvider.onToolbarButtonItemArbiterChange)
            uiProvider.onToolbarButtonItemArbiterChange(updatedItem, action);
        }
      });

      returnedItems = updatedItems;
    }

    return returnedItems;
  }

  /** @internal */
  public static updateStatusBarItems(items: ReadonlyArray<CommonStatusBarItem>): ReadonlyArray<CommonStatusBarItem> {
    let returnedItems = items;

    // istanbul ignore else
    if (UiItemsArbiter.uiItemsApplication && UiItemsArbiter.uiItemsApplication.validateStatusBarItem) {
      const updatedItems: CommonStatusBarItem[] = [];

      items.forEach((item) => {
        const { updatedItem, action } = UiItemsArbiter.uiItemsApplication!.validateStatusBarItem!(item);
        if ((UiItemsApplicationAction.Allow === action || UiItemsApplicationAction.Update === action) && updatedItem) {
          updatedItems.push(updatedItem);
        }

        if ((UiItemsApplicationAction.Update === action || UiItemsApplicationAction.Disallow === action) && updatedItem && item.providerId) {
          const uiProvider = UiItemsManager.getUiItemsProvider(item.providerId);
          // istanbul ignore else
          if (uiProvider && uiProvider.onStatusBarItemArbiterChange)
            uiProvider.onStatusBarItemArbiterChange(updatedItem, action);
        }
      });

      returnedItems = updatedItems;
    }

    return returnedItems;
  }

  /** @internal */
  public static updateBackstageItems(items: ReadonlyArray<BackstageItem>): ReadonlyArray<BackstageItem> {
    let returnedItems = items;

    // istanbul ignore else
    if (UiItemsArbiter.uiItemsApplication && UiItemsArbiter.uiItemsApplication.validateBackstageItem) {
      const updatedItems: BackstageItem[] = [];

      items.forEach((item) => {
        const { updatedItem, action } = UiItemsArbiter.uiItemsApplication!.validateBackstageItem!(item);
        if ((UiItemsApplicationAction.Allow === action || UiItemsApplicationAction.Update === action) && updatedItem) {
          updatedItems.push(updatedItem);
        }

        if ((UiItemsApplicationAction.Update === action || UiItemsApplicationAction.Disallow === action) && updatedItem && item.providerId) {
          const uiProvider = UiItemsManager.getUiItemsProvider(item.providerId);
          // istanbul ignore else
          if (uiProvider && uiProvider.onBackstageItemArbiterChange)
            uiProvider.onBackstageItemArbiterChange(updatedItem, action);
        }
      });

      returnedItems = updatedItems;
    }

    return returnedItems;
  }

  /** @internal */
  public static updateWidgets(widgets: ReadonlyArray<AbstractWidgetProps>): ReadonlyArray<AbstractWidgetProps> {
    let returnedWidgets = widgets;

    // istanbul ignore else
    if (UiItemsArbiter.uiItemsApplication && UiItemsArbiter.uiItemsApplication.validateWidget) {
      const updatedWidgets: AbstractWidgetProps[] = [];

      widgets.forEach((widget) => {
        const { updatedWidget, action } = UiItemsArbiter.uiItemsApplication!.validateWidget!(widget);
        if ((UiItemsApplicationAction.Allow === action || UiItemsApplicationAction.Update === action) && updatedWidget) {
          updatedWidgets.push(updatedWidget);
        }

        if ((UiItemsApplicationAction.Update === action || UiItemsApplicationAction.Disallow === action) && updatedWidget && widget.providerId) {
          const uiProvider = UiItemsManager.getUiItemsProvider(widget.providerId);
          // istanbul ignore else
          if (uiProvider && uiProvider.onWidgetArbiterChange)
            uiProvider.onWidgetArbiterChange(updatedWidget, action);
        }
      });

      returnedWidgets = updatedWidgets;
    }

    return returnedWidgets;
  }

}
