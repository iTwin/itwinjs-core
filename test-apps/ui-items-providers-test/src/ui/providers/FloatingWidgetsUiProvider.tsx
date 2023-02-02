/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { CommonWidgetProps, StagePanelLocation, StagePanelSection, StageUsage, UiItemsManager, UiItemsProvider, WidgetState } from "@itwin/appui-react";
import { ViewAttributesWidgetComponent } from "../widgets/ViewAttributesWidget";

/**
 * Test UiItemsProvider that provide FloatingWidgets in any General usage stage.
 */
export class FloatingWidgetsUiProvider implements UiItemsProvider {
  public static providerId = "ui-item-provider-test:FloatingWidgetsUiProvider";
  public readonly id = FloatingWidgetsUiProvider.providerId;

  public static register() {
    UiItemsManager.register(new FloatingWidgetsUiProvider());
  }

  public static unregister() {
    UiItemsManager.unregister(FloatingWidgetsUiProvider.providerId);
  }

  public provideWidgets(_stageId: string, stageUsage: string, location: StagePanelLocation,
    section?: StagePanelSection): ReadonlyArray<CommonWidgetProps> {
    const widgets: CommonWidgetProps[] = [];
    if (stageUsage === StageUsage.General && location === StagePanelLocation.Left && section === StagePanelSection.Start) {
      const widget: CommonWidgetProps = {
        id: "ui-item-provider-test:ViewAttributesWidget",
        label: "View Attributes",
        icon: "icon-window-settings",
        defaultState: WidgetState.Floating,
        isFloatingStateSupported: true,
        floatingContainerId: "ui-item-provider-test:ViewAttributesWidget",
        hideWithUiWhenFloating: true,
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
