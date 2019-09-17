/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";

import { SettingsModalFrontstage } from "./frontstages/Settings";
import {
  FrontstageManager, BackstageItemManager, BackstageItemProvider, BackstageItemSpec,
  ConditionalDisplayType, CustomItemSpec, CommandLaunchBackstageItem,
} from "@bentley/ui-framework";
import { SampleAppIModelApp, SampleAppUiActionId } from "../index";
import { LocalFileOpenFrontstage } from "./frontstages/LocalFileStage";
import {
  IModelApp, MessageBoxType, MessageBoxIconType,
} from "@bentley/imodeljs-frontend";

export class AppBackstageItemProvider implements BackstageItemProvider {
  /** id of provider */
  public readonly id = "ui-test-app.AppBackstageItemProvider";

  public provideBackstageItems(): BackstageItemSpec[] {
    const backstageItems: BackstageItemSpec[] = [];
    backstageItems.push(BackstageItemManager.createFrontstageLauncherItemSpec("Test1", 100, 10, IModelApp.i18n.translate("SampleApp:backstage.testFrontstage1"), undefined, undefined, "icon-placeholder"));
    backstageItems.push(BackstageItemManager.createFrontstageLauncherItemSpec("Test2", 100, 20, IModelApp.i18n.translate("SampleApp:backstage.testFrontstage2"), undefined, undefined, "icon-placeholder"));
    const stage3Item = BackstageItemManager.createFrontstageLauncherItemSpec("Test3", 100, 30, IModelApp.i18n.translate("SampleApp:backstage.testFrontstage3"), undefined, undefined, "icon-placeholder");
    stage3Item.condition = {
      type: ConditionalDisplayType.Visibility,
      testFunc: (): boolean => SampleAppIModelApp.getTestProperty() !== "HIDE",
      syncEventIds: [SampleAppUiActionId.setTestProperty],
    };
    backstageItems.push(stage3Item);
    const stage4Item = BackstageItemManager.createFrontstageLauncherItemSpec("Test4", 100, 40, IModelApp.i18n.translate("SampleApp:backstage.testFrontstage4"), undefined, undefined, "icon-placeholder");
    stage4Item.condition = {
      type: ConditionalDisplayType.EnableState,
      testFunc: (): boolean => SampleAppIModelApp.getTestProperty() !== "HIDE",
      syncEventIds: [SampleAppUiActionId.setTestProperty],
    };
    backstageItems.push(stage4Item);
    backstageItems.push(BackstageItemManager.createFrontstageLauncherItemSpec("IModelOpen", 200, 10, IModelApp.i18n.translate("SampleApp:backstage.imodelopen"), undefined, undefined, "icon-folder-opened"));
    const imodelIndex = BackstageItemManager.createFrontstageLauncherItemSpec("IModelIndex", 200, 20, IModelApp.i18n.translate("SampleApp:backstage.imodelindex"), undefined, undefined, "icon-placeholder");
    imodelIndex.condition = {
      type: ConditionalDisplayType.EnableState,
      testFunc: (): boolean => !SampleAppIModelApp.isIModelLocal,
      syncEventIds: [SampleAppUiActionId.setIsIModelLocal],
    };
    backstageItems.push(imodelIndex);
    backstageItems.push(BackstageItemManager.createCommandLauncherItemSpec("SampleApp.open-local-file", 200, 30, () => LocalFileOpenFrontstage.open(), IModelApp.i18n.translate("SampleApp:backstage:fileSelect"), undefined, undefined, "icon-placeholder"));
    backstageItems.push(BackstageItemManager.createCommandLauncherItemSpec("SampleApp.settings", 300, 10, () => FrontstageManager.openModalFrontstage(new SettingsModalFrontstage()), IModelApp.i18n.translate("SampleApp:backstage.testFrontstage6"), undefined, undefined, "icon-placeholder"));
    backstageItems.push(BackstageItemManager.createFrontstageLauncherItemSpec("ViewsFrontstage", 400, 10, IModelApp.i18n.translate("SampleApp:backstage.viewIModel"), IModelApp.i18n.translate("SampleApp:backstage.iModelStage"), undefined, "icon-placeholder"));

    backstageItems.push(BackstageItemManager.createCustomBackstageItemSpec(this.id, "custom-test", 500, 10, IModelApp.i18n.translate("SampleApp:backstage.custom"), undefined, undefined, undefined));

    return backstageItems;
  }

  private _processCustomItem = (_itemId: string) => {
    IModelApp.notifications.openMessageBox(MessageBoxType.LargeOk, "Custom Item Selected", MessageBoxIconType.Information); // tslint:disable-line:no-floating-promises
  }

  public provideCustomBackstageItem(itemSpec: CustomItemSpec): React.ReactNode {
    if (itemSpec.customItemProviderId !== this.id || "custom-test" !== itemSpec.itemId)
      return null;

    return <CommandLaunchBackstageItem iconSpec={itemSpec.icon} commandId={itemSpec.itemId} execute={() => this._processCustomItem(itemSpec.itemId)}
      label={itemSpec.label} description={itemSpec.subtitle} tooltip={itemSpec.tooltip} key={itemSpec.itemId} />;
  }
}
