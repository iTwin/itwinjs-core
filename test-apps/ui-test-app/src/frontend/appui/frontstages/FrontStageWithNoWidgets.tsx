/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import {
  BackstageAppButton, ConfigurableUiManager, ContentGroup, ContentGroupProvider, CoreTools, FrontstageProps,
  IModelViewportControl, StandardContentToolsProvider, StandardFrontstageProps, StandardFrontstageProvider,
  StandardNavigationToolsProvider,
  StandardStatusbarItemsProvider,
  UiFramework,
} from "@itwin/appui-react";
import { ContentLayoutProps, StageUsage, StandardContentLayouts } from "@itwin/appui-abstract";

export class NoWidgetContentGroupProvider extends ContentGroupProvider {
  public async provideContentGroup(_props: FrontstageProps): Promise<ContentGroup> { // eslint-disable-line deprecation/deprecation
    // copy and then modify standard layout so the content is always shown - note we could have just copied the standard and created a new one in line
    const singleView: ContentLayoutProps = {...StandardContentLayouts.singleView};

    return new ContentGroup({
      id: "ui-test-app:no-widget-content",
      layout: singleView,
      contents: [
        {
          id: "primaryContent",
          classId: IModelViewportControl,
          applicationData: {
            isPrimaryView: true,
            supports: ["viewIdSelection", "3dModels", "2dModels"],
            viewState: UiFramework.getDefaultViewState,
            iModelConnection: UiFramework.getIModelConnection,
            featureOptions:
            {
              defaultViewOverlay: {
                enableScheduleAnimationViewOverlay: true,
                enableAnalysisTimelineViewOverlay: true,
                enableSolarTimelineViewOverlay: true,
              },
            },
          },
        },
      ],
    });
  }
}

/**
 * This class is used to register a new frontstage that is called 'Custom' but it provides no real tools to do work,
 * it is simply used as a test defining a stage that provides custom content along with imodel content.
 */
export class FrontstageWithNoWidgets {
  public static stageId = "ui-test-app:no-widget-frontstage";
  private static _contentGroupProvider = new NoWidgetContentGroupProvider();
  public static register() {
    const cornerButton = <BackstageAppButton />;
    const nowWidgetStageProps: StandardFrontstageProps = {
      id: FrontstageWithNoWidgets.stageId,
      version: 1.1,
      contentGroupProps: FrontstageWithNoWidgets._contentGroupProvider,
      hideNavigationAid: false,
      cornerButton,
      usage: StageUsage.General,
      applicationData: undefined,
      defaultTool: CoreTools.measureDistanceToolItemDef,
    };

    FrontstageWithNoWidgets.registerToolProviders();
    ConfigurableUiManager.addFrontstageProvider(new StandardFrontstageProvider(nowWidgetStageProps));
  }

  private static registerToolProviders() {
    // Provides standard tools for ToolWidget in ui2.0 stage
    StandardContentToolsProvider.register("noWidgetContentTools", {
      horizontal: {
        clearSelection: true,
        clearDisplayOverrides: true,
        hide: "group",
        isolate: "group",
        emphasize: "element",
      },
    }, (stageId: string, _stageUsage: string, _applicationData: any) => {
      return stageId === FrontstageWithNoWidgets.stageId;
    });

    /** Provides standard tools for NavigationWidget */
    StandardNavigationToolsProvider.register("noWidgetNavigationTools", undefined, (stageId: string, _stageUsage: string, _applicationData: any) => {
      return stageId === FrontstageWithNoWidgets.stageId;
    });

    /** Provides standard status fields */
    StandardStatusbarItemsProvider.register("noWidgetStatusFields", undefined, (stageId: string, _stageUsage: string, _applicationData: any) => {
      return stageId === FrontstageWithNoWidgets.stageId;
    });
  }
}
