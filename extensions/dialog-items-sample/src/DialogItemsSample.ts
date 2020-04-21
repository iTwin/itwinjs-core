/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import {
  IModelApp,
  NotifyMessageDetails,
  OutputMessagePriority,
  Extension,
} from "@bentley/imodeljs-frontend";
import { I18NNamespace } from "@bentley/imodeljs-i18n";
import { SampleUiItemsProvider } from "./ui/SampleUiItemsProvider";
import { UiItemsManager } from "@bentley/ui-abstract";
import { SampleTool } from "./ui/SampleTool";

/** DialogItemsSample is an iModel.js Extension that adds some user interface to the iModel.js app into which its loaded.
 * Included in the sample are: 1) a Sample Tool (SampleTool.ts), showing how implement a tool with a variety to tool settings items.
 *                             2) a StatusBarItem (created in SampleUiItemsProvider.provideStatusBarItems()) that opens a modal dialog when clicked.
 *
 * Both the SampleTool and the modal dialog opened from the StatusBarItem (UnitsPopup.tsx) use the DialogItemsManager to generate react code from an array of DialogItem interfaces.
 *
 * For more information about Extensions, see Extension in the iModel.js documentation. *
 */
export class DialogItemsSample extends Extension {
  /** We'll register the dialogItemsSample.json as the Extension's namespace/ */
  private _i18NNamespace?: I18NNamespace;
  /** The uiProvider will add a tool to the Toolbar and an item to the StatusBar in the host app */
  public uiProvider?: SampleUiItemsProvider;

  public constructor(name: string) {
    super(name);
    // args might override this.
  }

  /** Invoked the first time this extension is loaded. */
  public async onLoad(_args: string[]): Promise<void> {
    /** Register the localized strings for this extension
     * We'll pass the i18n member to the rest of the classes in the Extension to allow them to translate strings in the UI they implement.
     */
    this._i18NNamespace = this.i18n.registerNamespace("dialogItemsSample");
    await this._i18NNamespace!.readFinished;
    const message: string = this.i18n.translate("dialogItemsSample:Messages.Start");
    const msgDetails: NotifyMessageDetails = new NotifyMessageDetails(OutputMessagePriority.Info, message);
    IModelApp.notifications.outputMessage(msgDetails);
    if (undefined === this.uiProvider) {
      this.uiProvider = new SampleUiItemsProvider(this.i18n);
      UiItemsManager.register(this.uiProvider);
    }
    SampleTool.register(this._i18NNamespace, this.i18n);
  }

  /** Invoked each time this extension is loaded. */
  public async onExecute(_args: string[]): Promise<void> {
    // currently, everything is done in onLoad.
  }
}

IModelApp.extensionAdmin.register(new DialogItemsSample("dialogItemsSample"));
