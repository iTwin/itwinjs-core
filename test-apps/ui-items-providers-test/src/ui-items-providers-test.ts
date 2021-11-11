/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { UiItemsManager } from "@itwin/appui-abstract";
import { SampleTool } from "./tools/SampleTool";
import { ConfigurableUiManager, ReducerRegistryInstance } from "@itwin/appui-react";
import { SampleContentControl } from "./ui/content/SampleContentControl";
import { GenericTool } from "./tools/GenericTool";
import { OpenTraceDialogTool } from "./tools/OpenTraceDialogTool";
import { IModelApp } from "@itwin/core-frontend";
import { providerSlice, TestProviderSliceName } from "./store";
import { ExtensionUiItemsProvider } from "./ui/providers/ExtensionUiItemsProvider";
import { OpenAbstractDialogTool } from "./tools/OpenAbstractModalDialogTool";
import { NetworkTracingFrontstage } from "./ui/frontstages/NetworkTracing";

/** UiItemsProvidersTest is an iModel.js Extension that adds some user interface to the iModel.js app into which its loaded.
 * Included in the sample are: 1) a Sample Tool (SampleTool.ts), showing how implement a tool with a variety to tool settings items.
 *                             2) a StatusBarItem (created in ExtensionUiItemsProvider.provideStatusBarItems()) that opens a modal dialog when clicked.
 *
 * Both the SampleTool and the modal dialog opened from the StatusBarItem (UnitsPopup.tsx) use the UiLayoutDataProvider to generate
 * react code from an array of DialogItem interfaces.
 *
 * For more information about Extensions, see Extension in the iModel.js documentation. *
 */
export class UiItemsProvidersTest {
  private static _initialized = false;
  /** We'll register the uiItemsProvidersTest.json as the Extension's namespace/ */
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
    GenericTool.register(UiItemsProvidersTest.localizationNamespace);
    OpenTraceDialogTool.register(UiItemsProvidersTest.localizationNamespace);
    OpenAbstractDialogTool.register(UiItemsProvidersTest.localizationNamespace);

    // register new front stage and it's stage specific items provider
    NetworkTracingFrontstage.register();

    ConfigurableUiManager.registerControl("SampleExtensionContentControl", SampleContentControl);

    // register to add items to "General" usage stages"
    UiItemsManager.register(new ExtensionUiItemsProvider());
    // UiItemsManager.register(new NetworkTraceUiProvider());
  }

  public static async initialize(): Promise<void> {
    if (this._initialized)
      return;

    /** Register the localized strings for this extension
     * We'll pass the localization member to the rest of the classes in the Extension to allow them to translate strings in the UI they implement.
     */
    await IModelApp.localization.registerNamespace(UiItemsProvidersTest.localizationNamespace);
    this.registerUiComponents();
    this._initialized = true;

    ReducerRegistryInstance.registerReducer(TestProviderSliceName, providerSlice.reducer);
  }
}
