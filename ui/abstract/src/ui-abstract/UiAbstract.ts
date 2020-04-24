/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */

import { Logger } from "@bentley/bentleyjs-core";
import { I18N, TranslationOptions } from "@bentley/imodeljs-i18n";

import { UiError } from "./utils/UiError";
import { getClassName } from "./utils/getClassName";

/**
 * Entry point for static initialization required by various components used in the package.
 * @public
 */
export class UiAbstract {
  private static _initialized = false;
  private static _i18n?: I18N;

  /**
   * Registers the I18N service namespace for UiAbstract
   * @param i18n The internationalization service created by the application.
   */
  public static async initialize(i18n: I18N): Promise<void> {
    if (UiAbstract._initialized) {
      Logger.logInfo(UiAbstract.loggerCategory(UiAbstract), `UiAbstract.initialize already called`);
      return;
    }

    UiAbstract._i18n = i18n;
    await UiAbstract._i18n.registerNamespace(UiAbstract.i18nNamespace).readFinished;
    UiAbstract._initialized = true;
  }

  /** Unregisters the UiAbstract internationalization service namespace */
  public static terminate() {
    if (UiAbstract._i18n)
      UiAbstract._i18n.unregisterNamespace(UiAbstract.i18nNamespace);
    UiAbstract._i18n = undefined;
    UiAbstract._initialized = false;
  }

  /** Determines if UiAbstract has been initialized */
  public static get initialized(): boolean { return UiAbstract._initialized; }

  /** The internationalization service created by the application. */
  public static get i18n(): I18N {
    if (!UiAbstract._i18n)
      throw new UiError(UiAbstract.loggerCategory(this), "UiAbstract not initialized");
    return UiAbstract._i18n;
  }

  /** The internationalization service namespace. */
  public static get i18nNamespace(): string {
    return "UiAbstract";
  }

  /** Calls i18n.translateWithNamespace with the "UiAbstract" namespace. Do NOT include the namespace in the key.
   * @internal
   */
  public static translate(key: string | string[], options?: TranslationOptions): string {
    return UiAbstract.i18n.translateWithNamespace(UiAbstract.i18nNamespace, key, options);
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

}
