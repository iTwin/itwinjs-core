/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Utilities */

import { I18N } from "@bentley/imodeljs-i18n";

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

  public static async initialize(i18n: I18N): Promise<void> {
    UiCore._i18n = i18n;
    await UiCore._i18n.registerNamespace("UiCore").readFinished;
  }

  public static terminate() {
    if (UiCore._i18n)
      UiCore._i18n.unregisterNamespace("UiCore");
    UiCore._i18n = undefined;
  }

  public static get i18n(): I18N {
    if (!UiCore._i18n)
      throw new Error("UiCore not initialized");
    return UiCore._i18n;
  }

}
