/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { FrontstageManager, BackstageItem, BackstageStageLauncher, BackstageItemType, UiFramework, BackstageActionItem } from "@bentley/ui-framework";
import { LocalFileOpenFrontstage } from "./frontstages/LocalFileStage";
import { IModelApp } from "@bentley/imodeljs-frontend";
import { SettingsModalFrontstage } from "./frontstages/Settings";

export const createStageLauncher = (frontstageId: string, groupPriority: number, itemPriority: number, label: string, subTitle?: string, tooltip?: string, iconSpec?: string): BackstageStageLauncher => ({
  groupPriority,
  icon: iconSpec,
  isEnabled: true,
  isVisible: true,
  id: frontstageId,
  itemPriority,
  type: BackstageItemType.StageLauncher,
  label: UiFramework.i18n.translate(label),
  stageId: frontstageId,
  subtitle: subTitle ? UiFramework.i18n.translate(subTitle) : undefined,
  tooltip: tooltip ? UiFramework.i18n.translate(tooltip) : undefined,
});

export const createActionItem = (itemId: string, groupPriority: number, itemPriority: number, execute: () => void, label: string, subtitle?: string, tooltip?: string, iconSpec?: string): BackstageActionItem => ({
  execute,
  groupPriority,
  icon: iconSpec,
  isEnabled: true,
  isVisible: true,
  id: itemId,
  itemPriority,
  type: BackstageItemType.ActionItem,
  label: UiFramework.i18n.translate(label),
  subtitle: subtitle ? UiFramework.i18n.translate(subtitle) : undefined,
  tooltip: tooltip ? UiFramework.i18n.translate(tooltip) : undefined,
});

export class AppBackstageItemProvider {
  public static readonly id = "ui-test-app.AppBackstageItemProvider";
  private _backstageItems: ReadonlyArray<BackstageItem> | undefined = undefined;

  public get backstageItems(): ReadonlyArray<BackstageItem> {
    if (!this._backstageItems) {
      this._backstageItems = [
        createStageLauncher("Test1", 100, 10, IModelApp.i18n.translate("SampleApp:backstage.testFrontstage1"), undefined, undefined, "icon-placeholder"),
        createStageLauncher("Test2", 100, 20, IModelApp.i18n.translate("SampleApp:backstage.testFrontstage2"), undefined, undefined, "icon-placeholder"),
        createStageLauncher("Test3", 100, 30, IModelApp.i18n.translate("SampleApp:backstage.testFrontstage3"), undefined, undefined, "icon-placeholder"),
        createStageLauncher("Test4", 100, 40, IModelApp.i18n.translate("SampleApp:backstage.testFrontstage4"), undefined, undefined, "icon-placeholder"),
        createStageLauncher("IModelOpen", 200, 10, IModelApp.i18n.translate("SampleApp:backstage.imodelopen"), undefined, undefined, "icon-folder-opened"),
        createStageLauncher("IModelIndex", 200, 20, IModelApp.i18n.translate("SampleApp:backstage.imodelindex"), undefined, undefined, "icon-placeholder"),
        createActionItem("SampleApp.open-local-file", 200, 30, () => LocalFileOpenFrontstage.open(), IModelApp.i18n.translate("SampleApp:backstage:fileSelect"), undefined, undefined, "icon-placeholder"),
        createActionItem("SampleApp.settings", 300, 10, () => FrontstageManager.openModalFrontstage(new SettingsModalFrontstage()), IModelApp.i18n.translate("SampleApp:backstage.testFrontstage6"), undefined, undefined, "icon-placeholder"),
        createStageLauncher("ViewsFrontstage", 400, 10, IModelApp.i18n.translate("SampleApp:backstage.viewIModel"), IModelApp.i18n.translate("SampleApp:backstage.iModelStage"), undefined, "icon-placeholder"),
      ];
    }
    return this._backstageItems;
  }
}
