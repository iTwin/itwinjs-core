/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import {
  BackstageAppButton, ConfigurableUiManager, ContentGroup, ContentGroupProvider, FrontstageProps,
  IModelViewportControl, StandardContentToolsProvider, StandardFrontstageProps, StandardFrontstageProvider,
  StandardNavigationToolsProvider,
  StandardStatusbarItemsProvider,
  UiFramework,
} from "@itwin/appui-react";
import { StageUsage, StandardContentLayouts } from "@itwin/appui-abstract";
import { CustomContentUiProvider } from "../providers/CustomContentUiProvider";
import { SampleContentControl } from "../content/SampleContentControl";

export class CustomContentGroupProvider extends ContentGroupProvider {
  public async provideContentGroup(_props: FrontstageProps): Promise<ContentGroup> {
    return new ContentGroup({
      id: "ui-item-provider-test:network-tracing-stage-content",
      layout: StandardContentLayouts.twoHorizontalSplit,
      contents: [
        {
          id: "primaryContent",
          classId: IModelViewportControl.id,
          applicationData: {
            isPrimaryView: true,
            supports: ["viewIdSelection", "3dModels", "2dModels"],
            viewState: UiFramework.getDefaultViewState,
            iModelConnection: UiFramework.getIModelConnection,
          },
        },
        {
          id: "ui-test:customContent",
          classId: SampleContentControl,
        },
      ],
    });
  }
}

/**
 * This class is used to register a new frontstage that is called 'Custom' but it provides no real tools to do work,
 * it is simply used as a test defining a stage that provides custom content along with imodel content.
 */
export class CustomFrontstage {
  public static stageId = "ui-item-provider-test:Custom";
  private static _contentGroupProvider = new CustomContentGroupProvider();
  public static register() {
    const cornerButton = <BackstageAppButton />;
    const networkTracingStageProps: StandardFrontstageProps = {
      id: CustomFrontstage.stageId,
      version: 1.1,
      contentGroupProps: CustomFrontstage._contentGroupProvider,
      hideNavigationAid: false,
      cornerButton,
      usage: StageUsage.General,
      applicationData: undefined,
    };

    CustomFrontstage.registerToolProviders();
    ConfigurableUiManager.addFrontstageProvider(new StandardFrontstageProvider(networkTracingStageProps));
  }

  private static registerToolProviders() {
    // Provides standard tools for ToolWidget in ui2.0 stage
    StandardContentToolsProvider.register("customContentTools", {
      horizontal: {
        clearSelection: true,
        clearDisplayOverrides: true,
        hide: "group",
        isolate: "group",
        emphasize: "element",
      },
    }, (stageId: string, _stageUsage: string, _applicationData: any) => {
      return stageId === CustomFrontstage.stageId;
    });

    /** Provides standard tools for NavigationWidget */
    StandardNavigationToolsProvider.register("customNavigationTools", undefined, (stageId: string, _stageUsage: string, _applicationData: any) => {
      return stageId === CustomFrontstage.stageId;
    });

    /** Provides standard status fields */
    StandardStatusbarItemsProvider.register("customStatusFields", undefined, (stageId: string, _stageUsage: string, _applicationData: any) => {
      return stageId === CustomFrontstage.stageId;
    });

    // register stage specific items provider
    CustomContentUiProvider.register();
  }
}

