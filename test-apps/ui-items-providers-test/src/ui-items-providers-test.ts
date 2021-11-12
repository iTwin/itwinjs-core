/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { UiItemsManager } from "@itwin/appui-abstract";
import { SampleTool } from "./tools/SampleTool";
import { ReducerRegistryInstance } from "@itwin/appui-react";
// import { SampleContentControl } from "./ui/content/SampleContentControl";
import { GenericLocateTool } from "./tools/GenericLocateTool";
import { OpenTraceDialogTool } from "./tools/OpenTraceDialogTool";
import { IModelApp } from "@itwin/core-frontend";
import { providerSlice, TestProviderSliceName } from "./store";
import { GeneralUiItemsProvider } from "./ui/providers/GeneralUiItemsProvider";
import { OpenAbstractDialogTool } from "./tools/OpenAbstractModalDialogTool";
import { NetworkTracingFrontstage } from "./ui/frontstages/NetworkTracing";
import { CustomFrontstage } from "./ui/frontstages/CustomContent";

/** UiItemsProvidersTest is a package that adds some user interface to the iModelApp when its initialize method is called.
 * Included in the sample are:
 *   1) `SampleTool` showing how implement a tool with a variety to tool settings items.
 *   2) `GenericLocateTool` that shows how implement a tool that requires user to first locate an element.
 *   3) `OpenAbstractDialogTool` that shows how to generate a dialog without creating "react" components.
 *   4) `GeneralUiItemsProvider` that provide tool buttons and a status bar item to stages set usage set to "StageUsage.General"
 *   5) `NetworkTracingFrontstage` that defines a new stage to add to iModelApp.
 *   6) `NetworkTracingUiItemsProvider` that provide tool buttons and widgets to NetworkTracingFrontstage.
 *   7) `TestProviderState` that define package specific state properties to add to the apps Redux store.
 *   8) `CustomFrontstage` that define a frontstage the show an imodel view and a custom content view populated via `SampleCustomContent`
 *
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

    /** Register the localized strings for this extension
     * We'll pass the localization member to the rest of the classes in the Extension to allow them to translate strings in the UI they implement.
     */
    await IModelApp.localization.registerNamespace(UiItemsProvidersTest.localizationNamespace);
    this.registerUiComponents();
    this._initialized = true;

    ReducerRegistryInstance.registerReducer(TestProviderSliceName, providerSlice.reducer);
  }
}
