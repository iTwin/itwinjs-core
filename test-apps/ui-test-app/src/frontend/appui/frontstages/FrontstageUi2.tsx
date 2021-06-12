/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import {
  BasicNavigationWidget, BasicToolWidget, ContentGroup, CoreTools,
  Frontstage, FrontstageProps, FrontstageProvider, IModelViewportControl, StagePanel, StagePanelState, SyncUiEventArgs, SyncUiEventDispatcher, ToolbarHelper, UiFramework, Widget, Zone,
} from "@bentley/ui-framework";
import { CommonToolbarItem, StageUsage, WidgetState } from "@bentley/ui-abstract";
import { ScreenViewport } from "@bentley/imodeljs-frontend";
import { AppTools } from "../../tools/ToolSpecifications";
import { SampleAppIModelApp, SampleAppUiActionId } from "../..";
import { LayoutControls, LayoutInfo } from "../widgets/LayoutWidget";

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
    ToolbarHelper.createToolbarItemFromItemDef(0, CoreTools.keyinBrowserButtonItemDef, { groupPriority: -10 }),
    ToolbarHelper.createToolbarItemFromItemDef(135, AppTools.toggleHideShowItemsCommand, { groupPriority: 30 }),
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
        applicationData={{ key: "value" }}
        contentManipulationTools={
          <Zone
            widgets={
              [
                <Widget isFreeform={true} element={<BasicToolWidget additionalHorizontalItems={this.additionalHorizontalToolbarItems} />} />,
              ]}
          />
        }
        viewNavigationTools={
          <Zone
            widgets={
              [
                <Widget isFreeform={true} element={<BasicNavigationWidget />} />,
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
                <Widget isStatusBar={true} classId="SmallStatusBar" />,
              ]}
          />
        }

        leftPanel={
          <StagePanel
            size={300}
            defaultState={StagePanelState.Minimized}
            panelZones={{
              start: {
                widgets: [
                  <Widget id="LeftStart1" canPopout={true} label="Start1" defaultState={WidgetState.Open} element={<h2>Left Start1 widget</h2>} />,
                  <Widget id="LeftStart2" canPopout={true} label="Start2" element={<h2>Left Start2 widget</h2>} />,
                ],
              },
              middle: {
                widgets: [
                  <Widget id="LeftMiddle1" label="Middle1" element={<h2>Left Middle1 widget</h2>} />,
                  <Widget id="LeftMiddle2" canPopout={true} label="Middle2" defaultState={WidgetState.Open} element={<h2>Left Middle2 widget</h2>} />,
                ],
              },
              end: {
                widgets: [
                  <Widget id="LeftEnd1" label="End1" defaultState={WidgetState.Open} element={<h2>Left End1 widget</h2>} />,
                  <Widget id="LeftEnd2" label="End2" element={<h2>Left End2 widget</h2>} />,
                ],
              },
            }}
          />
        }

        topPanel={
          <StagePanel
            size={90}
            defaultState={StagePanelState.Minimized}
            panelZones={{
              start: {
                widgets: [
                  <Widget id="TopStart1" label="Start1" defaultState={WidgetState.Open} element={<h2>Top Start1 widget</h2>} />,
                  <Widget id="TopStart2" label="Start2" element={<h2>Top Start2 widget</h2>} />,
                ],
              },
              end: {
                widgets: [
                  <Widget id="TopEnd1" canPopout={true} label="End1" element={<h2>Top End1 widget</h2>} />,
                  <Widget id="TopEnd2" label="End2" defaultState={WidgetState.Open} element={<h2>Top End2 widget</h2>} />,
                ],
              },
            }}
          />
        }

        rightPanel={
          <StagePanel
            defaultState={StagePanelState.Open}
            panelZones={{
              start: {
                widgets: [
                  <Widget id="RightStart1" canPopout={true} label="Start1" element={<h2>Right Start1 widget</h2>} />,
                  <Widget id="RightStart2" canPopout={true} label="Start2" defaultState={WidgetState.Open} element={<h2>Right Start2 widget</h2>} />,
                ],
              },
              middle: {
                widgets: [
                  <Widget id="RightMiddle1" label="Middle1" defaultState={WidgetState.Open} element={<h2>Right Middle1 widget</h2>} />,
                  <Widget id="RightMiddle2" canPopout={true} label="Middle2" element={<h2>Right Middle2 widget</h2>} />,
                ],
              },
              end: {
                widgets: [
                  <Widget id="RightEnd1" label="End1" element={<h2>Right End1 widget</h2>} />,
                  <Widget id="RightEnd2" canPopout={true} label="End2" defaultState={WidgetState.Open} element={<h2>Right End2 widget</h2>} />,
                ],
              },
            }}
          />
        }

        bottomPanel={
          <StagePanel
            size={180}
            defaultState={StagePanelState.Open}
            panelZones={{
              start: {
                widgets: [
                  <Widget id="BottomStart1" label="Start1" element={<h2>Bottom Start1 widget</h2>} />,
                  <Widget id="BottomStart2" canPopout={true} label="Start2" defaultState={WidgetState.Open} element={<LayoutInfo />} />,
                ],
              },
              end: {
                widgets: [
                  <Widget id="BottomEnd1" canPopout={true} label="End1" element={<h2>Bottom End1 widget</h2>} />,
                  <Widget id="BottomEnd2" label="End2" defaultState={WidgetState.Open} element={<LayoutControls />} />,
                ],
              },
            }}
          />
        }
      />
    );
  }
}
