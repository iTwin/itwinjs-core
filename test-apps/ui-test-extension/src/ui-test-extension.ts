/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ExtensionUiItemsProvider } from "./ui/ExtensionUiItemsProvider";
import { TraceUiItemsProvider } from "./ui/NetworkTraceUIProvider";
import { UiItemsManager } from "@itwin/appui-abstract";
import { SampleTool } from "./ui/tools/SampleTool";
import { ConfigurableUiManager } from "@itwin/appui-react";
import { ExtensionFrontstage } from "./ui/Frontstage";
import { SampleContentControl } from "./ui/content/SampleContentControl";
import { GenericTool } from "./ui/tools/GenericTool";
import { OpenTraceDialogTool } from "./ui/tools/OpenTraceDialogTool";
import { IModelApp } from "@itwin/core-frontend";

/** UiTestExtension is an iModel.js Extension that adds some user interface to the iModel.js app into which its loaded.
 * Included in the sample are: 1) a Sample Tool (SampleTool.ts), showing how implement a tool with a variety to tool settings items.
 *                             2) a StatusBarItem (created in ExtensionUiItemsProvider.provideStatusBarItems()) that opens a modal dialog when clicked.
 *
 * Both the SampleTool and the modal dialog opened from the StatusBarItem (UnitsPopup.tsx) use the UiLayoutDataProvider to generate
 * react code from an array of DialogItem interfaces.
 *
 * For more information about Extensions, see Extension in the iModel.js documentation. *
 */
export class UiTestExtension {
  private static _initialized = false;

  /** We'll register the uiTestExtension.json as the Extension's namespace/ */
  public static readonly localizationNamespace = "uiTestExtension";
  /** The uiProvider will add a tool to the Toolbar and an item to the StatusBar in the host app */
  private static registerUiComponents(): void {
    SampleTool.register(UiTestExtension.localizationNamespace);
    GenericTool.register(UiTestExtension.localizationNamespace);
    OpenTraceDialogTool.register(UiTestExtension.localizationNamespace);

    ConfigurableUiManager.addFrontstageProvider(new ExtensionFrontstage());
    ConfigurableUiManager.registerControl("SampleExtensionContentControl", SampleContentControl);

    // register to add items to "General" usage stages"
    UiItemsManager.register(new ExtensionUiItemsProvider());
    UiItemsManager.register(new TraceUiItemsProvider());
  }

  public static async initialize(): Promise<void> {
    if (this._initialized)
      return;

    /** Register the localized strings for this extension
     * We'll pass the localization member to the rest of the classes in the Extension to allow them to translate strings in the UI they implement.
     */
    await IModelApp.localization.registerNamespace(UiTestExtension.localizationNamespace);
    this.registerUiComponents();
    this._initialized = true;
  }
}
