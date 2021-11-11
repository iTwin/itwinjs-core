/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import {
  BackstageItem,
  BackstageItemUtilities,
  BadgeType,
  CommonToolbarItem,
  ConditionalBooleanValue,
  IconSpecUtilities,
  ToolbarItemUtilities,
  ToolbarOrientation,
  ToolbarUsage,
  UiItemsManager,
  UiItemsProvider,
} from "@itwin/appui-abstract";
import { StateManager, SyncUiEventDispatcher } from "@itwin/appui-react";
import { IModelApp, NotifyMessageDetails, OutputMessagePriority, OutputMessageType } from "@itwin/core-frontend";

import upstreamIcon from "../icons/upstream-query.svg?sprite";
import downstreamIcon from "../icons/downstream-query.svg?sprite";
import traceIcon from "../icons/query-multi.svg?sprite";
import { OpenTraceDialogTool } from "../../tools/OpenTraceDialogTool";
import { NetworkTracingFrontstage } from "../frontstages/NetworkTracing";
import { getTestProviderState, setIsTraceAvailable } from "../../store";
import { OpenAbstractDialogTool } from "../../tools/OpenAbstractModalDialogTool";
import { UiTestExtension } from "../../ui-test-extension";

export class NetworkTraceUiProvider implements UiItemsProvider {
  public static providerId = "comms:NetworkTraceUiProvider";
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
      const abstractDialogButton = OpenAbstractDialogTool.getActionButtonDef(240);

      const getDownstreamButton = ToolbarItemUtilities.createActionButton(
        "trace-tool-downstream",
        15, /* order within group button */
        IconSpecUtilities.createSvgIconSpec(downstreamIcon),
        UiTestExtension.translate("trace-tool-downstream"),
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
        UiTestExtension.translate("trace-tool-upstream"),
        (): void => {
          // test only - testing enable/disable;
        },
        {
          isDisabled: isDisabledCondition,
          badgeType: BadgeType.TechnicalPreview,
        }
      );

      const groupSpec = ToolbarItemUtilities.createGroupButton(
        "trace-tool-group",
        230,
        IconSpecUtilities.createSvgIconSpec(traceIcon),
        UiTestExtension.translate("trace-tool-group"),
        [getConnectedButton, getDownstreamButton, getUpstreamButton],
        {
          badgeType: BadgeType.TechnicalPreview,
        }
      );

      const toggleTracingSpec = ToolbarItemUtilities.createActionButton(
        "trace-tool-toggle",
        235,
        "icon-activity",
        "Toggle isTraceAvailable",
        (): void => {
          NetworkTraceUiProvider.toggleTraceTool();
        },
      );

      const getStandaloneButton = ToolbarItemUtilities.createActionButton(
        "trace-tool-standalone",
        232,
        "icon-symbol",
        "trace-tool-standalone",
        (): void => {
          IModelApp.notifications.outputMessage(new NotifyMessageDetails(OutputMessagePriority.Info, "trace-tool-standalone activated", undefined, OutputMessageType.Toast));
        },
        {
          isDisabled: isDisabledCondition,
          badgeType: BadgeType.TechnicalPreview,
        }
      );

      return [groupSpec, getStandaloneButton, toggleTracingSpec, abstractDialogButton];
    }
    return [];
  }

  public provideBackstageItems(): BackstageItem[] {
    const label = UiTestExtension.translate("backstage.networkTracingFrontstageLabel");
    return [
      BackstageItemUtilities.createStageLauncher(NetworkTracingFrontstage.stageId, 100, 20, label),
    ];
  }
}
