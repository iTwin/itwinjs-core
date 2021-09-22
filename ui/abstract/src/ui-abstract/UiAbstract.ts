/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */

import { Logger } from "@bentley/bentleyjs-core";
import { LocalizationClient } from "@bentley/imodeljs-common";
import { MessagePresenter } from "./notification/MessagePresenter";
import { getClassName } from "./utils/getClassName";
import { UiError } from "./utils/UiError";

/**
 * Entry point for static initialization required by various components used in the package.
 * @public
 */
export class UiAbstract {
  private static _initialized = false;
  private static _localizationClient?: LocalizationClient;
  private static _messagePresenter?: MessagePresenter;

  /**
   * Registers the I18N service namespace for UiAbstract
   * @param i18n The internationalization service created by the application.
   */
  public static async initialize(localizationClient: LocalizationClient): Promise<void> {
    if (UiAbstract._initialized) {
      Logger.logInfo(UiAbstract.loggerCategory(UiAbstract), `UiAbstract.initialize already called`);
      return;
    }

    UiAbstract._localizationClient = localizationClient;
    await UiAbstract._localizationClient.registerNamespace(UiAbstract.localizationNamespace);
    UiAbstract._initialized = true;
  }

  /** Unregisters the UiAbstract internationalization service namespace */
  public static terminate() {
    if (UiAbstract._localizationClient)
      UiAbstract._localizationClient.unregisterNamespace(UiAbstract.localizationNamespace);
    UiAbstract._localizationClient = undefined;
    UiAbstract._initialized = false;
  }

  /** Determines if UiAbstract has been initialized */
  public static get initialized(): boolean { return UiAbstract._initialized; }

  /** The internationalization service created by the application. */
  public static get localizationClient(): LocalizationClient {
    if (!UiAbstract._localizationClient)
      throw new UiError(UiAbstract.loggerCategory(this), "UiAbstract not initialized");
    return UiAbstract._localizationClient;
  }

  /** The internationalization service namespace. */
  public static get localizationNamespace(): string {
    return "UiAbstract";
  }

  /** Calls i18n.translateWithNamespace with the "UiAbstract" namespace. Do NOT include the namespace in the key.
   * @internal
   */
  public static translate(key: string | string[]): string {
    if (!UiAbstract._localizationClient)
      throw new UiError(UiAbstract.loggerCategory(this), "UiAbstract not initialized");
    return UiAbstract._localizationClient.getLocalizedStringWithNamespace(UiAbstract.localizationNamespace, key);
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
