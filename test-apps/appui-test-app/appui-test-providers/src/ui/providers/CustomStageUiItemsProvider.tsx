/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable react/display-name */

import {
  BackstageItem, BackstageItemUtilities, UiItemsManager, UiItemsProvider,
} from "@itwin/appui-abstract";
import { WidgetApiStage } from "../frontstages/WidgetApiStage";
import { SetWidgetStateTool } from "../../tools/UiLayoutTools";
import { CustomFrontstageProvider } from "../frontstages/CustomFrontstageProvider";

export class CustomStageUiItemsProvider implements UiItemsProvider {
  public static providerId = "appui-test-providers:custom-stage";
  public readonly id = CustomStageUiItemsProvider.providerId;

  public static register() {
    UiItemsManager.register(new CustomStageUiItemsProvider(), { stageIds: [WidgetApiStage.stageId] });
    SetWidgetStateTool.register();
  }

  public static unregister() {
    UiItemsManager.unregister(CustomStageUiItemsProvider.providerId);
  }

  public provideBackstageItems(): BackstageItem[] {
    return [
      BackstageItemUtilities.createStageLauncher(CustomFrontstageProvider.stageId, 300, 2, "Custom Frontstage", undefined, undefined),
    ];
  }

}
