/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { ViewAttributesWidgetComponent } from "../widgets/ViewAttributesWidget";
import { CommonWidgetProps, StagePanelLocation, StagePanelSection, StageUsage, UiItemsProvider, WidgetState } from "@itwin/appui-react";

/**
 * Test UiItemsProvider that provide FloatingWidgets in any General usage stage.
 */
export class FloatingWidgetsUiItemsProvider implements UiItemsProvider {
  public static providerId = "appui-test-providers:FloatingWidgetsUiProvider";
  public readonly id = FloatingWidgetsUiItemsProvider.providerId;

  public provideWidgets(_stageId: string, stageUsage: string, location: StagePanelLocation, section?: StagePanelSection): ReadonlyArray<CommonWidgetProps> {
    const widgets: CommonWidgetProps[] = [];
    if (stageUsage === StageUsage.General && location === StagePanelLocation.Left && section === StagePanelSection.Start) {
      widgets.push({
        id: "appui-test-providers:ViewAttributesWidget",
        label: "View Attributes",
        icon: "icon-window-settings",
        defaultState: WidgetState.Floating,
        floatingContainerId: "appui-test-providers:ViewAttributesWidget",
        isFloatingStateSupported: true,
        getWidgetContent: () => { // eslint-disable-line react/display-name
          return <ViewAttributesWidgetComponent />;
        },
        canPopout: true,
        allowedPanelTargets: ["left", "right"],
      });

      widgets.push({
        id: "FW-1",
        label: "FW-1",
        icon: "icon-app-1",
        defaultState: WidgetState.Floating,
        floatingContainerId: "appui-test-providers:floating-widget",
        isFloatingStateSupported: true,
        defaultFloatingPosition: { x: 600, y: 385 },
        getWidgetContent: () => { // eslint-disable-line react/display-name
          return <div>Floating widget 1</div>;
        },
      });
      widgets.push({
        id: "FW-2",
        label: "FW-2",
        icon: "icon-app-2",
        defaultState: WidgetState.Floating,
        floatingContainerId: "appui-test-providers:floating-widget",
        isFloatingStateSupported: true,
        getWidgetContent: () => { // eslint-disable-line react/display-name
          return <div>Floating widget 2</div>;
        },
        allowedPanelTargets: [],
      });
      widgets.push({
        id: "FW-3",
        label: "FW-3",
        icon: "icon-app-1",
        defaultState: WidgetState.Floating,
        floatingContainerId: "appui-test-providers:floating-widget",
        isFloatingStateSupported: true,
        getWidgetContent: () => { // eslint-disable-line react/display-name
          return <div>Floating widget 3</div>;
        },
      });

      widgets.push({
        id: "FW-H1",
        label: "FW-H1",
        icon: "icon-visibility-hide",
        defaultState: WidgetState.Hidden,
        floatingContainerId: "appui-test-providers:hidden-floating-widget",
        isFloatingStateSupported: true,
        getWidgetContent: () => { // eslint-disable-line react/display-name
          return <div>Hidden floating widget 1</div>;
        },
      });
    }
    return widgets;
  }
}
