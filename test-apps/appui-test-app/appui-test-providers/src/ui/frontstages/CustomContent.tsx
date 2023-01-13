/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import {
  BackstageAppButton, ConfigurableUiManager, ContentGroup, ContentGroupProvider, FrontstageProps,
  IModelViewportControl,
  StandardContentToolsUiItemsProvider, StandardFrontstageProps, StandardFrontstageProvider,
  StandardNavigationToolsUiItemsProvider,
  StandardStatusbarUiItemsProvider,
  UiFramework,
  UiItemsManager,
} from "@itwin/appui-react";
import { ContentLayoutProps, StageUsage, StandardContentLayouts } from "@itwin/appui-abstract";
import { CustomContentStageUiProvider } from "../providers/CustomContentStageUiProvider";
import { SampleContentControl } from "../content/SampleContentControl";

/**
 * The CustomContentGroupProvider class method `provideContentGroup` returns a ContentGroup that displays two content view, one the
 * shows and IModel using `UiFramework.getDefaultViewState` and a second content that just display React components. The layout
 * used in StandardContentLayouts.twoHorizontalSplit which arrange the iModel view on top and the React content below.
 */
export class CustomContentGroupProvider extends ContentGroupProvider {
  public async provideContentGroup(_props: FrontstageProps): Promise<ContentGroup> { // eslint-disable-line deprecation/deprecation
    // copy and then modify standard layout so the content is always shown - note we could have just copied the standard and created a new one in line
    const twoHorizontalSplit: ContentLayoutProps = {
      ...StandardContentLayouts.twoHorizontalSplit, horizontalSplit: {
        ...StandardContentLayouts.twoHorizontalSplit.horizontalSplit!,
        minSizeBottom: 100,
        percentage: 0.80,
      },
    };

    return new ContentGroup({
      id: "appui-test-providers:custom-stage-content",
      layout: twoHorizontalSplit,
      contents: [
        {
          id: "primaryContent",
          classId: IModelViewportControl.id,
          applicationData: {
            isPrimaryView: true,
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
        {
          id: "ui-test:customContent",
          classId: SampleContentControl,
        },
      ],
    });
  }
}

/**
 * This class is used to register a new frontstage that is called 'Custom' which provides custom content along with imodel content.
 * Providers are used to provide some tools from standard providers along with a stage-specific provider that
 * defines a couple test tool buttons to demonstrate how to use Redux from a package like the one that includes this
 * frontstage definition.
 */
export class CustomContentFrontstage {
  public static stageId = "appui-test-providers:CustomContent";
  private static _contentGroupProvider = new CustomContentGroupProvider();

  public static register(localizationNamespace: string) {
    const cornerButton = <BackstageAppButton />;
    const customStageProps: StandardFrontstageProps = {
      id: CustomContentFrontstage.stageId,
      version: 1.1,
      contentGroupProps: CustomContentFrontstage._contentGroupProvider,
      hideNavigationAid: false,
      cornerButton,
      usage: StageUsage.General,
      applicationData: undefined,
    };

    CustomContentFrontstage.registerToolProviders(localizationNamespace);
    ConfigurableUiManager.addFrontstageProvider(new StandardFrontstageProvider(customStageProps));
  }

  private static registerToolProviders(localizationNamespace: string) {
    // Provides standard tools for ToolWidget
    UiItemsManager.register(new StandardContentToolsUiItemsProvider(
      {
        horizontal: {
          clearSelection: true,
          clearDisplayOverrides: true,
          hide: "group",
          isolate: "group",
          emphasize: "element",
        },
        vertical: {
          selectElement: true,
        },
      }), { providerId: "customContentTools", stageIds: [CustomContentFrontstage.stageId] });

    /** Provides standard tools for NavigationWidget */
    UiItemsManager.register(new StandardNavigationToolsUiItemsProvider(), { providerId: "customNavigationTools", stageIds: [CustomContentFrontstage.stageId] });

    /** Provides standard status fields */
    UiItemsManager.register(new StandardStatusbarUiItemsProvider(), { providerId: "customStatusFields", stageIds: [CustomContentFrontstage.stageId] });

    // register stage specific items provider
    UiItemsManager.register(new CustomContentStageUiProvider(localizationNamespace), { providerId: "customStageTools", stageIds: [CustomContentFrontstage.stageId] });
  }
}
