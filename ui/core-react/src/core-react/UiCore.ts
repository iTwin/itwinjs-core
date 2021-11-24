/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */

/** Import color variables, layout variables and Sass classes barrel file */
import "./colorthemes.scss";
import "./colorvariables.scss";
import "./layout-variables.scss";
import "./classes.scss";

import { Logger } from "@itwin/core-bentley";
import type { Localization } from "@itwin/core-common";
import { getClassName, UiError } from "@itwin/appui-abstract";

// cSpell:ignore colorthemes colorvariables

/**
 * Manages the Localization service for the core-react package.
 * @public
 */
export class UiCore {
  private static _initialized = false;
  private static _localization?: Localization;

  /**
   * Registers the Localization service namespace for UiCore.
   * @param localization The internationalization service created by the host application.
   */
  public static async initialize(localization: Localization): Promise<void> {
    if (UiCore._initialized) {
      Logger.logInfo(UiCore.loggerCategory(UiCore), `UiCore.initialize already called`);
      return;
    }

    UiCore._localization = localization;
    await UiCore._localization.registerNamespace(UiCore.localizationNamespace);
    UiCore._initialized = true;
  }

  /** Unregisters the UiCore localization namespace */
  public static terminate() {
    if (UiCore._localization)
      UiCore._localization.unregisterNamespace(UiCore.localizationNamespace);
    UiCore._localization = undefined;

    UiCore._initialized = false;
  }

  /** Determines if UiCore has been initialized */
  public static get initialized(): boolean { return UiCore._initialized; }

  /** The internationalization service created by the host application.
   * @internal
   */
  public static get localization(): Localization {
    // istanbul ignore else
    if (!UiCore._localization)
      throw new UiError(UiCore.loggerCategory(this), "localization: UiCore.initialize has not been called. Unable to return Localization object.");
    // istanbul ignore next
    return UiCore._localization;
  }

  /** The internationalization service namespace. */
  public static get localizationNamespace(): string {
    return "UiCore";
  }

  /** Calls localization.getLocalizedStringWithNamespace with the "UiCore" namespace. Do NOT include the namespace in the key.
   * @internal
   */
  public static translate(key: string | string[]): string {
    if (!UiCore._localization) {
      Logger.logError(UiCore.loggerCategory(this), `translate: UiCore must be initialize with a localization provider. Returning blank string.`);
      return "";
    }
    return UiCore._localization.getLocalizedStringWithNamespace(UiCore.localizationNamespace, key);
  }

  /** @internal */
  public static get packageName(): string {
    return "core-react";
  }

  /** @internal */
  public static loggerCategory(obj: any): string {
    const className = getClassName(obj);
    const category = UiCore.packageName + (className ? `.${className}` : "");
    return category;
  }

}
