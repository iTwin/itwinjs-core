/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import { BackstageItem, BackstageItemUtilities, CommonToolbarItem, StageUsage, ToolbarOrientation, ToolbarUsage, UiItemsManager, UiItemsProvider } from "@itwin/appui-abstract";
import { CustomItemDef, IModelConnectedViewSelector, ToolbarHelper } from "@itwin/appui-react";
import { OpenSynchronizedViewTool } from "../../tools/OpenSynchronizedViewTool";
import { SynchronizedFloatingViewportStage } from "../frontstages/SynchronizedFloatingViewport";
import { AppUiTestProviders } from "../../AppUiTestProviders";

export class SynchronizedFloatingViewportProvider implements UiItemsProvider {
  public static providerId = "SynchronizedFloatingViewportProvider";
  public readonly id = SynchronizedFloatingViewportProvider.providerId;
  constructor(localizationNamespace: string) {
    OpenSynchronizedViewTool.register(localizationNamespace);
  }

  public static register(localizationNamespace: string) {
    UiItemsManager.register(new SynchronizedFloatingViewportProvider(localizationNamespace), { stageIds: [SynchronizedFloatingViewportStage.stageId] });
  }

  public static unregister() {
    UiItemsManager.unregister(SynchronizedFloatingViewportProvider.providerId);
  }

  public provideToolbarButtonItems(
    _stageId: string,
    stageUsage: string,
    toolbarUsage: ToolbarUsage,
    toolbarOrientation: ToolbarOrientation,
  ): CommonToolbarItem[] {
    if (stageUsage !== StageUsage.General) return [];
    if (_stageId !== "appui-test-providers:SynchronizedFloatingViewportExample" ) return [];

    const toolbarItems: CommonToolbarItem[] = [];
    if (
      toolbarUsage === ToolbarUsage.ContentManipulation &&
      toolbarOrientation === ToolbarOrientation.Horizontal
    ) {
      const viewSelectorButton = ToolbarHelper.createToolbarItemFromItemDef(
        51,
        new CustomItemDef({
          customId: "sampleApp:viewSelector",
          reactElement: (
            <IModelConnectedViewSelector
              listenForShowUpdates={false} // Demo for showing only the same type of view in ViewSelector - See IModelViewport.tsx, onActivated
            />
          ),
        }),
        {
          groupPriority: 20,
        }
      );
      toolbarItems.push(viewSelectorButton);
      OpenSynchronizedViewTool.register("ThisTestApp");
      toolbarItems.push(OpenSynchronizedViewTool.getActionButtonDef(10,10));
    }
    return toolbarItems;
  }
  /** Add entry to activate this stage in the backstage. */
  public provideBackstageItems(): BackstageItem[] {
    const label = AppUiTestProviders.translate("backstage.SynchronizeFloatingViewFrontstageLabel");
    return [
      BackstageItemUtilities.createStageLauncher(SynchronizedFloatingViewportStage.stageId, 300, 2, label, undefined, undefined),
    ];
  }

}
