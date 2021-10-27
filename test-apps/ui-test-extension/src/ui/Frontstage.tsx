/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { IModelApp } from "@itwin/core-frontend";
import { CommonToolbarItem, StageUsage, StandardContentLayouts, WidgetState } from "@itwin/appui-abstract";
import {
  BasicNavigationWidget, BasicToolWidget, ContentGroup, CoreTools, Frontstage, FrontstageProps, FrontstageProvider,
  IModelViewportControl, StagePanel, StagePanelState, UiFramework, Widget, Zone,
} from "@itwin/appui-react";
import { ExtensionStatusBarWidgetControl } from "./statusbar/StatusBar";
import { GenericTool } from "./tools/GenericTool";

/* eslint-disable react/jsx-key, deprecation/deprecation */

export class ExtensionFrontstage extends FrontstageProvider {
  public static stageId = "ui-test.SampleStage";
  public get id(): string {
    return ExtensionFrontstage.stageId;
  }

  private get _additionalVerticalToolWidgetItems(): CommonToolbarItem[] {
    return ([GenericTool.getActionButtonDef(400)]);
  }

  private _getViewState = () => {
    const firstOpenedViewState = UiFramework.getDefaultViewState();
    if (firstOpenedViewState)
      return firstOpenedViewState;

    const vp = IModelApp.viewManager.getFirstOpenView();
    if (vp)
      return vp.view;
    return undefined;
  };

  public get frontstage(): React.ReactElement<FrontstageProps> {
    const pluginContentGroup: ContentGroup = new ContentGroup(
      {
        id: "ui-test:content-group",
        layout: StandardContentLayouts.twoHorizontalSplit,
        contents: [
          {
            id: "ui-test:primary",
            classId: IModelViewportControl,
            applicationData: { viewState: this._getViewState, iModelConnection: UiFramework.getIModelConnection },
          },
          {
            id: "ui-test:primary",
            classId: "SampleExtensionContentControl",
          },
        ],
      },
    );

    return (
      <Frontstage id={this.id}
        version={1.2}
        defaultTool={CoreTools.selectElementCommand}
        contentGroup={pluginContentGroup}
        defaultContentId="singleIModelView"
        isInFooterMode={true}
        usage={StageUsage.Private}
        contentManipulationTools={
          <Zone
            widgets={
              [
                <Widget isFreeform={true} element={<BasicToolWidget additionalVerticalItems={this._additionalVerticalToolWidgetItems} />} />,
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
                <Widget isStatusBar={true} control={ExtensionStatusBarWidgetControl} />,
              ]}
          />
        }
        leftPanel={
          <StagePanel
            defaultState={StagePanelState.Minimized}
            panelZones={
              {
                start: {
                  widgets: [
                    <Widget id="LeftStart1" defaultState={WidgetState.Closed} label="Start1" element={<h2>Left Start1 widget</h2>} />,
                  ],
                },
              }}
          />
        }
      />
    );
  }
}
