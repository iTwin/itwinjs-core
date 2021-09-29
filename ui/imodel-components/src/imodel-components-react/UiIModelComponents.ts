/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Common
 */

import { enablePatches } from "immer";
import { Logger } from "@itwin/core-bentley";
import { IModelApp } from "@itwin/core-frontend";
import { I18N } from "@itwin/core-i18n";
import { getClassName, UiError } from "@itwin/appui-abstract";
import { UiComponents } from "@itwin/components-react";

/**
 * Manages the I18N service for the imodel-components-react package.
 * @public
 */
export class UiIModelComponents {
  private static _initialized = false;
  private static _i18n?: I18N;

  /**
   * Registers the I18N service namespace for UiIModelComponents. Also initializes UiCore.
   * @param i18n The internationalization service created by the application. Defaults to IModelApp.i18n.
   */
  public static async initialize(i18n?: I18N): Promise<void> {
    if (UiIModelComponents._initialized) {
      Logger.logInfo(UiIModelComponents.loggerCategory(UiIModelComponents), `UiIModelComponents.initialize already called`);
      return;
    }

    enablePatches();
    UiIModelComponents._i18n = i18n || IModelApp.i18n;
    await UiIModelComponents._i18n.registerNamespace(UiIModelComponents.i18nNamespace).readFinished;

    await UiComponents.initialize(UiIModelComponents._i18n);
    UiIModelComponents._initialized = true;
  }

  /** Unregisters the UiIModelComponents I18N namespace */
  public static terminate() {
    if (UiIModelComponents._i18n)
      UiIModelComponents._i18n.unregisterNamespace(UiIModelComponents.i18nNamespace);
    UiIModelComponents._i18n = undefined;

    UiComponents.terminate();
    UiIModelComponents._initialized = false;
  }

  /** Determines if UiIModelComponents has been initialized */
  public static get initialized(): boolean { return UiIModelComponents._initialized; }

  /** The internationalization service created by the application. */
  public static get i18n(): I18N {
    if (!UiIModelComponents._i18n)
      throw new UiError(UiIModelComponents.loggerCategory(this), "i18n: UiIModelComponents.initialize has not been called. Unable to return I18N object.");
    return UiIModelComponents._i18n;
  }

  /** The internationalization service namespace. */
  public static get i18nNamespace(): string {
    return "UiIModelComponents";
  }

  /** @internal */
  public static get packageName(): string {
    return "imodel-components-react";
  }

  /** Calls i18n.translateWithNamespace with the "UiIModelComponents" namespace. Do NOT include the namespace in the key.
   * @internal
   */
  public static translate(key: string | string[]): string {
    if (!UiIModelComponents.initialized) {
      Logger.logError(UiIModelComponents.loggerCategory(this), `translate: UiIModelComponents.initialize has not been called. Returning blank string.`);
      return "";
    }
    return UiIModelComponents.i18n.translateWithNamespace(UiIModelComponents.i18nNamespace, key);
  }

  /** @internal */
  public static loggerCategory(obj: any): string {
    const className = getClassName(obj);
    const category = UiIModelComponents.packageName + (className ? `.${className}` : "");
    return category;
  }

}
