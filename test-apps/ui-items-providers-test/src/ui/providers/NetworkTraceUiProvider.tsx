/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as React from "react";
import {
  AbstractWidgetProps,
  AbstractZoneLocation,
  BackstageItem,
  BackstageItemUtilities,
  BadgeType,
  CommonToolbarItem,
  ConditionalBooleanValue,
  IconSpecUtilities,
  StagePanelLocation,
  StagePanelSection,
  StageUsage,
  ToolbarItemUtilities,
  ToolbarOrientation,
  ToolbarUsage,
  UiItemsManager,
  UiItemsProvider,
  WidgetState,
} from "@itwin/appui-abstract";
import { StateManager, SyncUiEventDispatcher } from "@itwin/appui-react";
import { IModelApp, NotifyMessageDetails, OutputMessagePriority, OutputMessageType } from "@itwin/core-frontend";

import { PresentationPropertyGridWidget, PresentationPropertyGridWidgetControl } from "../widgets/PresentationPropertyGridWidget";

import upstreamIcon from "../icons/upstream-query.svg?sprite";
import downstreamIcon from "../icons/downstream-query.svg?sprite";
import traceIcon from "../icons/query-multi.svg?sprite";
import { OpenTraceDialogTool } from "../../tools/OpenTraceDialogTool";
import { NetworkTracingFrontstage } from "../frontstages/NetworkTracing";
import { getTestProviderState, setIsTraceAvailable } from "../../store";
import { UiItemsProvidersTest } from "../../ui-items-providers-test";
import { CommsFibersListWidgetComponent } from "../widgets/CommsFibersListWidgetComponent";

export class NetworkTraceUiProvider implements UiItemsProvider {
  public static providerId = "ui-item-provider-test:NetworkTraceUiProvider";
  public readonly id = NetworkTraceUiProvider.providerId;
  public static syncEventIdTraceAvailable = "ui-test:trace-available-changed";

  public static register() {
    UiItemsManager.register(new NetworkTraceUiProvider());
  }

  public static unregister() {
    UiItemsManager.unregister(NetworkTraceUiProvider.providerId);
  }

  public static get isTraceAvailable(): boolean {
    return getTestProviderState().isTraceAvailable;
  }

  public static toggleTraceTool() {
    StateManager.store.dispatch(setIsTraceAvailable(!getTestProviderState().isTraceAvailable));

    // tell the toolbar to reevaluate state of any item with this event Id
    SyncUiEventDispatcher.dispatchImmediateSyncUiEvent(
      NetworkTraceUiProvider.syncEventIdTraceAvailable
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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const isDisabledCondition =
        new ConditionalBooleanValue(
          (): boolean => {
            return !NetworkTraceUiProvider.isTraceAvailable;
          },
          [NetworkTraceUiProvider.syncEventIdTraceAvailable],
          !NetworkTraceUiProvider.isTraceAvailable
        );

      const getConnectedButton = OpenTraceDialogTool.getActionButtonDef(10);

      const getDownstreamButton = ToolbarItemUtilities.createActionButton(
        "trace-tool-downstream",
        15, /* order within group button */
        IconSpecUtilities.createSvgIconSpec(downstreamIcon),
        UiItemsProvidersTest.translate("trace-tool-downstream"),
        (): void => {
          // test only - testing enable/disable;
        },
        {
          isDisabled: isDisabledCondition,
          badgeType: BadgeType.TechnicalPreview,
        }
      );

      const getUpstreamButton = ToolbarItemUtilities.createActionButton(
        "trace-tool-upstream",
        20, /* order within group button */
        IconSpecUtilities.createSvgIconSpec(upstreamIcon),
        UiItemsProvidersTest.translate("trace-tool-upstream"),
        (): void => {
          // test only - testing enable/disable;
        },
        {
          isDisabled: isDisabledCondition,
          badgeType: BadgeType.TechnicalPreview,
        }
      );

      const groupSpec = ToolbarItemUtilities.createGroupButton(
        "trace-tool-group", 230,
        IconSpecUtilities.createSvgIconSpec(traceIcon), UiItemsProvidersTest.translate("trace-tool-group"),
        [getConnectedButton, getDownstreamButton, getUpstreamButton],
        {
          badgeType: BadgeType.TechnicalPreview,
        }
      );

      const toggleTracingSpec = ToolbarItemUtilities.createActionButton(
        "trace-tool-toggle", 235, "icon-activity", "Toggle isTraceAvailable",
        (): void => {
          NetworkTraceUiProvider.toggleTraceTool();
        },
      );

      const getStandaloneButton = ToolbarItemUtilities.createActionButton(
        "trace-tool-standalone", 232, "icon-symbol",  UiItemsProvidersTest.translate("tools.trace-tool-standalone"),
        (): void => {
          IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, "trace-tool-standalone activated", undefined, OutputMessageType.Toast));
        },
        {
          isDisabled: isDisabledCondition,
          badgeType: BadgeType.TechnicalPreview,
        }
      );

      return [groupSpec, getStandaloneButton, toggleTracingSpec];
    }

    return [];
  }

  // eslint-disable-next-line deprecation/deprecation
  public provideWidgets(stageId: string, stageUsage: string, location: StagePanelLocation,
    // eslint-disable-next-line deprecation/deprecation
    section?: StagePanelSection, _zoneLocation?: AbstractZoneLocation): ReadonlyArray<AbstractWidgetProps> {
    const widgets: AbstractWidgetProps[] = [];
    if (stageId === "DefaultFrontstage" && location === StagePanelLocation.Right && section === StagePanelSection.Start) {
      const widget: AbstractWidgetProps = {
        id: "ui-item-provider-test:fibersListWidget",
        label: "Fibers",
        defaultState: WidgetState.Hidden,
        isFloatingStateSupported: true,
        // eslint-disable-next-line react/display-name
        getWidgetContent: () => {
          return <CommsFibersListWidgetComponent />;
        },
      };
      widgets.push(widget);
    }

    if ((stageUsage === StageUsage.General || stageId === NetworkTracingFrontstage.stageId) &&
      (location === StagePanelLocation.Right && section === StagePanelSection.End)) {
      const widget: AbstractWidgetProps = {
        id: PresentationPropertyGridWidgetControl.id,
        label: PresentationPropertyGridWidgetControl.label,
        defaultState: WidgetState.Open,
        isFloatingStateSupported: true,
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
      BackstageItemUtilities.createStageLauncher(NetworkTracingFrontstage.stageId, 100, 20, label),
    ];
  }
}
