/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import {
  BackstageAppButton, ContentGroup, CoreTools,
  Frontstage, FrontstageProps, FrontstageProvider, IModelViewportControl,
  SimpleNavigationWidget, SimpleStatusBarWidgetControl, SimpleToolWidget, StagePanel, StagePanelState, SyncUiEventArgs,
  SyncUiEventDispatcher, ToolbarHelper, UiFramework, Widget, Zone,
} from "@bentley/ui-framework";
import { CommonToolbarItem, StageUsage } from "@bentley/ui-abstract";
import { ScreenViewport } from "@bentley/imodeljs-frontend";
import { AppTools } from "../../tools/ToolSpecifications";
import { SampleAppIModelApp, SampleAppUiActionId } from "../..";

/* eslint-disable react/jsx-key */

export function MyCustomViewOverlay() {
  const [syncIdsOfInterest] = React.useState([SampleAppUiActionId.setTestProperty]);
  const [showOverlay, setShowOverlay] = React.useState(SampleAppIModelApp.getTestProperty() !== "HIDE");

  React.useEffect(() => {
    const handleSyncUiEvent = (args: SyncUiEventArgs) => {
      if (0 === syncIdsOfInterest.length)
        return;

      // istanbul ignore else
      if (syncIdsOfInterest.some((value: string): boolean => args.eventIds.has(value))) {
        const show = SampleAppIModelApp.getTestProperty() !== "HIDE";
        if (show !== showOverlay)
          setShowOverlay(show);
      }
    };

    // Note: that items with conditions have condition run when loaded into the items manager
    SyncUiEventDispatcher.onSyncUiEvent.addListener(handleSyncUiEvent);
    return () => {
      SyncUiEventDispatcher.onSyncUiEvent.removeListener(handleSyncUiEvent);
    };
  }, [setShowOverlay, showOverlay, syncIdsOfInterest]);

  return showOverlay ?
    <div className="uifw-view-overlay">
      <div className="my-custom-control" style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        height: "100%",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
      }}>
        <div>Hello World</div>
        <div>(turn off using Hide/Show items tool in horizontal toolbar at top-left)</div>
      </div>
    </div> : null;
}

export class FrontstageUi2 extends FrontstageProvider {
  private _supplyViewOverlay = (viewport: ScreenViewport) => {
    if (viewport.view) {
      return <MyCustomViewOverlay />;
    }
    return null;
  };

  public additionalHorizontalToolbarItems: CommonToolbarItem[] = [
    ToolbarHelper.createToolbarItemFromItemDef(10, AppTools.toggleHideShowItemsCommand, { groupPriority: 3000 }),
  ];

  public get frontstage(): React.ReactElement<FrontstageProps> {
    const myContentGroup: ContentGroup = new ContentGroup(
      {
        contents: [
          {
            id: "primaryContent",
            classId: IModelViewportControl.id,
            applicationData: { viewState: UiFramework.getDefaultViewState, iModelConnection: UiFramework.getIModelConnection, supplyViewOverlay: this._supplyViewOverlay },
          },
        ],
      },
    );

    return (
      <Frontstage id="Ui2"
        version={1.1}
        defaultTool={CoreTools.selectElementCommand}
        defaultLayout="SingleContent"
        contentGroup={myContentGroup}
        defaultContentId="singleIModelView"
        isInFooterMode={true}
        usage={StageUsage.General}
        applicationData={
          {
            verticalContentToolGroups: {
              selectElementGroupPriority: 100,
              measureGroupPriority: 200,
              selectionGroupPriority: 300,
            },
            horizontalContentToolGroups: {
              clearSelectionGroupPriority: 100,
              overridesGroupPriority: 200,
            },
          }
        }

        contentManipulationTools={
          <Zone
            widgets={
              [
                <Widget isFreeform={true} element={<SimpleToolWidget cornerButton={<BackstageAppButton icon={"icon-bentley-systems"} />}
                  horizontalItems={this.additionalHorizontalToolbarItems} />} />,
              ]}
          />
        }
        viewNavigationTools={
          <Zone
            widgets={
              [
                <Widget isFreeform={true} element={<SimpleNavigationWidget />} />,
              ]}
          />
        }
        toolSettings={
          <Zone
            widgets={
              [
                <Widget isToolSettings={true} />,
              ]}
          />
        }
        statusBar={
          <Zone
            widgets={
              [
                <Widget isStatusBar={true} control={SimpleStatusBarWidgetControl} />,
              ]}
          />
        }

        leftPanel={
          <StagePanel
            size={300}
            defaultState={StagePanelState.Minimized}
          />
        }

        topPanel={
          <StagePanel
            size={90}
            pinned={false}
            defaultState={StagePanelState.Minimized}
          />
        }

        rightPanel={
          <StagePanel
            defaultState={StagePanelState.Open}
          />
        }

        bottomPanel={
          <StagePanel
            size={180}
            defaultState={StagePanelState.Open}
          />
        }
      />
    );
  }
}
