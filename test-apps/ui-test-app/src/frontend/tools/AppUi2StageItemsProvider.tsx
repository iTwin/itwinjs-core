/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable react/display-name */

import * as React from "react";
import {
  AbstractWidgetProps, CommonToolbarItem, StagePanelLocation, StagePanelSection,
  ToolbarOrientation, ToolbarUsage, UiItemsManager, UiItemsProvider, WidgetState,
} from "@itwin/appui-abstract";
import { BackstageManager, ToolbarHelper } from "@itwin/appui-react";
import { FloatingLayoutInfo, LayoutControls, LayoutInfo } from "../appui/widgets/LayoutWidget";
import { AppTools } from "./ToolSpecifications";
import { FrontstageUi2 } from "../appui/frontstages/FrontstageUi2";

export class AppUi2StageItemsProvider implements UiItemsProvider {
  public static providerId = "sampleApp:ui2-stage-widget-provider";
  public readonly id = AppUi2StageItemsProvider.providerId;

  constructor(private toolWidgetDisplayCornerButton: boolean) { }

  public static register(toolWidgetDisplayCornerButton: boolean) {
    UiItemsManager.register(new AppUi2StageItemsProvider(toolWidgetDisplayCornerButton));
  }

  public static unregister() {
    UiItemsManager.unregister(AppUi2StageItemsProvider.providerId);
  }

  private getLeftPanelWidgets(section?: StagePanelSection | undefined) {
    const widgets: AbstractWidgetProps[] = [];

    if (section === StagePanelSection.Start) {
      widgets.push(
        {
          id: "LeftStart1",
          label: "Start1",
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
          defaultState: WidgetState.Open,
          getWidgetContent: () => <h2>Left Start2 widget</h2>,
          isFloatingStateSupported: true,
        }
      );
    } else if (section === StagePanelSection.Middle) {
      widgets.push(
        {
          id: "LeftMiddle1",
          label: "Middle1",
          canPopout: false,
          getWidgetContent: () => <h2>Left Middle1 widget</h2>,
          isFloatingStateSupported: true,
        });
      widgets.push(
        {
          id: "LeftMiddle2",
          label: "Middle2",
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
          canPopout: true,
          getWidgetContent: () => <h2>Left  End1 widget</h2>,
          isFloatingStateSupported: true,
        });
      widgets.push(
        {
          id: "LeftEnd2",
          label: "End2",
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
          canPopout: true,
          defaultState: WidgetState.Open,
          getWidgetContent: () => <h2>Right Start1 widget</h2>,
          isFloatingStateSupported: true,
        });
      widgets.push(
        {
          id: "RightStart2",
          label: "Start2",
          canPopout: true,
          defaultState: WidgetState.Hidden,
          getWidgetContent: () => <h2>Right Start2 widget</h2>,
          isFloatingStateSupported: true,
        }
      );
    } else if (section === StagePanelSection.Middle) {
      widgets.push(
        {
          id: "RightMiddle1",
          label: "Middle1",
          canPopout: false,
          getWidgetContent: () => <h2>Right Middle1 widget</h2>,
          isFloatingStateSupported: true,
        });
      widgets.push(
        {
          id: "RightMiddle2",
          label: "Middle2",
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
          canPopout: true,
          getWidgetContent: () => <h2>Right  End1 widget</h2>,
          isFloatingStateSupported: true,
        });
      widgets.push(
        {
          id: "RightEnd2",
          label: "End2",
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
    const allowedStages = [FrontstageUi2.stageId];
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
    const allowedStages = [FrontstageUi2.stageId];
    if (allowedStages.includes(stageId)) {
      if (toolbarUsage === ToolbarUsage.ContentManipulation && toolbarOrientation === ToolbarOrientation.Horizontal) {
        const items: CommonToolbarItem[] = [];
        items.push(ToolbarHelper.createToolbarItemFromItemDef(10, AppTools.toggleHideShowItemsCommand, { groupPriority: 3000 }));
        items.push(ToolbarHelper.createToolbarItemFromItemDef(15, AppTools.splitSingleViewportCommandDef, { groupPriority: 3000 }));
        if (!this.toolWidgetDisplayCornerButton)
          items.push(ToolbarHelper.createToolbarItemFromItemDef(20, BackstageManager.getBackstageToggleCommand("icon-bentley-systems"), { groupPriority: 3000 }));
        return items;
      } else if (toolbarUsage === ToolbarUsage.ViewNavigation && toolbarOrientation === ToolbarOrientation.Vertical) {
        const items: CommonToolbarItem[] = [];
        items.push(ToolbarHelper.createToolbarItemFromItemDef(10, AppTools.saveContentLayout, { groupPriority: 3000 }));
        items.push(ToolbarHelper.createToolbarItemFromItemDef(15, AppTools.restoreSavedContentLayout, { groupPriority: 3000 }));
        return items;
      }
    }
    return [];
  }

}
