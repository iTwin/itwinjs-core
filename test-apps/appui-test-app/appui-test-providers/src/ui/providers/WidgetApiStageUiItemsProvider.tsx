/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable react/display-name */

import * as React from "react";
import {
  AbstractWidgetProps, BackstageItem, BackstageItemUtilities, CommonToolbarItem, StagePanelLocation, StagePanelSection,
  ToolbarOrientation, ToolbarUsage, UiItemsManager, UiItemsProvider, WidgetState,
} from "@itwin/appui-abstract";
import { ToolbarHelper } from "@itwin/appui-react";
import { getToggleCustomOverlayCommandItemDef, WidgetApiStage } from "../frontstages/WidgetApiStage";
import { FloatingLayoutInfo, LayoutControls, LayoutInfo } from "../widgets/LayoutWidget";
import { AppUiTestProviders } from "../../AppUiTestProviders";

export class WidgetApiStageUiItemsProvider implements UiItemsProvider {
  public static providerId = "appui-test-providers:widget-api-stage";
  public readonly id = WidgetApiStageUiItemsProvider.providerId;

  public static register(localizationNamespace: string) {
    UiItemsManager.register(new WidgetApiStageUiItemsProvider(localizationNamespace), { stageIds: [WidgetApiStage.stageId] });
  }

  constructor(_localizationNamespace: string) {
    // register any tools here
  }

  public static unregister() {
    UiItemsManager.unregister(WidgetApiStageUiItemsProvider.providerId);
  }

  private getLeftPanelWidgets(section?: StagePanelSection | undefined) {
    const widgets: AbstractWidgetProps[] = [];

    if (section === StagePanelSection.Start) {
      widgets.push(
        {
          id: "LeftStart1",
          label: "Start1",
          icon: "icon-app-1",
          canPopout: true,
          defaultState: WidgetState.Open,
          getWidgetContent: () => <h2>Left Start1 widget</h2>,
          isFloatingStateSupported: true,
        });
      widgets.push(
        {
          id: "LeftStart2",
          label: "Start2",
          canPopout: true,
          icon: "icon-app-2",
          defaultState: WidgetState.Open,
          getWidgetContent: () => <h2>Left Start2 widget</h2>,
          isFloatingStateSupported: true,
        }
      );
      // eslint-disable-next-line deprecation/deprecation
    } else if (section === StagePanelSection.Middle) { // used to ensure deprecated panel section is properly shown in End section
      widgets.push(
        {
          id: "LeftMiddle1",
          label: "Middle1",
          icon: "icon-smiley-happy",
          canPopout: false,
          getWidgetContent: () => <h2>Left Middle1 widget</h2>,
          isFloatingStateSupported: true,
        });
      widgets.push(
        {
          id: "LeftMiddle2",
          label: "Middle2",
          icon: "icon-smiley-sad",
          defaultState: WidgetState.Open,
          canPopout: true,
          getWidgetContent: () => <h2>Left Middle2 widget</h2>,
          isFloatingStateSupported: true,
        }
      );
    } else if (section === StagePanelSection.End) {
      widgets.push(
        {
          id: "LeftEnd1",
          label: "End1",
          icon: "icon-smiley-happy-very",
          canPopout: true,
          getWidgetContent: () => <h2>Left  End1 widget</h2>,
          isFloatingStateSupported: true,
        });
      widgets.push(
        {
          id: "LeftEnd2",
          label: "End2",
          icon: "icon-smiley-sad-very",
          canPopout: true,
          defaultState: WidgetState.Open,
          getWidgetContent: () => <h2>Left End2 widget</h2>,
          isFloatingStateSupported: true,
        }
      );
    }
    return widgets;
  }

  private getRightPanelWidgets(section?: StagePanelSection | undefined) {
    const widgets: AbstractWidgetProps[] = [];

    if (section === StagePanelSection.Start) {
      widgets.push(
        {
          id: "RightStart1",
          label: "Start1",
          icon: "icon-text-align-text-align-left",
          canPopout: true,
          defaultState: WidgetState.Open,
          getWidgetContent: () => <h2>Right Start1 widget</h2>,
          isFloatingStateSupported: true,
        });
      widgets.push(
        {
          id: "RightStart2",
          label: "Start2",
          icon: "icon-text-align-text-align-right",
          canPopout: true,
          defaultState: WidgetState.Hidden,
          getWidgetContent: () => <h2>Right Start2 widget</h2>,
          isFloatingStateSupported: true,
        }
      );
      // eslint-disable-next-line deprecation/deprecation
    } else if (section === StagePanelSection.Middle) { // used to ensure deprecated panel section is properly shown in End section
      widgets.push(
        {
          id: "RightMiddle1",
          label: "Middle1",
          icon: "icon-text-align-text-align-center",
          canPopout: false,
          getWidgetContent: () => <h2>Right Middle1 widget</h2>,
          isFloatingStateSupported: true,
        });
      widgets.push(
        {
          id: "RightMiddle2",
          label: "Middle2",
          icon: "icon-text-align-text-align-justify",
          defaultState: WidgetState.Open,
          canPopout: true,
          getWidgetContent: () => <h2>Right Middle2 widget</h2>,
          isFloatingStateSupported: true,
        }
      );
    } else if (section === StagePanelSection.End) {
      widgets.push(
        {
          id: "RightEnd1",
          label: "End1",
          icon: "icon-user",
          canPopout: true,
          getWidgetContent: () => <h2>Right  End1 widget</h2>,
          isFloatingStateSupported: true,
        });
      widgets.push(
        {
          id: "RightEnd2",
          label: "End2",
          icon: "icon-users",
          canPopout: true,
          defaultState: WidgetState.Open,
          getWidgetContent: () => <h2>Right End2 widget</h2>,
          isFloatingStateSupported: true,
        }
      );
    }
    return widgets;
  }

