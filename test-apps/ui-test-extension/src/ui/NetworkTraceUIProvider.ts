/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import {
  BadgeType,
  CommonToolbarItem,
  ConditionalBooleanValue,
  IconSpecUtilities,
  StageUsage,
  ToolbarItemUtilities,
  ToolbarOrientation,
  ToolbarUsage,
  UiItemsProvider,
} from "@itwin/appui-abstract";
import { SyncUiEventDispatcher } from "@itwin/appui-react";
import { IModelApp, NotifyMessageDetails, OutputMessagePriority, OutputMessageType } from "@itwin/core-frontend";

import upstreamIcon from "./icons/upstream-query.svg?sprite";
import downstreamIcon from "./icons/downstream-query.svg?sprite";
import traceIcon from "./icons/query-multi.svg?sprite";
import { OpenTraceDialogTool } from "./tools/OpenTraceDialogTool";

export class TraceUiItemsProvider implements UiItemsProvider {
  public static syncEventIdTraceAvailable = "ui-test:trace-available-changed";
  public readonly id = "TraceUiItemsProvider";
  public static readonly defaultNs = "uiTestExtension";
  private static _traceAvailableProperty = false;

  public constructor() {
  }

  public static translate(key: string) {
    return IModelApp.localization.getLocalizedString(
      `${TraceUiItemsProvider.defaultNs}:${key}`
    );
  }

  public static get isTraceAvailable(): boolean {
    return TraceUiItemsProvider._traceAvailableProperty;
  }

  public static setTraceToolbarOn(value: boolean) {
    if (value !== TraceUiItemsProvider.isTraceAvailable) {
      TraceUiItemsProvider._traceAvailableProperty = value;

      // tell the toolbar to check
      SyncUiEventDispatcher.dispatchImmediateSyncUiEvent(
        TraceUiItemsProvider.syncEventIdTraceAvailable
      );
    }
  }

  public provideToolbarButtonItems(
    _stageId: string,
    stageUsage: string,
    toolbarUsage: ToolbarUsage,
    toolbarOrientation: ToolbarOrientation
  ): CommonToolbarItem[] {
    if (
      stageUsage === StageUsage.General &&
      toolbarUsage === ToolbarUsage.ContentManipulation &&
      toolbarOrientation === ToolbarOrientation.Horizontal
    ) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const isDisabledCondition =
        new ConditionalBooleanValue(
          (): boolean => {
            return !TraceUiItemsProvider.isTraceAvailable;
          },
          [TraceUiItemsProvider.syncEventIdTraceAvailable],
          !TraceUiItemsProvider.isTraceAvailable
        );

      const getConnectedButton = OpenTraceDialogTool.getActionButtonDef(10);

      const getDownstreamButton = ToolbarItemUtilities.createActionButton(
        "trace-tool-downstream",
        15, /* order within group button */
        IconSpecUtilities.createSvgIconSpec(downstreamIcon),
        TraceUiItemsProvider.translate("trace-tool-downstream"),
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
        TraceUiItemsProvider.translate("trace-tool-upstream"),
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
        TraceUiItemsProvider.translate("trace-tool-group"),
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
          TraceUiItemsProvider.setTraceToolbarOn(!TraceUiItemsProvider.isTraceAvailable);
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

      return [groupSpec, getStandaloneButton, toggleTracingSpec];
    }
    return [];
  }
}
