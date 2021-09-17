/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Common
 */

import { enablePatches } from "immer";
import { Logger } from "@bentley/bentleyjs-core";
import { LocalizationProvider } from "@bentley/imodeljs-i18n";
import { getClassName, UiError } from "@bentley/ui-abstract";
import { UiCore } from "@bentley/ui-core";

/**
 * Manages the I18N service for the ui-components package.
 * @public
 */
export class UiComponents {
  private static _initialized = false;
  private static _localizationProvider?: LocalizationProvider;

  /**
   * Registers the LocalizationProvider service namespace for UiComponents. Also initializes UiCore.
   * @param localizationProvider The internationalization service created by the application.
   */
  public static async initialize(localizationProvider: LocalizationProvider): Promise<void> {
    if (UiComponents._initialized) {
      Logger.logInfo(UiComponents.loggerCategory(UiComponents), `UiComponents.initialize already called`);
      return;
    }

    enablePatches();
    UiComponents._localizationProvider = localizationProvider;
    await UiComponents._localizationProvider.registerNamespace(UiComponents.localizationNamespace)?.readFinished;

    await UiCore.initialize(UiComponents._localizationProvider);
    UiComponents._initialized = true;
  }

  /** Unregisters the UiComponents localization namespace */
  public static terminate() {
    if (UiComponents._localizationProvider)
      UiComponents._localizationProvider.unregisterNamespace(UiComponents.localizationNamespace);
    UiComponents._localizationProvider = undefined;

    UiCore.terminate();
    UiComponents._initialized = false;
  }

  /** Determines if UiComponents has been initialized */
  public static get initialized(): boolean { return UiComponents._initialized; }

  /** The internationalization service created by the application. */
  public static get localizationProvider(): LocalizationProvider {
    if (!UiComponents._localizationProvider)
      throw new UiError(UiComponents.loggerCategory(this), "i18n: UiComponents.initialize has not been called. Unable to return LocalizationProvider object.");
    return UiComponents._localizationProvider;
  }

  /** The internationalization service namespace. */
  public static get localizationNamespace(): string {
    return "UiComponents";
  }

  /** @internal */
  public static get packageName(): string {
    return "ui-components";
  }

  /** Calls localizationProvider.getLocalizedStringWithNamespace with the "UiComponents" namespace. Do NOT include the namespace in the key.
   * @internal
   */
  public static translate(key: string | string[]): string {
    if (!UiComponents.initialized || UiComponents._localizationProvider === undefined) {
      Logger.logError(UiComponents.loggerCategory(this), `translate: UiComponents.initialize has not been called. Returning blank string.`);
      return "";
    }
    return UiComponents._localizationProvider.getLocalizedStringWithNamespace(UiComponents.localizationNamespace, key);
  }

  /** @internal */
  public static loggerCategory(obj: any): string {
    const className = getClassName(obj);
    const category = UiComponents.packageName + (className ? `.${className}` : "");
    return category;
  }

}
