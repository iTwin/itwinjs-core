/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { UiItemsManager } from "@itwin/appui-abstract";
import { SampleTool } from "./tools/SampleTool";
import { ReducerRegistryInstance } from "@itwin/appui-react";
import { GenericLocateTool } from "./tools/GenericLocateTool";
import { OpenTraceDialogTool } from "./tools/OpenTraceDialogTool";
import { IModelApp } from "@itwin/core-frontend";
import { providerSlice, TestProviderSliceName } from "./store";
import { GeneralUiItemsProvider } from "./ui/providers/GeneralUiItemsProvider";
import { OpenAbstractDialogTool } from "./tools/OpenAbstractModalDialogTool";
import { NetworkTracingFrontstage } from "./ui/frontstages/NetworkTracing";
import { CustomFrontstage } from "./ui/frontstages/CustomContent";

/** UiItemsProvidersTest is a package that augments the user interface components for an iModelApp. When the package's
 * initialize method is called tools, frontstages and UiItemProviders are registered.
 */
export class UiItemsProvidersTest {
  private static _initialized = false;
  /** We'll register the `uiItemsProvidersTest` as the package's namespace. The matching file `uiItemsProvidersTest.json`
   * found in `src/public/locales/en` with contain the keys and matching localized string for English.  */
  public static readonly localizationNamespace = "uiItemsProvidersTest";

  /** convenience method for getting localized strings from keys */
  public static translate(key: string) {
    return IModelApp.localization.getLocalizedString(
      `${UiItemsProvidersTest.localizationNamespace}:${key}`
    );
  }

  /** The uiProvider will add a tool to the Toolbar and an item to the StatusBar in the host app */
  private static registerUiComponents(): void {
    SampleTool.register(UiItemsProvidersTest.localizationNamespace);
    GenericLocateTool.register(UiItemsProvidersTest.localizationNamespace);
    OpenTraceDialogTool.register(UiItemsProvidersTest.localizationNamespace);
    OpenAbstractDialogTool.register(UiItemsProvidersTest.localizationNamespace);

    // register new frontstages and it's stage specific items provider
    NetworkTracingFrontstage.register();
    CustomFrontstage.register();

    // register to add items to "General" usage stages"
    UiItemsManager.register(new GeneralUiItemsProvider());
  }

  public static async initialize(): Promise<void> {
    if (this._initialized)
      return;

    /** Register the localized strings namespace. See `translate` method above. */
    await IModelApp.localization.registerNamespace(UiItemsProvidersTest.localizationNamespace);
    this.registerUiComponents();
    this._initialized = true;

    /** Register a slice of state into the iModelApp Redux store. */
    ReducerRegistryInstance.registerReducer(TestProviderSliceName, providerSlice.reducer);
  }
}
