/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { BackstageItem, BackstageItemUtilities, ConditionalBooleanValue } from "@bentley/ui-abstract";
import { FrontstageManager } from "@bentley/ui-framework";
import { LocalFileOpenFrontstage } from "../frontstages/LocalFileStage";
import { IModelApp } from "@bentley/imodeljs-frontend";
import { SettingsModalFrontstage } from "../frontstages/Settings";
import { ComponentExamplesModalFrontstage } from "../frontstages/component-examples/ComponentExamples";
import { SampleAppIModelApp, SampleAppUiActionId } from "../..";

import settingsIconSvg from "@bentley/icons-generic/icons/settings.svg?sprite";
import stageIconSvg from "@bentley/icons-generic/icons/imodeljs.svg?sprite";

export class AppBackstageItemProvider {
  public static readonly id = "ui-test-app.AppBackstageItemProvider";
  private _backstageItems?: BackstageItem[];

  public get backstageItems(): BackstageItem[] {
    if (!this._backstageItems) {
      const hiddenCondition3 = new ConditionalBooleanValue(() => SampleAppIModelApp.getTestProperty() === "HIDE", [SampleAppUiActionId.setTestProperty]);
      const enableCondition = new ConditionalBooleanValue(() => SampleAppIModelApp.getTestProperty() === "HIDE", [SampleAppUiActionId.setTestProperty]);
      const imodelIndexHidden = new ConditionalBooleanValue(() => SampleAppIModelApp.isIModelLocal, [SampleAppUiActionId.setIsIModelLocal]);
      this._backstageItems = [
        BackstageItemUtilities.createStageLauncher("Test1", 100, 10, IModelApp.i18n.translate("SampleApp:backstage.testFrontstage1"), undefined, "icon-placeholder"),
        BackstageItemUtilities.createStageLauncher("Test2", 100, 20, IModelApp.i18n.translate("SampleApp:backstage.testFrontstage2"), undefined, "icon-placeholder"),
        BackstageItemUtilities.createStageLauncher("Test3", 100, 30, IModelApp.i18n.translate("SampleApp:backstage.testFrontstage3"), undefined, "icon-placeholder", { isHidden: hiddenCondition3 }),
        BackstageItemUtilities.createStageLauncher("Test4", 100, 40, IModelApp.i18n.translate("SampleApp:backstage.testFrontstage4"), undefined, "icon-placeholder", { isDisabled: enableCondition }),
        BackstageItemUtilities.createStageLauncher("IModelOpen", 200, 10, IModelApp.i18n.translate("SampleApp:backstage.imodelopen"), undefined, "icon-folder-opened"),
        BackstageItemUtilities.createStageLauncher("IModelIndex", 200, 20, IModelApp.i18n.translate("SampleApp:backstage.imodelindex"), undefined, "icon-placeholder", { isHidden: imodelIndexHidden }),
        BackstageItemUtilities.createActionItem("SampleApp.open-local-file", 200, 30, () => LocalFileOpenFrontstage.open(), IModelApp.i18n.translate("SampleApp:backstage:fileSelect"), undefined, "icon-placeholder"),
        BackstageItemUtilities.createActionItem("SampleApp.settings", 300, 10, () => FrontstageManager.openModalFrontstage(new SettingsModalFrontstage()), IModelApp.i18n.translate("SampleApp:backstage.testFrontstage6"), undefined, `svg:${settingsIconSvg}`),
        BackstageItemUtilities.createActionItem("SampleApp.componentExamples", 300, 20, () => FrontstageManager.openModalFrontstage(new ComponentExamplesModalFrontstage()), IModelApp.i18n.translate("SampleApp:backstage.componentExamples"), undefined, "icon-details"),
        BackstageItemUtilities.createStageLauncher("ViewsFrontstage", 400, 10, IModelApp.i18n.translate("SampleApp:backstage.viewIModel"), IModelApp.i18n.translate("SampleApp:backstage.iModelStage"), `svg:${stageIconSvg}`),
      ];
    }
    return this._backstageItems!;
  }
}
