/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import {
  BackstageItem,
  BackstageItemUtilities, CommonToolbarItem, IconSpecUtilities, ToolbarItemUtilities, ToolbarOrientation, ToolbarUsage, UiItemsManager, UiItemsProvider,
} from "@itwin/appui-abstract";
import { IModelApp, NotifyMessageDetails, OutputMessagePriority, OutputMessageType } from "@itwin/core-frontend";
import { IconHelper } from "@itwin/core-react";
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

  public provideToolbarButtonItems(
    stageId: string,
    _stageUsage: string, // don't need to check usage since this provider is for specific stage.
    toolbarUsage: ToolbarUsage,
    toolbarOrientation: ToolbarOrientation
  ): CommonToolbarItem[] {
    if (
      stageId === CustomFrontstage.stageId &&
      toolbarUsage === ToolbarUsage.ContentManipulation &&
      toolbarOrientation === ToolbarOrientation.Horizontal
    ) {
      const internalData = new Map<string, any>();
      const iconData = IconHelper.getIconData(IconSpecUtilities.createWebComponentIconSpec("http://localhost:3000/images/imodeljs-icon.svg"), internalData );
      const overrides = { internalData };

      const getSvgTestButton = ToolbarItemUtilities.createActionButton(
        "custom-visibility-tool",
        -1,
        iconData,
        "Custom Visibility Tool",
        (): void => {
          IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, "custom-visibility-tool activated", undefined, OutputMessageType.Toast));
        },
        overrides,
      );

      return [getSvgTestButton];
    }
    return [];
  }

  public provideBackstageItems(): BackstageItem[] {
    const label = UiItemsProvidersTest.translate("backstage.customContentFrontstageLabel");
    return [
      // use 200 to group it with secondary stages in ui-test-app
      BackstageItemUtilities.createStageLauncher(CustomFrontstage.stageId, 200, 2, label, "from provider", "icon-flag-2"),
    ];
  }
}
