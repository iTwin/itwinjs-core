/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Localization } from "@itwin/core-common";
import { ExtensionUiItemsProvider } from "./ui/ExtensionUiItemsProvider";
import { TraceUiItemsProvider } from "./ui/NetworkTraceUIProvider";
import { UiItemsManager } from "@itwin/appui-abstract";
import { SampleTool } from "./ui/tools/SampleTool";
import { ConfigurableUiManager } from "@itwin/appui-react";
import { ExtensionFrontstage } from "./ui/Frontstage";
import { SampleContentControl } from "./ui/content/SampleContentControl";
import { GenericTool } from "./ui/tools/GenericTool";
import { OpenTraceDialogTool } from "./ui/tools/OpenTraceDialogTool";

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

  private static localization: Localization;
  /** We'll register the uiTestExtension.json as the Extension's namespace/ */
  private static _localizationNamespace?: string;
  /** The uiProvider will add a tool to the Toolbar and an item to the StatusBar in the host app */

  private static registerUiComponents(): void {
    SampleTool.register(this._localizationNamespace, this.localization);
    GenericTool.register(this._localizationNamespace, this.localization);
    OpenTraceDialogTool.register(this._localizationNamespace, this.localization);

    ConfigurableUiManager.addFrontstageProvider(new ExtensionFrontstage());
    ConfigurableUiManager.registerControl("SampleExtensionContentControl", SampleContentControl);

    // register to add items to "General" usage stages"
    UiItemsManager.register(new ExtensionUiItemsProvider(this.localization));
    UiItemsManager.register(new TraceUiItemsProvider(this.localization, "uiTestExtension"));
  }

  public static async initialize(localization: Localization): Promise<void> {
    if (undefined === this.localization)
      this.localization = localization;
    /** Register the localized strings for this extension
     * We'll pass the localization member to the rest of the classes in the Extension to allow them to translate strings in the UI they implement.
     */
    this._localizationNamespace = "uiTestExtension";
    await this.localization.registerNamespace("uiTestExtension");
    this.registerUiComponents();
  }

  /** Invoked each time this extension is loaded. */
  public async onExecute(_args: string[]): Promise<void> {
    // currently, everything is done in onLoad.
  }
}
