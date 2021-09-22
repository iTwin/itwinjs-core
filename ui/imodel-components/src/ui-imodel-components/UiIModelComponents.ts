/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Common
 */

import { enablePatches } from "immer";
import { Logger } from "@bentley/bentleyjs-core";
import { IModelApp } from "@bentley/imodeljs-frontend";
import { LocalizationClient } from "@bentley/imodeljs-common";
import { getClassName, UiError } from "@bentley/ui-abstract";
import { UiComponents } from "@bentley/ui-components";

/**
 * Manages the I18N service for the ui-imodel-components package.
 * @public
 */
export class UiIModelComponents {
  private static _initialized = false;
  private static _localizationClient?: LocalizationClient;

  /**
   * Registers the I18N service namespace for UiIModelComponents. Also initializes UiCore.
   * @param localizationClient The internationalization service created by the application. Defaults to IModelApp.i18n.
   */
  public static async initialize(localizationClient?: LocalizationClient): Promise<void> {
    if (UiIModelComponents._initialized) {
      Logger.logInfo(UiIModelComponents.loggerCategory(UiIModelComponents), `UiIModelComponents.initialize already called`);
      return;
    }

    enablePatches();
    UiIModelComponents._localizationClient = localizationClient || IModelApp.localizationClient;
    await UiIModelComponents._localizationClient.registerNamespace(UiIModelComponents.localizationNamespace);

    await UiComponents.initialize(UiIModelComponents._localizationClient);
    UiIModelComponents._initialized = true;
  }

  /** Unregisters the UiIModelComponents I18N namespace */
  public static terminate() {
    if (UiIModelComponents._localizationClient)
      UiIModelComponents._localizationClient.unregisterNamespace(UiIModelComponents.localizationNamespace);
    UiIModelComponents._localizationClient = undefined;

    UiComponents.terminate();
    UiIModelComponents._initialized = false;
  }

  /** Determines if UiIModelComponents has been initialized */
  public static get initialized(): boolean { return UiIModelComponents._initialized; }

  /** The internationalization service created by the application. */
  public static get localizationClient(): LocalizationClient {
    if (!UiIModelComponents._localizationClient)
      throw new UiError(UiIModelComponents.loggerCategory(this), "i18n: UiIModelComponents.initialize has not been called. Unable to return LocalizationClient object.");
    return UiIModelComponents._localizationClient;
  }

  /** The internationalization service namespace. */
  public static get localizationNamespace(): string {
    return "UiIModelComponents";
  }

  /** @internal */
  public static get packageName(): string {
    return "ui-imodel-components";
  }

  /** Calls i18n.translateWithNamespace with the "UiIModelComponents" namespace. Do NOT include the namespace in the key.
   * @internal
   */
  public static translate(key: string | string[]): string {
    if (!UiIModelComponents.initialized) {
      Logger.logError(UiIModelComponents.loggerCategory(this), `translate: UiIModelComponents.initialize has not been called. Returning blank string.`);
      return "";
    }
    return UiIModelComponents.localizationClient.getLocalizedStringWithNamespace(UiIModelComponents.localizationNamespace, key);
  }

  /** @internal */
  public static loggerCategory(obj: any): string {
    const className = getClassName(obj);
    const category = UiIModelComponents.packageName + (className ? `.${className}` : "");
    return category;
  }

}
