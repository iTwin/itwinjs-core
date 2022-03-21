/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import {
  AbstractWidgetProps, BackstageItem,
  BackstageItemUtilities, BadgeType,
  CommonStatusBarItem,
  CommonToolbarItem, ConditionalBooleanValue, IconSpecUtilities,
  StagePanelLocation, StagePanelSection,
  StatusBarSection,
  ToolbarItemUtilities, ToolbarOrientation, ToolbarUsage,
  UiItemsManager, UiItemsProvider, WidgetState,
} from "@itwin/appui-abstract";
import { CustomToolbarItem } from "@itwin/components-react";
import { Indicator, StateManager, StatusBarItemUtilities, SyncUiEventDispatcher } from "@itwin/appui-react";
import { IModelApp, NotifyMessageDetails, OutputMessagePriority, OutputMessageType } from "@itwin/core-frontend";
import { PresentationPropertyGridWidget, PresentationPropertyGridWidgetControl } from "../widgets/PresentationPropertyGridWidget";
import { OpenTraceDialogTool } from "../../tools/OpenTraceDialogTool";
import { NetworkTracingFrontstage } from "../frontstages/NetworkTracing";
import { getTestProviderState, setIsTraceAvailable } from "../../store";
import { UiItemsProvidersTest } from "../../ui-items-providers-test";
import { SelectedElementDataWidgetComponent } from "../widgets/SelectedElementDataWidget";
import { VisibilityTreeComponent } from "../widgets/VisibilityWidget";
import downstreamQuerySvg from "../icons/downstream-query.svg";
import queryMultiSvg from "../icons/query-multi.svg";
import upstreamQuerySvg from "../icons/upstream-query.svg";

/**
 * Test UiItemsProvider that provide buttons, widgets, and backstage item to NetworkTracing stage.
 */
export class NetworkTracingUiProvider implements UiItemsProvider {
  public static providerId = "ui-item-provider-test:NetworkTracingUiProvider";
  public readonly id = NetworkTracingUiProvider.providerId;
  public static syncEventIdTraceAvailable = "ui-test:trace-available-changed";

  public static register() {
    UiItemsManager.register(new NetworkTracingUiProvider());
  }

  public static unregister() {
    UiItemsManager.unregister(NetworkTracingUiProvider.providerId);
  }

  /** static method that updates the value in redux store and dispatches a sync event so items are refreshed. */
  public static toggleTraceTool() {
    StateManager.store.dispatch(setIsTraceAvailable(!getTestProviderState().isTraceAvailable));

    // tell the toolbar to reevaluate state of any item with this event Id
    SyncUiEventDispatcher.dispatchImmediateSyncUiEvent(
      NetworkTracingUiProvider.syncEventIdTraceAvailable
    );
  }

  public provideToolbarButtonItems(
    stageId: string,
    _stageUsage: string, // don't need to check usage since this provider is for specific stage.
    toolbarUsage: ToolbarUsage,
    toolbarOrientation: ToolbarOrientation
  ): CommonToolbarItem[] {
    if (
      stageId === NetworkTracingFrontstage.stageId &&
      toolbarUsage === ToolbarUsage.ContentManipulation &&
      toolbarOrientation === ToolbarOrientation.Horizontal
    ) {
      /** The following ConditionalBooleanValue is used to determine the display state of some of the buttons
       * provided by this UiItemsProvider.
       */
      const isTracingNotAvailableCondition =
        new ConditionalBooleanValue(
          (): boolean => {
            return !getTestProviderState().isTraceAvailable;
          },
          [NetworkTracingUiProvider.syncEventIdTraceAvailable],
          !getTestProviderState().isTraceAvailable
        );

      /** This is an example of where the tool generates the action button definition allowing user to pass item and group
       * priority to control ordering of buttons in toolbox. */
      const getConnectedButton = OpenTraceDialogTool.getActionButtonDef(10);

      /** Sample group entry that hides if isTraceAvailable is set to false  */
      const getDownstreamButton = ToolbarItemUtilities.createActionButton(
        "trace-tool-downstream",
        15, /* order within group button */
        IconSpecUtilities.createWebComponentIconSpec(downstreamQuerySvg),
        UiItemsProvidersTest.translate("trace-tool-downstream"),
        (): void => {
          IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, "trace-tool-downstream activated", undefined, OutputMessageType.Toast));
        },
        {
          isHidden: isTracingNotAvailableCondition,
          badgeType: BadgeType.TechnicalPreview,
        }
      );

