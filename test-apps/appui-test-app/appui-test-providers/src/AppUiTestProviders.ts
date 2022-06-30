/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ReducerRegistryInstance } from "@itwin/appui-react";
import { IModelApp } from "@itwin/core-frontend";
import { providerSlice, TestProviderSliceName } from "./store";

/** AppUiTestProviders is a package that augments the user interface components for an iModelApp. When the package's
 * initialize method is called tools, frontstages and UiItemProviders are registered.
 */
export class AppUiTestProviders {
  public static readonly localizationNamespace = "appuiTestProviders";

  public static syncEventIdHideCustomDialogButton = "appui-test-providers:sync-custom-dialog-button";
  public static syncEventIdHideCustomViewOverlay = "appui-test-providers:sync-custom-view-overlay-button";

  /** convenience method for getting localized strings from keys */
  public static translate(key: string) {
    return IModelApp.localization.getLocalizedString(
      `${AppUiTestProviders.localizationNamespace}:${key}`
    );
  }

  public static async initializeLocalizationAndState() {
    /** We'll register the `appuiTestProviders` as the package's namespace. The matching file `appuiTestProviders.json`
      * found in `src/public/locales/en` with contain the keys and matching localized string for English.  */
    await IModelApp.localization.registerNamespace(AppUiTestProviders.localizationNamespace);

    /** Register a slice of state into the iModelApp Redux store. - this should only be called once */
    ReducerRegistryInstance.registerReducer(TestProviderSliceName, providerSlice.reducer);
  }
}
