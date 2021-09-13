/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */

import { Logger } from "@bentley/bentleyjs-core";
import { LocalizationProvider } from "@bentley/imodeljs-i18n";
import { MessagePresenter } from "./notification/MessagePresenter";
import { getClassName } from "./utils/getClassName";
import { UiError } from "./utils/UiError";

/**
 * Entry point for static initialization required by various components used in the package.
 * @public
 */
export class UiAbstract {
  private static _initialized = false;
  private static _localizationProvider?: LocalizationProvider;
  private static _messagePresenter?: MessagePresenter;

  /**
   * Registers the I18N service namespace for UiAbstract
   * @param i18n The internationalization service created by the application.
   */
  public static async initialize(localizationProvider: LocalizationProvider): Promise<void> {
    if (UiAbstract._initialized) {
      Logger.logInfo(UiAbstract.loggerCategory(UiAbstract), `UiAbstract.initialize already called`);
      return;
    }

    UiAbstract._localizationProvider = localizationProvider;
    await UiAbstract._localizationProvider.registerNamespace(UiAbstract.i18nNamespace)?.readFinished;
    UiAbstract._initialized = true;
  }

  /** Unregisters the UiAbstract internationalization service namespace */
  public static terminate() {
    if (UiAbstract._localizationProvider)
      UiAbstract._localizationProvider.unregisterNamespace(UiAbstract.i18nNamespace);
    UiAbstract._localizationProvider = undefined;
    UiAbstract._initialized = false;
  }

  /** Determines if UiAbstract has been initialized */
  public static get initialized(): boolean { return UiAbstract._initialized; }

  /** The internationalization service created by the application. */
  public static get localizationProvider(): LocalizationProvider {
    if (!UiAbstract._localizationProvider)
      throw new UiError(UiAbstract.loggerCategory(this), "UiAbstract not initialized");
    return UiAbstract._localizationProvider;
  }

  /** The internationalization service namespace. */
  public static get i18nNamespace(): string {
    return "UiAbstract";
  }

  /** Calls i18n.translateWithNamespace with the "UiAbstract" namespace. Do NOT include the namespace in the key.
   * @internal
   */
  public static translate(key: string | string[]): string {
    if (!UiAbstract._localizationProvider)
      throw new UiError(UiAbstract.loggerCategory(this), "UiAbstract not initialized");
    return UiAbstract._localizationProvider.getLocalizedStringWithNamespace(UiAbstract.i18nNamespace, key);
  }

  /** @internal */
  public static get packageName(): string {
    return "ui-abstract";
  }

  /** @internal */
  public static loggerCategory(obj: any): string {
    const className = getClassName(obj);
    const category = UiAbstract.packageName + (className ? `.${className}` : "");
    return category;
  }

  /** The MessagePresenter used to display messages. */
  public static get messagePresenter(): MessagePresenter {
    if (!UiAbstract._messagePresenter)
      throw new UiError(UiAbstract.loggerCategory(this), "UiAbstract.MessagePresenter not set");
    return UiAbstract._messagePresenter;
  }
  public static set messagePresenter(mp: MessagePresenter) {
    UiAbstract._messagePresenter = mp;
  }

}
