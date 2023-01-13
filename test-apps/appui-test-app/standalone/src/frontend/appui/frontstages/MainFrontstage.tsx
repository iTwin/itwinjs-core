/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import {
  IModelApp,
  IModelConnection,
  ViewState,
} from "@itwin/core-frontend";
import {
  ContentLayoutProps, StageUsage, StandardContentLayouts,
} from "@itwin/appui-abstract";
import {
  BackstageAppButton,
  BackstageItem,
  BackstageItemUtilities,
  ConfigurableUiManager, ContentGroup, ContentGroupProps,
  ContentGroupProvider, ContentProps, FrontstageProps, IModelViewportControl,
  SettingsModalFrontstage, StageContentLayout, StageContentLayoutProps,
  StandardContentToolsUiItemsProvider, StandardFrontstageProps,
  StandardFrontstageProvider,
  StandardNavigationToolsUiItemsProvider,
  StandardStatusbarUiItemsProvider,
  UiFramework,
  UiItemsManager,
  UiItemsProvider,
} from "@itwin/appui-react";
import { SampleAppIModelApp } from "../../index";
import { AppUi } from "../AppUi";
// cSpell:Ignore contentviews statusbars
import { LocalStateStorage } from "@itwin/core-react";
import stageIconSvg from "./imodeljs.svg?sprite";

function getIModelSpecificKey(inKey: string, iModelConnection: IModelConnection | undefined) {
  const imodelId = iModelConnection?.iModelId ?? "unknownImodel";
  return `[${imodelId}]${inKey}`;
}

export async function getSavedViewLayoutProps(activeFrontstageId: string, iModelConnection: IModelConnection | undefined) {
  const localSettings = new LocalStateStorage();
  const result = await localSettings.getSetting("ContentGroupLayout", getIModelSpecificKey(activeFrontstageId, iModelConnection));

  if (result.setting) {
    // Parse StageContentLayoutProps
    const savedViewLayoutProps: StageContentLayoutProps = result.setting;
    if (iModelConnection) {
      // Create ViewStates
      const viewStates = await StageContentLayout.viewStatesFromProps(iModelConnection, savedViewLayoutProps);
      if (0 === viewStates.length)
        return undefined;

      // Add applicationData to the ContentProps
      savedViewLayoutProps.contentGroupProps.contents.forEach((contentProps: ContentProps, index: number) => {
        contentProps.applicationData = { viewState: viewStates[index], iModelConnection };
      });
    }
    return savedViewLayoutProps;
  }
  return undefined;
}

export class InitialIModelContentStageProvider extends ContentGroupProvider {
  constructor(private _forEditing?: boolean) {
    super();
  }

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

  public async provideContentGroup(props: FrontstageProps): Promise<ContentGroup> { // eslint-disable-line deprecation/deprecation
    const viewIdsSelected = SampleAppIModelApp.getInitialViewIds();
    const iModelConnection = UiFramework.getIModelConnection();

    if (!iModelConnection)
      throw new Error(`Unable to generate content group if not iModelConnection is available`);

    if (0 === viewIdsSelected.length) {
      const savedViewLayoutProps = await getSavedViewLayoutProps(props.id, iModelConnection);
      if (savedViewLayoutProps) {
        const viewState = savedViewLayoutProps.contentGroupProps.contents[0].applicationData?.viewState;
        if (viewState) {
          UiFramework.setDefaultViewState(viewState);
        }
        return new ContentGroup(savedViewLayoutProps.contentGroupProps);
      }

      return new ContentGroup({
        id: "content-group",
        layout: StandardContentLayouts.singleView,
        contents: [
          {
            id: "viewport",
            classId: IModelViewportControl,
            applicationData: {
            },
          },
        ],
      });
    }

    // first find an appropriate layout
    const contentLayoutProps: ContentLayoutProps | undefined = AppUi.findLayoutFromContentCount(viewIdsSelected.length);
    if (!contentLayoutProps) {
      throw (Error(`Could not find layout ContentLayoutProps when number of viewStates=${viewIdsSelected.length}`));
    }

    let viewStates: ViewState[] = [];
    const promises = new Array<Promise<ViewState>>();
    viewIdsSelected.forEach((viewId: string) => {
      promises.push(iModelConnection.views.load(viewId));
    });

    try {
      viewStates = await Promise.all(promises);
    } catch { }

    // create the content props that specifies an iModelConnection and a viewState entry in the application data.
    const contentProps: ContentProps[] = [];
    viewStates.forEach((viewState, index) => {
      if (0 === index) {
        UiFramework.setDefaultViewState(viewState);
      }
      const thisContentProps: ContentProps = {
        id: `imodel-view-${index}`,
        classId: IModelViewportControl,
        applicationData:
        {
          viewState, iModelConnection,
          featureOptions:
          {
            defaultViewOverlay: {
              enableScheduleAnimationViewOverlay: true,
              enableAnalysisTimelineViewOverlay: true,
              enableSolarTimelineViewOverlay: true,
            },
          },
        },
      };
      contentProps.push(thisContentProps);
    });

    const myContentGroup: ContentGroup = new ContentGroup(
      {
        id: "views-frontstage-default-content-group",
        layout: contentLayoutProps,
        contents: contentProps,
      });
    return myContentGroup;
  }
}

// Sample UI items provider that dynamically adds ui items
class MainStageBackstageItemsProvider implements UiItemsProvider {
  public readonly id = "main-stage-backstageItemProvider";

  public provideBackstageItems(): BackstageItem[] {
    return [
      BackstageItemUtilities.createStageLauncher(MainFrontstage.stageId, 100, 10, IModelApp.localization.getLocalizedString("SampleApp:backstage.viewIModel"), IModelApp.localization.getLocalizedString("SampleApp:backstage.iModelStage"), `svg:${stageIconSvg}`),
      SettingsModalFrontstage.getBackstageActionItem(400, 10),
    ];
  }
}

export class MainFrontstage {
  public static stageId = "appui-test-app:main-stage";
  private static _contentGroupProvider = new InitialIModelContentStageProvider();

  public static supplyAppData(_id: string, _applicationData?: any) {
    return {
      viewState: UiFramework.getDefaultViewState,
      iModelConnection: UiFramework.getIModelConnection,
    };
  }

  public static register() {
    const stageProps: StandardFrontstageProps = {
      id: MainFrontstage.stageId,
      version: 1.1,
      contentGroupProps: MainFrontstage._contentGroupProvider,
      cornerButton: <BackstageAppButton />,
      usage: StageUsage.General,
    };

    ConfigurableUiManager.addFrontstageProvider(new StandardFrontstageProvider(stageProps));
    this.registerUiItemProviders();
  }

  private static registerUiItemProviders() {
    UiItemsManager.register(new MainStageBackstageItemsProvider());

    // Provides standard tools for ToolWidget - limit to showing only in this stage
    UiItemsManager.register(new StandardContentToolsUiItemsProvider(), { providerId: "main-stage-standardContentTools", stageIds: [MainFrontstage.stageId] });

    // Provides standard tools for NavigationWidget - limit to showing only in this stage
    UiItemsManager.register(new StandardNavigationToolsUiItemsProvider(), { providerId: "main-stage-standardNavigationTools", stageIds: [MainFrontstage.stageId] });

    // Provides standard status fields - limit to showing only in this stage
    UiItemsManager.register(new StandardStatusbarUiItemsProvider(), { providerId: "main-stage-standardStatusItems", stageIds: [MainFrontstage.stageId] });
  }
}
