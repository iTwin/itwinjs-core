/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import {
  BackstageItem,
  BackstageItemUtilities, UiItemsManager, UiItemsProvider,
} from "@itwin/appui-abstract";
import { UiItemsProvidersTest } from "../../ui-items-providers-test";
import { CustomFrontstage } from "../frontstages/CustomContent";

/**
 * Test UiItemsProvider that provide buttons, widgets, and backstage item to NetworkTracing stage.
 */
export class CustomContentUiProvider implements UiItemsProvider {
  public static providerId = "ui-item-provider-test:CustomContentUiProvider";
  public readonly id = CustomContentUiProvider.providerId;

  public static register() {
    UiItemsManager.register(new CustomContentUiProvider());
  }

  public static unregister() {
    UiItemsManager.unregister(CustomContentUiProvider.providerId);
  }

  public provideBackstageItems(): BackstageItem[] {
    const label = UiItemsProvidersTest.translate("backstage.customContentFrontstageLabel");
    return [
      // use 200 to group it with secondary stages in ui-test-app
      BackstageItemUtilities.createStageLauncher(CustomFrontstage.stageId, 200, 2, label, "from provider", "icon-flag-2"),
    ];
  }
}
