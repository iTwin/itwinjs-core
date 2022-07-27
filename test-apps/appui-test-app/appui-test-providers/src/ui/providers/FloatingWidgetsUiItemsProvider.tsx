/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import {
  AbstractWidgetProps,
  StagePanelLocation, StagePanelSection,
  StageUsage,
  UiItemsProvider, WidgetState,
} from "@itwin/appui-abstract";
import { ViewAttributesWidgetComponent } from "../widgets/ViewAttributesWidget";

/**
 * Test UiItemsProvider that provide FloatingWidgets in any General usage stage.
 */
export class FloatingWidgetsUiItemsProvider implements UiItemsProvider {
  public static providerId = "appui-test-providers:FloatingWidgetsUiProvider";
  public readonly id = FloatingWidgetsUiItemsProvider.providerId;

  public provideWidgets(_stageId: string, stageUsage: string, location: StagePanelLocation,
    section?: StagePanelSection): ReadonlyArray<AbstractWidgetProps> {
    const widgets: AbstractWidgetProps[] = [];
    if (stageUsage === StageUsage.General && location === StagePanelLocation.Left && section === StagePanelSection.Start) {
      const widget: AbstractWidgetProps = {
        id: "appui-test-providers:ViewAttributesWidget",
        label: "View Attributes",
        icon: "icon-window-settings",
        defaultState: WidgetState.Floating,
        isFloatingStateSupported: true,
        floatingContainerId: "appui-test-providers:ViewAttributesWidget",
        // eslint-disable-next-line react/display-name
        getWidgetContent: () => {
          return <ViewAttributesWidgetComponent />;
        },
        canPopout: true,
      };

      widgets.push(widget);
    }
    return widgets;
  }
}