  private getTopPanelWidgets(section?: StagePanelSection | undefined) {
    const widgets: AbstractWidgetProps[] = [];

    if (section === StagePanelSection.Start) {
      widgets.push(
        {
          id: "TopStart1",
          label: "Start1",
          canPopout: true,
          defaultState: WidgetState.Open,
          getWidgetContent: () => <h2>Top Start1 widget</h2>,
          isFloatingStateSupported: true,
          defaultFloatingSize: { width: 400, height: 600 },
          isFloatingStateWindowResizable: true,
        });
      widgets.push(
        {
          id: "TopStart2",
          label: "Start2",
          canPopout: true,
          getWidgetContent: () => <h2>Top Start2 widget</h2>,
          isFloatingStateSupported: true,
        }
      );
    } else if (section === StagePanelSection.End) {
      widgets.push(
        {
          id: "TopEnd1",
          label: "End1",
          canPopout: true,
          getWidgetContent: () => <h2>Top  End1 widget</h2>,
          isFloatingStateSupported: true,
        });
      widgets.push(
        {
          id: "TopEnd2",
          label: "End2",
          canPopout: true,
          defaultState: WidgetState.Open,
          getWidgetContent: () => <h2>Top End2 widget</h2>,
          isFloatingStateSupported: true,
        }
      );
    }
    return widgets;
  }

  private getBottomPanelWidgets(section?: StagePanelSection | undefined) {
    const widgets: AbstractWidgetProps[] = [];

    if (section === StagePanelSection.Start) {
      widgets.push(
        {
          id: "BottomStart1",
          label: "Floating Info",
          canPopout: true,
          defaultState: WidgetState.Open,
          getWidgetContent: () => <FloatingLayoutInfo />,
          isFloatingStateSupported: true,
        });
      widgets.push(
        {
          id: "BottomStart2",
          label: "Layout Info",
          canPopout: true,
          getWidgetContent: () => <LayoutInfo />,
          isFloatingStateSupported: true,
        }
      );
    } else if (section === StagePanelSection.End) {
      widgets.push(
        {
          id: "BottomEnd1",
          label: "End1",
          canPopout: true,
          getWidgetContent: () => <h2>Bottom  End1 widget</h2>,
          isFloatingStateSupported: true,
        });
      widgets.push(
        {
          id: "BottomEnd2",
          label: "Layout Controls",
          canPopout: true,
          defaultState: WidgetState.Open,
          getWidgetContent: () => <LayoutControls />,
          isFloatingStateSupported: true,
        }
      );
    }
    return widgets;
  }

  public provideWidgets(stageId: string, _stageUsage: string, location: StagePanelLocation, section?: StagePanelSection | undefined): ReadonlyArray<AbstractWidgetProps> {
    const allowedStages = [WidgetApiStage.stageId];
    if (allowedStages.includes(stageId)) {
      switch (location) {
        case StagePanelLocation.Left:
          return this.getLeftPanelWidgets(section);
        case StagePanelLocation.Right:
          return this.getRightPanelWidgets(section);
        case StagePanelLocation.Top:
          return this.getTopPanelWidgets(section);
        case StagePanelLocation.Bottom:
          return this.getBottomPanelWidgets(section);
      }
    }

    return [];
  }

  public provideToolbarButtonItems(stageId: string, _stageUsage: string, toolbarUsage: ToolbarUsage, toolbarOrientation: ToolbarOrientation): CommonToolbarItem[] {
    const allowedStages = [WidgetApiStage.stageId];
    if (allowedStages.includes(stageId)) {
      if (toolbarUsage === ToolbarUsage.ContentManipulation && toolbarOrientation === ToolbarOrientation.Horizontal) {
        const items: CommonToolbarItem[] = [];
        items.push(ToolbarHelper.createToolbarItemFromItemDef(17, getToggleCustomOverlayCommandItemDef(), { groupPriority: 3000 }));
        return items;
      }
    }
    return [];
  }

  public provideBackstageItems(): BackstageItem[] {
    const label = AppUiTestProviders.translate("backstage.widgetApiTestFrontstageLabel");
    return [
      BackstageItemUtilities.createStageLauncher(WidgetApiStage.stageId, 300, 2, label, undefined, undefined),
    ];
  }

}
