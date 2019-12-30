/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { BackstageItem, BackstageItemUtilities } from "@bentley/ui-abstract";
import { FrontstageManager } from "@bentley/ui-framework";
import { LocalFileOpenFrontstage } from "../frontstages/LocalFileStage";
import { IModelApp } from "@bentley/imodeljs-frontend";
import { SettingsModalFrontstage } from "../frontstages/Settings";

export class AppBackstageItemProvider {
  public static readonly id = "ui-test-app.AppBackstageItemProvider";
  private _backstageItems: ReadonlyArray<BackstageItem> | undefined = undefined;

  public get backstageItems(): ReadonlyArray<BackstageItem> {
    if (!this._backstageItems) {
      this._backstageItems = [
        BackstageItemUtilities.createStageLauncher("Test1", 100, 10, IModelApp.i18n.translate("SampleApp:backstage.testFrontstage1"), undefined, "icon-placeholder"),
        BackstageItemUtilities.createStageLauncher("Test2", 100, 20, IModelApp.i18n.translate("SampleApp:backstage.testFrontstage2"), undefined, "icon-placeholder"),
        BackstageItemUtilities.createStageLauncher("Test3", 100, 30, IModelApp.i18n.translate("SampleApp:backstage.testFrontstage3"), undefined, "icon-placeholder"),
        BackstageItemUtilities.createStageLauncher("Test4", 100, 40, IModelApp.i18n.translate("SampleApp:backstage.testFrontstage4"), undefined, "icon-placeholder"),
        BackstageItemUtilities.createStageLauncher("IModelOpen", 200, 10, IModelApp.i18n.translate("SampleApp:backstage.imodelopen"), undefined, "icon-folder-opened"),
        BackstageItemUtilities.createStageLauncher("IModelIndex", 200, 20, IModelApp.i18n.translate("SampleApp:backstage.imodelindex"), undefined, "icon-placeholder"),
        BackstageItemUtilities.createActionItem("SampleApp.open-local-file", 200, 30, () => LocalFileOpenFrontstage.open(), IModelApp.i18n.translate("SampleApp:backstage:fileSelect"), undefined, "icon-placeholder"),
        BackstageItemUtilities.createActionItem("SampleApp.settings", 300, 10, () => FrontstageManager.openModalFrontstage(new SettingsModalFrontstage()), IModelApp.i18n.translate("SampleApp:backstage.testFrontstage6"), undefined, "icon-placeholder"),
        BackstageItemUtilities.createStageLauncher("ViewsFrontstage", 400, 10, IModelApp.i18n.translate("SampleApp:backstage.viewIModel"), IModelApp.i18n.translate("SampleApp:backstage.iModelStage"), "icon-placeholder"),
      ];
    }
    return this._backstageItems;
  }
}
