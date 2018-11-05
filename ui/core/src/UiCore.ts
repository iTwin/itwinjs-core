/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Utilities */

import { I18N } from "@bentley/imodeljs-i18n";

/**
 * Entry point for static initialization required by various
 * components used in the package.
 */
export default class UiCore {

  private constructor() { }

  private static _i18n?: I18N;

  public static async initialize(i18n: I18N): Promise<void> {
    UiCore._i18n = i18n;
    await UiCore._i18n.registerNamespace("UiCore").readFinished;
  }

  public static terminate() {
    UiCore._i18n = undefined;
  }

  public static get i18n(): I18N {
    if (!UiCore._i18n)
      throw new Error("UiCore not initialized");
    return UiCore._i18n;
  }

}
