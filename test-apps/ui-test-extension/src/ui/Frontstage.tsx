/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { IModelApp } from "@bentley/imodeljs-frontend";
import {
  BasicNavigationWidget, BasicToolWidget, ClassGroupingOption, ContentGroup, ContentLayoutDef, CoreTools,
  Frontstage, FrontstageProps, FrontstageProvider, IModelViewportControl, ModelsTreeNodeType, StagePanel,
  StagePanelState, UiFramework, VisibilityComponentHierarchy, VisibilityWidget, Widget, Zone,
} from "@bentley/ui-framework";
import { SelectionMode } from "@bentley/ui-components";
import { CommonToolbarItem, StageUsage, WidgetState } from "@bentley/ui-abstract";
import { NodeKey } from "@bentley/presentation-common";

import { ExtensionStatusBarWidgetControl } from "./statusbar/StatusBar";
import { GenericTool } from "./tools/GenericTool";

/* eslint-disable react/jsx-key, deprecation/deprecation */

export class ExtensionFrontstage extends FrontstageProvider {
  public static get id() {
    return "ui-test.SampleStage";
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
    const pluginContentLayoutDef: ContentLayoutDef = new ContentLayoutDef(
      {
        id: "ui-test.TwoHalvesHorizontal",
        descriptionKey: "ContentDef.TwoStacked",
        priority: 50,
        horizontalSplit: { id: "TwoHalvesHorizontal.HorizontalSplit", percentage: 0.80, top: 0, bottom: 1 },
      });

    const pluginContentGroup: ContentGroup = new ContentGroup(
      {
        contents: [
          {
            classId: IModelViewportControl,
            applicationData: { viewState: this._getViewState, iModelConnection: UiFramework.getIModelConnection },
          },
          {
            classId: "SampleExtensionContentControl",
          },
        ],
      },
    );

    return (
      <Frontstage id={ExtensionFrontstage.id}
        version={1.2}
        defaultTool={CoreTools.selectElementCommand}
        defaultLayout={pluginContentLayoutDef}
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
        rightPanel={
          <StagePanel
            defaultState={StagePanelState.Open}
            panelZones={
              {
                middle: {
                  widgets: [
                    <Widget iconSpec={VisibilityWidget.iconSpec} label={VisibilityWidget.label} control={VisibilityWidget}
                      applicationData={{
                        iModelConnection: UiFramework.getIModelConnection(),
                        enableHierarchiesPreloading: [VisibilityComponentHierarchy.Categories],
                        config: {
                          modelsTree: {
                            selectionMode: SelectionMode.Extended,
                            selectionPredicate: (_key: NodeKey, type: ModelsTreeNodeType) => (type === ModelsTreeNodeType.Element || type === ModelsTreeNodeType.Grouping),
                            enableElementsClassGrouping: ClassGroupingOption.YesWithCounts,
                          },
                          spatialContainmentTree: {
                            enableElementsClassGrouping: ClassGroupingOption.YesWithCounts,
                          },
                        },
                      }}
                      fillZone={true} />,
                  ],
                },
              }}
          />
        }
      />
    );
  }
}
