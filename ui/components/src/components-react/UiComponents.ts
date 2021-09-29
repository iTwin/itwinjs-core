/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Common
 */

import { enablePatches } from "immer";
import { Logger } from "@itwin/core-bentley";
import { I18N } from "@itwin/core-i18n";
import { getClassName, UiError } from "@itwin/appui-abstract";
import { UiCore } from "@itwin/core-react";

/**
 * Manages the I18N service for the components-react package.
 * @public
 */
export class UiComponents {
  private static _initialized = false;
  private static _i18n?: I18N;

  /**
   * Registers the I18N service namespace for UiComponents. Also initializes UiCore.
   * @param i18n The internationalization service created by the application.
   */
  public static async initialize(i18n: I18N): Promise<void> {
    if (UiComponents._initialized) {
      Logger.logInfo(UiComponents.loggerCategory(UiComponents), `UiComponents.initialize already called`);
      return;
    }

    enablePatches();
    UiComponents._i18n = i18n;
    await UiComponents._i18n.registerNamespace(UiComponents.i18nNamespace).readFinished;

    await UiCore.initialize(UiComponents._i18n);
    UiComponents._initialized = true;
  }

  /** Unregisters the UiComponents I18N namespace */
  public static terminate() {
    if (UiComponents._i18n)
      UiComponents._i18n.unregisterNamespace(UiComponents.i18nNamespace);
    UiComponents._i18n = undefined;

    UiCore.terminate();
    UiComponents._initialized = false;
  }

  /** Determines if UiComponents has been initialized */
  public static get initialized(): boolean { return UiComponents._initialized; }

  /** The internationalization service created by the application. */
  public static get i18n(): I18N {
    if (!UiComponents._i18n)
      throw new UiError(UiComponents.loggerCategory(this), "i18n: UiComponents.initialize has not been called. Unable to return I18N object.");
    return UiComponents._i18n;
  }

  /** The internationalization service namespace. */
  public static get i18nNamespace(): string {
    return "UiComponents";
  }

  /** @internal */
  public static get packageName(): string {
    return "components-react";
  }

  /** Calls i18n.translateWithNamespace with the "UiComponents" namespace. Do NOT include the namespace in the key.
   * @internal
   */
  public static translate(key: string | string[]): string {
    if (!UiComponents.initialized) {
      Logger.logError(UiComponents.loggerCategory(this), `translate: UiComponents.initialize has not been called. Returning blank string.`);
      return "";
    }
    return UiComponents.i18n.translateWithNamespace(UiComponents.i18nNamespace, key);
  }

  /** @internal */
  public static loggerCategory(obj: any): string {
    const className = getClassName(obj);
    const category = UiComponents.packageName + (className ? `.${className}` : "");
    return category;
  }

}
