/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */

import { I18N, TranslationOptions } from "@bentley/imodeljs-i18n";
import { UiError, getClassName, UiAbstract } from "@bentley/ui-abstract";

/** Import color themes and Sass classes barrel file */
import "./colorthemes.scss";
import "./classes.scss";

/**
 * Entry point for static initialization required by various
 * components used in the package.
 * @public
 */
export class UiCore {

  private static _i18n?: I18N;

  /**
   * Called by IModelApp to initialize the UiCore
   * @param i18n The internationalization service created by the IModelApp.
   */
  public static async initialize(i18n: I18N): Promise<void> {
    UiCore._i18n = i18n;
    await UiCore._i18n.registerNamespace(UiCore.i18nNamespace).readFinished;
    await UiAbstract.initialize(i18n);
  }

  /** Unregisters the UiCore internationalization service namespace */
  public static terminate() {
    if (UiCore._i18n)
      UiCore._i18n.unregisterNamespace(UiCore.i18nNamespace);
    UiCore._i18n = undefined;
    UiAbstract.terminate();
  }

  /** The internationalization service created by the IModelApp. */
  public static get i18n(): I18N {
    if (!UiCore._i18n)
      throw new UiError(UiCore.loggerCategory(this), "UiCore not initialized");
    return UiCore._i18n;
  }

  /** The internationalization service namespace. */
  public static get i18nNamespace(): string {
    return "UiCore";
  }

  /** Calls i18n.translateWithNamespace with the "UiCore" namespace. Do NOT include the namespace in the key.
   * @internal
   */
  public static translate(key: string | string[], options?: TranslationOptions): string {
    return UiCore.i18n.translateWithNamespace(UiCore.i18nNamespace, key, options);
  }

  /** @internal */
  public static get packageName(): string {
    return "ui-core";
  }

  /** @internal */
  public static loggerCategory(obj: any): string {
    const className = getClassName(obj);
    const category = UiCore.packageName + (className ? `.${className}` : "");
    return category;
  }

}
