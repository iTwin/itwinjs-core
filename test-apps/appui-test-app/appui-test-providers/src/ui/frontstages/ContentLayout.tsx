/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import {
  BackstageAppButton, BackstageManager, ConfigurableUiManager, ContentGroup, ContentGroupProps, ContentGroupProvider, ContentProps, FrontstageProps,
  IModelViewportControl, StandardContentToolsUiItemsProvider, StandardFrontstageProps, StandardFrontstageProvider,
  StandardNavigationToolsUiItemsProvider,
  StandardStatusbarUiItemsProvider,
  UiFramework,
} from "@itwin/appui-react";
import {
  StageUsage, StandardContentLayouts, UiItemsManager,
} from "@itwin/appui-abstract";
import { getSavedViewLayoutProps } from "../../tools/ContentLayoutTools";
import { ContentLayoutStageUiItemsProvider } from "../providers/ContentLayoutStageUiItemsProvider";

/**
 * The ContentLayoutStageContentGroupProvider provides a class with the primary method `provideContentGroup` to provide a ContentGroup
 * to a stage when the stage is activated. This provider will look to see if the user saved out a ContentGroup to use when a stage and
 * specific iModel is opened. See `SaveContentLayoutTool` in `ContentLayoutTools.tsx` to see tool that saved the layout and ViewStates.
 * If no saved state was found `UiFramework.getDefaultViewState` is used to specify the ViewState and `StandardContentLayouts.singleView`
 * is used to specify the layout. The `prepareToSaveProps` prepare the JSON to be saved to local storage when saving ContentGroup data. The
 * method `applyUpdatesToSavedProps` is used to make any updates to the saved JSON before it is applied to the stage.
 */
export class ContentLayoutStageContentGroupProvider extends ContentGroupProvider {
  public override prepareToSaveProps(contentGroupProps: ContentGroupProps) {
    const newContentsArray = contentGroupProps.contents.map((content: ContentProps) => {
      const newContent = { ...content };
      if (newContent.applicationData)
        delete newContent.applicationData;
      return newContent;
    });
    return { ...contentGroupProps, contents: newContentsArray };
  }

  public override applyUpdatesToSavedProps(contentGroupProps: ContentGroupProps) {
    const newContentsArray = contentGroupProps.contents.map((content: ContentProps) => {
      const newContent = { ...content };

      if (newContent.classId === IModelViewportControl.id) {
        newContent.applicationData = {
          ...newContent.applicationData,
          isPrimaryView: true,
          featureOptions:
          {
            defaultViewOverlay: {
              enableScheduleAnimationViewOverlay: true,
              enableAnalysisTimelineViewOverlay: true,
              enableSolarTimelineViewOverlay: true,
            },
          },
        };
      }
      return newContent;
    });
    return { ...contentGroupProps, contents: newContentsArray };
  }

  public async provideContentGroup(props: FrontstageProps): Promise<ContentGroup> {
    const savedViewLayoutProps = await getSavedViewLayoutProps(props.id, UiFramework.getIModelConnection());
    if (savedViewLayoutProps) {
      const viewState = savedViewLayoutProps.contentGroupProps.contents[0].applicationData?.viewState;
      if (viewState) {
        UiFramework.setDefaultViewState(viewState);
      }
      const contentGroupProps = this.applyUpdatesToSavedProps(savedViewLayoutProps.contentGroupProps);
      return new ContentGroup(contentGroupProps);
    }

    return new ContentGroup({
      id: "content-layout-stage-frontstage-main-content-group",
      layout: StandardContentLayouts.singleView,
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
      ],
    });
  }
}

/**
 * The ContentLayoutStage provides a register method that registers a FrontstageProvider that is used to activate a stage.
 * It also register "standard" providers to provide tool buttons and statusbar items. Finally it registers a UiItemsProvider
 * that provides tools that are only intended to be used in this stage. This stage also uses a ContentGroupProvider to provide a
 * ContentGroup to use when the stage is activated. Using a ContentGroupProvider allows async code to be run as a stage is activated
 * so it can use logic to determine what content and layout to use.
 */

export class ContentLayoutStage {
  public static stageId = "appui-test-providers:ContentLayoutExample";

  private static _contentGroupProvider = new ContentLayoutStageContentGroupProvider();

  public static supplyAppData(_id: string, _applicationData?: any) {
    return {
      viewState: UiFramework.getDefaultViewState,
      iModelConnection: UiFramework.getIModelConnection,
    };
  }

  public static register(localizationNamespace: string) {
    // set up custom corner button where we specify icon, label, and action
    const cornerButton = <BackstageAppButton key="appui-test-providers-ContentLayoutExample-backstage" label="Toggle Backstage" icon={"icon-bentley-systems"}
      execute={() => BackstageManager.getBackstageToggleCommand().execute()} />;

    const widgetApiStageProps: StandardFrontstageProps = {
      id: ContentLayoutStage.stageId,
      version: 1.1,
      contentGroupProps: ContentLayoutStage._contentGroupProvider,
      cornerButton,
      usage: StageUsage.General,
    };

    ConfigurableUiManager.addFrontstageProvider(new StandardFrontstageProvider(widgetApiStageProps));
    this.registerToolProviders(localizationNamespace);
  }

  private static registerToolProviders(localizationNamespace: string) {

    // Provides standard tools for ToolWidget in stage
    UiItemsManager.register(new StandardContentToolsUiItemsProvider({
      vertical: {
        selectElement: true,
      },
      horizontal: {
        clearSelection: true,
        clearDisplayOverrides: true,
        hide: "group",
        isolate: "group",
        emphasize: "element",
      },
    }), { providerId: "content-layout-stage-standardContentTools", stageIds: [ContentLayoutStage.stageId] });

    // Provides standard tools for NavigationWidget in stage
    UiItemsManager.register(new StandardNavigationToolsUiItemsProvider(), { providerId: "content-layout-stage-standardNavigationTools", stageIds: [ContentLayoutStage.stageId] });

    // Provides standard status fields for stage
    UiItemsManager.register(new StandardStatusbarUiItemsProvider(), { providerId: "content-layout-stage-standardStatusItems", stageIds: [ContentLayoutStage.stageId] });

    // Provides example widgets stage
    ContentLayoutStageUiItemsProvider.register(localizationNamespace);
  }
}

