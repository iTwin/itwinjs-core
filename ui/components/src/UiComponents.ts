/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Common */

import { I18N } from "@bentley/imodeljs-i18n";

/**
 * Entry point for static initialization required by various
 * components used in the package.
 */
export default class UiComponents {

  private constructor() { }

  private static _i18n?: I18N;

  public static async initialize(i18n: I18N): Promise<void> {
    UiComponents._i18n = i18n;
    await UiComponents._i18n.registerNamespace("UiComponents").readFinished;
    return Promise.resolve();
  }

  public static terminate() {
    UiComponents._i18n = undefined;
  }

  public static get i18n(): I18N {
    if (!UiComponents._i18n)
      throw new Error("UiComponents not initialized");
    return UiComponents._i18n;
  }

}
