/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { useSelector } from "react-redux";

import {
  BackstageAppButton, BackstageManager, CommandItemDef, ConfigurableUiManager, ContentGroup, ContentGroupProps, ContentGroupProvider, ContentProps,
  FrontstageManager, FrontstageProps,
  IModelViewportControl, StagePanelState, StandardContentToolsUiItemsProvider, StandardFrontstageProps, StandardFrontstageProvider,
  StandardNavigationToolsUiItemsProvider,
  StandardStatusbarUiItemsProvider,
  StateManager,
  UiFramework,
} from "@itwin/appui-react";
import {
  ConditionalStringValue,
  StageUsage, StandardContentLayouts, UiItemsManager, WidgetState,
} from "@itwin/appui-abstract";
import { getSavedViewLayoutProps } from "../../tools/ContentLayoutTools";
import { WidgetApiStageUiItemsProvider } from "../providers/WidgetApiStageUiItemsProvider";
import { getTestProviderState, setShowCustomViewOverlay, TestProviderState } from "../../store";
import { AppUiTestProviders } from "../../AppUiTestProviders";
import { IModelApp, ScreenViewport } from "@itwin/core-frontend";
import { SvgSmileyHappyVery } from "@itwin/itwinui-icons-react";

/**
 * The WidgetApiStageContentGroupProvider class method `provideContentGroup` returns a ContentGroup that displays
 * a single content view and also defines a custom view overlay. The display of the view overlay in its applicationData.
 */
export class WidgetApiStageContentGroupProvider extends ContentGroupProvider {
  /* eslint-disable react/jsx-key */
  public static supplyViewOverlay = (viewport: ScreenViewport) => {
    if (viewport.view) {
      return <MyCustomViewOverlay />;
    }
    return null;
  };

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
    const newContentsArray = contentGroupProps.contents.map((content: ContentProps, index) => {
      const newContent = { ...content };

      if (newContent.classId === IModelViewportControl.id) {
        newContent.applicationData = {
          ...newContent.applicationData,
          supplyViewOverlay: index === 0 ? WidgetApiStageContentGroupProvider.supplyViewOverlay : undefined,
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

  public async provideContentGroup(props: FrontstageProps): Promise<ContentGroup> { // eslint-disable-line deprecation/deprecation
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
      id: "widget-api-stage-frontstage-main-content-group",
      layout: StandardContentLayouts.singleView,
      contents: [
        {
          id: "primaryContent",
          classId: IModelViewportControl.id,
          applicationData: {
            supplyViewOverlay: WidgetApiStageContentGroupProvider.supplyViewOverlay,
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

export class WidgetApiStage {
  public static stageId = "appui-test-providers:WidgetApi";

  private static _contentGroupProvider = new WidgetApiStageContentGroupProvider();

  public static supplyAppData(_id: string, _applicationData?: any) {
    return {
      viewState: UiFramework.getDefaultViewState,
      iModelConnection: UiFramework.getIModelConnection,
    };
  }

  public static register(localizationNamespace: string) {
    // set up custom corner button where we specify icon, label, and action
    const cornerButton = <BackstageAppButton key="appui-test-providers-WidgetApi-backstage" label="Toggle Backstage" icon={"icon-bentley-systems"}
      execute={() => BackstageManager.getBackstageToggleCommand().execute()} />;

    const widgetApiStageProps: StandardFrontstageProps = {
      id: WidgetApiStage.stageId,
      version: 1.1,
      contentGroupProps: WidgetApiStage._contentGroupProvider,
      cornerButton,
      usage: StageUsage.General,
      topPanelProps: {
        resizable: true,
        pinned: true,
        defaultState: StagePanelState.Open,
      },
      leftPanelProps: {
        resizable: true,
        pinned: true,
        defaultState: StagePanelState.Open,
      },
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
    }), { providerId: "widget-api-stage-standardContentTools", stageIds: [WidgetApiStage.stageId] });

    // Provides standard tools for NavigationWidget in stage
    UiItemsManager.register(new StandardNavigationToolsUiItemsProvider(), { providerId: "widget-api-stage-standardNavigationTools", stageIds: [WidgetApiStage.stageId] });

    // Provides standard status fields for stage
    UiItemsManager.register(new StandardStatusbarUiItemsProvider(), { providerId: "widget-api-stage-standardStatusItems", stageIds: [WidgetApiStage.stageId] });

    // Provides example widgets stage and tool to toggle display of Custom overlay.
    WidgetApiStageUiItemsProvider.register(localizationNamespace);
  }
}

// Return CommandItemDef that can be used to provide a toolbar button.
export function getToggleCustomOverlayCommandItemDef() {
  const commandId = "testHideShowItems";
  return new CommandItemDef({
    commandId,
    iconSpec: new ConditionalStringValue(() => getTestProviderState().showCustomViewOverlay ? "icon-zoom-out" : "icon-zoom-in", [AppUiTestProviders.syncEventIdHideCustomViewOverlay]),
    label: new ConditionalStringValue(() => getTestProviderState().showCustomViewOverlay ? "Hide overlay" : "Show overlay", [AppUiTestProviders.syncEventIdHideCustomViewOverlay]),

    execute: () => {
      const showCustomViewOverlay = getTestProviderState().showCustomViewOverlay;
      StateManager.store.dispatch(setShowCustomViewOverlay(!showCustomViewOverlay));
      IModelApp.toolAdmin.dispatchUiSyncEvent(AppUiTestProviders.syncEventIdHideCustomViewOverlay);
    },
  });
}

export function getShowHideFloatingWidgetCommandItemDef() {
  const commandId = "testHideShowFloatingWidget";
  return new CommandItemDef({
    commandId,
    iconSpec: <SvgSmileyHappyVery />,
    label: "Toggle Hidden Floating Widget Display",

    execute: () => {
      const def = FrontstageManager.activeFrontstageDef?.findWidgetDef("FW-H1");
      if (def) {
        const currentState = FrontstageManager.activeFrontstageDef?.getWidgetCurrentState(def);
        def.setWidgetState(currentState === WidgetState.Floating ? WidgetState.Hidden : WidgetState.Floating);
      }
    },
  });
}

/*
 * Simple View overlay that just displays static React component. The display of the overlay is controlled
 * based on a variable in the Redux store which can be seen in file `..\appui-test-providers\src\store\index.ts`.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export function MyCustomViewOverlay() {

  const showOverlay = useSelector((state: { testProviderState: TestProviderState }) => {
    return !!state.testProviderState.showCustomViewOverlay;
  });

  return showOverlay ?
    <div className="uifw-view-overlay">
      <div className="my-custom-control" style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        height: "100%",
        backgroundColor: "rgba(255, 255, 255, 0.5)",
      }}>
        <div>Hello From View Overlay</div>
        <div>(turn off using Hide/Show Overlay tool in horizontal toolbar at top-left)</div>
      </div>
    </div> : null;
}