      /** Sample group entry that disables if isTraceAvailable is set to false  */
      const getUpstreamButton = ToolbarItemUtilities.createActionButton(
        "trace-tool-upstream",
        20, /* order within group button */
        IconSpecUtilities.createWebComponentIconSpec(upstreamQuerySvg),
        UiItemsProvidersTest.translate("trace-tool-upstream"),
        (): void => {
          IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, "trace-tool-upstream activated", undefined, OutputMessageType.Toast));
        },
        {
          isDisabled: isTracingNotAvailableCondition,
          badgeType: BadgeType.TechnicalPreview,
        }
      );

      /** The following defines a group button that contains tree actions buttons. Only the first entry produces a
       * result as it opens a sample dialog. The other two entries are used to show that the display state of
       * group button entries can be maintained by conditional values.
       */
      const groupSpec = ToolbarItemUtilities.createGroupButton(
        "trace-tool-group", 230,
        IconSpecUtilities.createWebComponentIconSpec(queryMultiSvg),
        UiItemsProvidersTest.translate("trace-tool-group"),
        [getConnectedButton, getDownstreamButton, getUpstreamButton],
        {
          badgeType: BadgeType.TechnicalPreview,
        }
      );

      /** The following test tool toggles the value Redux store and dispatches sync event that triggers tool refresh */
      const toggleTracingSpec = ToolbarItemUtilities.createActionButton(
        "trace-tool-toggle", 235, "icon-activity", "Toggle isTraceAvailable",
        (): void => {
          NetworkTracingUiProvider.toggleTraceTool();
        },
      );

      /** The following test tool hides/shows based on value in Redux store via `isTraceAvailableCondition` */
      const getStandaloneButton = ToolbarItemUtilities.createActionButton(
        "trace-tool-standalone", 232, "icon-symbol", UiItemsProvidersTest.translate("tools.trace-tool-standalone"),
        (): void => {
          IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, "trace-tool-standalone activated", undefined, OutputMessageType.Toast));
        },
        {
          isHidden: isTracingNotAvailableCondition,
          badgeType: BadgeType.TechnicalPreview,
        }
      );

      const customVisibilityTreeButton: CustomToolbarItem = {
        isCustom: true,
        id: "test.custom-popup-with-visibility-tree",
        itemPriority: 225,
        icon: "icon-tree",
        label: "Searchable Tree",
        panelContentNode: <VisibilityTreeComponent />,
        keepContentsLoaded: true,
        groupPriority: 20,
      };

      return [groupSpec, getStandaloneButton, toggleTracingSpec, customVisibilityTreeButton];
    }
    return [];
  }

  public provideWidgets(stageId: string, _stageUsage: string, location: StagePanelLocation,
    section?: StagePanelSection): ReadonlyArray<AbstractWidgetProps> {
    const widgets: AbstractWidgetProps[] = [];
    if ((stageId === NetworkTracingFrontstage.stageId || stageId === "ui-test-app:no-widget-frontstage") &&
      location === StagePanelLocation.Right && section === StagePanelSection.Start) {
      /** This widget when only be displayed when there is an element selected. */
      const widget: AbstractWidgetProps = {
        id: "ui-item-provider-test:elementDataListWidget",
        icon: "icon-annotation-info",
        label: "Data",
        defaultState: WidgetState.Hidden,
        isFloatingStateSupported: true,
        // eslint-disable-next-line react/display-name
        getWidgetContent: () => {
          return <SelectedElementDataWidgetComponent />;
        },
      };
      widgets.push(widget);
    }

    if (stageId === NetworkTracingFrontstage.stageId &&
      (location === StagePanelLocation.Right && section === StagePanelSection.End)) {
      const widget: AbstractWidgetProps = {
        id: PresentationPropertyGridWidgetControl.id,
        label: PresentationPropertyGridWidgetControl.label,
        icon: PresentationPropertyGridWidgetControl.iconSpec,
        defaultState: WidgetState.Open,
        isFloatingStateSupported: true,
        defaultFloatingSize: {width: 400, height: 600 },
        isFloatingStateWindowResizable: true,
        // eslint-disable-next-line react/display-name
        getWidgetContent: () => {
          return <PresentationPropertyGridWidget />;
        },
        canPopout: true,
      };

      widgets.push(widget);
    }
    return widgets;
  }

  public provideBackstageItems(): BackstageItem[] {
    const label = UiItemsProvidersTest.translate("backstage.networkTracingFrontstageLabel");
    return [
      // use 200 to group it with secondary stages in ui-test-app
      BackstageItemUtilities.createStageLauncher(NetworkTracingFrontstage.stageId, 200, 1, label, "from provider", "icon-draw"),
    ];
  }

  public provideStatusBarItems(stageId: string, _stageUsage: string): CommonStatusBarItem[] {
    const statusBarItems: CommonStatusBarItem[] = [];
    if (stageId === NetworkTracingFrontstage.stageId) {
      statusBarItems.push(
        StatusBarItemUtilities.createStatusBarItem("Test:Visibility", StatusBarSection.Center, 50, <Indicator iconSpec="icon-tree" isLabelVisible={false} label="Searchable Tree" opened={false} dialog={<VisibilityTreeComponent />} />),
      );
    }
    return statusBarItems;
  }
}
