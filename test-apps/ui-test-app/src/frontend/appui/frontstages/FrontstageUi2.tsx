/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import {
  ContentGroup, ContentGroupProps, ContentToolWidgetComposer,
  CoreTools, Frontstage, FrontstageProps, FrontstageProvider,
  IModelViewportControl, StagePanel, StagePanelState, SyncUiEventArgs, SyncUiEventDispatcher,
  UiFramework, ViewToolWidgetComposer, Widget, Zone,
} from "@bentley/ui-framework";
import { StageUsage } from "@bentley/ui-abstract";
import { ScreenViewport } from "@bentley/imodeljs-frontend";
import { SampleAppIModelApp, SampleAppUiActionId } from "../..";

/* eslint-disable react/jsx-key */
const supplyViewOverlay = (viewport: ScreenViewport) => {
  if (viewport.view) {
    return <MyCustomViewOverlay />;
  }
  return null;
};

export const ui2ContentGroupProps: ContentGroupProps = {
  id: "main-content-group",
  preferredLayoutId: "SingleContent",
  contents: [
    {
      id: "primaryContent",
      classId: IModelViewportControl.id,
      applicationData: {
        viewState: UiFramework.getDefaultViewState,
        iModelConnection: UiFramework.getIModelConnection,
        supplyViewOverlay,
      },
    },
  ],
};

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

  public get frontstage(): React.ReactElement<FrontstageProps> {
    const myContentGroup: ContentGroup = new ContentGroup(ui2ContentGroupProps);

    return (
      <Frontstage id="Ui2"
        version={1.1}
        defaultTool={CoreTools.selectElementCommand}
        contentGroup={myContentGroup}
        defaultContentId="singleIModelView"
        isInFooterMode={true}
        usage={StageUsage.General}
        applicationData={{
          defaultContentTools: {
            vertical: {
              selectElementGroupPriority: 100,
              measureGroupPriority: 200,
              selectionGroupPriority: 300,
            },
            horizontal: {
              clearSelectionGroupPriority: 100,
              overridesGroupPriority: 200,
            },
          },
        }}

        contentManipulationTools={
          < Zone
            widgets={
              [
                <Widget isFreeform={true}
                  element={<ContentToolWidgetComposer />} /* cornerButton={<BackstageAppButton icon={"icon-bentley-systems"} />} */
                />,
              ]}
          />
        }
        viewNavigationTools={
          < Zone
            widgets={
              [
                <Widget isFreeform={true} element={<ViewToolWidgetComposer hideNavigationAid />} />,
              ]}
          />
        }
        toolSettings={
          < Zone
            widgets={
              [
                <Widget isToolSettings={true} />,
              ]}
          />
        }
        statusBar={ /* if stage does not need statusBar then do not include this entry */
          < Zone
            widgets={
              [
                <Widget isStatusBar={true} />, // <Widget isStatusBar={true} control={StatusBarWidgetComposerControl} />,
              ]}
          />
        }

        leftPanel={
          < StagePanel
            size={300}
            defaultState={StagePanelState.Minimized}
          />
        }

        topPanel={
          < StagePanel
            size={90}
            pinned={false}
            defaultState={StagePanelState.Minimized}
          />
        }

        rightPanel={
          < StagePanel
            defaultState={StagePanelState.Open}
          />
        }

        bottomPanel={
          < StagePanel
            size={180}
            defaultState={StagePanelState.Open}
          />
        }
      />
    );
  }
}
