/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Utilities */

import { I18N, TranslationOptions } from "@bentley/imodeljs-i18n";

import { UiError } from "./utils/UiError";
import { getClassName } from "./utils/getClassName";

/**
 * Entry point for static initialization required by various components used in the package.
 * @public
 */
export class UiAbstract {

  private static _i18n?: I18N;

  /**
   * Called by IModelApp to initialize the UiAbstract
   * @param i18n The internationalization service created by the IModelApp.
   */
  public static async initialize(i18n: I18N): Promise<void> {
    UiAbstract._i18n = i18n;
    await UiAbstract._i18n.registerNamespace(UiAbstract.i18nNamespace).readFinished;
  }

  /** Unregisters the UiAbstract internationalization service namespace */
  public static terminate() {
    if (UiAbstract._i18n)
      UiAbstract._i18n.unregisterNamespace(UiAbstract.i18nNamespace);
    UiAbstract._i18n = undefined;
  }

  /** The internationalization service created by the IModelApp. */
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
