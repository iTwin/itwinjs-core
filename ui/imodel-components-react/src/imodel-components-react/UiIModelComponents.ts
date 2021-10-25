/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Common
 */

import { enablePatches } from "immer";
import { Logger } from "@itwin/core-bentley";
import { IModelApp } from "@itwin/core-frontend";
import { getClassName } from "@itwin/appui-abstract";
import { UiComponents } from "@itwin/components-react";
import { EmptyLocalization } from "@itwin/core-common";

/**
 * Manages the localization service for the imodel-components-react package.
 * @public
 */
export class UiIModelComponents {
  private static _initialized = false;

  /**
   * initialize UiIModelComponents.
   */
  public static async initialize(): Promise<void> {
    if (UiIModelComponents._initialized) {
      Logger.logInfo(UiIModelComponents.loggerCategory(UiIModelComponents), `UiIModelComponents.initialize already called`);
      return;
    }

    enablePatches();
    await IModelApp.localization?.registerNamespace(UiIModelComponents.localizationNamespace);

    if (!IModelApp.localization) {
      // it should only get here in unit test where IModelApp is not setup
      const localization = new EmptyLocalization();
      await localization.initialize();
      await UiComponents.initialize(localization);
    } else {
      await UiComponents.initialize(IModelApp.localization);
    }

    UiIModelComponents._initialized = true;
  }

  /** Unregisters the UiIModelComponents localization namespace */
  public static terminate() {
    IModelApp.localization?.unregisterNamespace(UiIModelComponents.localizationNamespace);
    UiComponents.terminate();
    UiIModelComponents._initialized = false;
  }

  /** Determines if UiIModelComponents has been initialized */
  public static get initialized(): boolean { return UiIModelComponents._initialized; }

  /** The internationalization service namespace. */
  public static get localizationNamespace(): string {
    return "UiIModelComponents";
  }

  /** @internal */
  public static get packageName(): string {
    return "imodel-components-react";
  }

  /** Calls localization.getLocalizedStringWithNamespace with the "UiIModelComponents" namespace. Do NOT include the namespace in the key.
   * @internal
   */
  public static translate(key: string | string[]): string {
    if (!UiIModelComponents.initialized || /* istanbul ignore next */ !IModelApp.localization) {
      Logger.logError(UiIModelComponents.loggerCategory(this), `translate: IModelApp.localization has not been setup. Returning blank string.`);
      return "";
    }
    return IModelApp.localization.getLocalizedStringWithNamespace(UiIModelComponents.localizationNamespace, key);
  }

  /** @internal */
  public static loggerCategory(obj: any): string {
    const className = getClassName(obj);
    const category = UiIModelComponents.packageName + (className ? `.${className}` : "");
    return category;
  }

}
