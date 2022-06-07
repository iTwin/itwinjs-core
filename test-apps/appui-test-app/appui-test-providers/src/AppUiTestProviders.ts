/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { IModelApp } from "@itwin/core-frontend";

/** AppUiTestProviders is a package that augments the user interface components for an iModelApp. When the package's
 * initialize method is called tools, frontstages and UiItemProviders are registered.
 */
export class AppUiTestProviders {
  private static _initialized = false;
  /** We'll register the `appuiTestProviders` as the package's namespace. The matching file `appuiTestProviders.json`
   * found in `src/public/locales/en` with contain the keys and matching localized string for English.  */
  public static readonly localizationNamespace = "appuiTestProviders";

  /** convenience method for getting localized strings from keys */
  public static translate(key: string) {
    return IModelApp.localization.getLocalizedString(
      `${AppUiTestProviders.localizationNamespace}:${key}`
    );
  }
}

