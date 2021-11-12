/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import {
  BackstageAppButton, ConfigurableUiManager, ContentGroup, ContentGroupProps, ContentGroupProvider, ContentProps, FrontstageProps,
  IModelViewportControl, StageContentLayout, StageContentLayoutProps, StandardContentToolsProvider, StandardFrontstageProps, StandardFrontstageProvider,
  StandardNavigationToolsProvider,
  StandardStatusbarItemsProvider,
  UiFramework,
} from "@itwin/appui-react";
import { StageUsage, StandardContentLayouts } from "@itwin/appui-abstract";
import { NetworkTracingUiProvider } from "../providers/NetworkTracingUiProvider";
import { LocalSettingsStorage } from "@itwin/core-react";
import { IModelConnection } from "@itwin/core-frontend";

function getImodelSpecificKey(inKey: string, iModelConnection: IModelConnection | undefined) {
  const imodelId = iModelConnection?.iModelId ?? "unknownImodel";
  return `[${imodelId}]${inKey}`;
}

export async function hasSavedViewLayoutProps(activeFrontstageId: string, iModelConnection: IModelConnection | undefined) {
  const localSettings = new LocalSettingsStorage();
  return localSettings.hasSetting("ContentGroupLayout", getImodelSpecificKey(activeFrontstageId, iModelConnection));
}

export async function getSavedViewLayoutProps(activeFrontstageId: string, iModelConnection: IModelConnection | undefined) {
  const localSettings = new LocalSettingsStorage();
  const result = await localSettings.getSetting("ContentGroupLayout", getImodelSpecificKey(activeFrontstageId, iModelConnection));

  if (result.setting) {
    // Parse SavedViewLayoutProps
    const savedViewLayoutProps: StageContentLayoutProps = result.setting;
    if (iModelConnection) {
      // Create ViewStates
      const viewStates = await StageContentLayout.viewStatesFromProps(iModelConnection, savedViewLayoutProps);

      // Add applicationData to the ContentProps
      savedViewLayoutProps.contentGroupProps.contents.forEach((contentProps: ContentProps, index: number) => {
        contentProps.applicationData = { viewState: viewStates[index], iModelConnection };
      });
    }
    return savedViewLayoutProps;
  }
  return undefined;
}

export class NetworkTracingContentGroupProvider extends ContentGroupProvider {
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
    const newContentsArray = contentGroupProps.contents.map((content: ContentProps, _index) => {
      const newContent = { ...content };

      if (newContent.classId === IModelViewportControl.id) {
        newContent.applicationData = {
          ...newContent.applicationData,
          supports: ["issueResolutionMarkers", "viewIdSelection", "3dModels", "2dModels"],
          isPrimaryView: true,
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
      id: "ui-item-provider-test:network-tracing-stage-content",
      layout: StandardContentLayouts.singleView,
      contents: [
        {
          id: "primaryContent",
          classId: IModelViewportControl.id,
          applicationData: {
            isPrimaryView: true,
            supports: ["issueResolutionMarkers", "viewIdSelection", "3dModels", "2dModels"],
            viewState: UiFramework.getDefaultViewState,
            iModelConnection: UiFramework.getIModelConnection,
          },
        },
      ],
    });
  }
}

/**
 * This class is used to register a new frontstage that is called 'NetworkTracing' but it provides no real tools to do that work,
 * it is simply used as a test defining a stage and providing its UI components via an UiItemsProvider.
 */
export class NetworkTracingFrontstage {
  public static stageId = "ui-item-provider-test:NetworkTracing";
  private static _contentGroupProvider = new NetworkTracingContentGroupProvider();
  public static register() {
    const cornerButton = <BackstageAppButton icon={"icon-bentley-systems"} />;
    const networkTracingStageProps: StandardFrontstageProps = {
      id: NetworkTracingFrontstage.stageId,
      version: 1.1,
      contentGroupProps: NetworkTracingFrontstage._contentGroupProvider,
      hideNavigationAid: false,
      cornerButton,
      usage: StageUsage.Private,
      applicationData: undefined,
    };

    NetworkTracingFrontstage.registerToolProviders();
    ConfigurableUiManager.addFrontstageProvider(new StandardFrontstageProvider(networkTracingStageProps));
  }

  private static registerToolProviders() {
    // Provides standard tools for ToolWidget in ui2.0 stage
    StandardContentToolsProvider.register("networkContentTools", {
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
    }, (stageId: string, _stageUsage: string, _applicationData: any) => {
      return stageId === NetworkTracingFrontstage.stageId;
    });

    /** Provides standard tools for NavigationWidget */
    StandardNavigationToolsProvider.register("networkNavigationTools", undefined, (stageId: string, _stageUsage: string, _applicationData: any) => {
      return stageId === NetworkTracingFrontstage.stageId;
    });

    /** Provides standard status fields */
    StandardStatusbarItemsProvider.register("networkStatusFields", undefined, (stageId: string, _stageUsage: string, _applicationData: any) => {
      return stageId === NetworkTracingFrontstage.stageId;
    });

    // register stage specific items provider
    NetworkTracingUiProvider.register();
  }
}

