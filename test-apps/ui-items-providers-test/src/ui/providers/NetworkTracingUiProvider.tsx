/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/* eslint-disable deprecation/deprecation */

import * as React from "react";
import {
  AbstractWidgetProps, AbstractZoneLocation, BackstageItem,
  BackstageItemUtilities, BadgeType,
  CommonStatusBarItem,
  CommonToolbarItem, ConditionalBooleanValue, IconSpecUtilities,
  StagePanelLocation, StagePanelSection,
  StatusBarSection,
  ToolbarItemUtilities, ToolbarOrientation, ToolbarUsage,
  UiItemsManager, UiItemsProvider, WidgetState,
} from "@itwin/appui-abstract";
import { CustomToolbarItem } from "@itwin/components-react";
import { Indicator, PropsHelper, StateManager, StatusBarItemUtilities, UiFramework } from "@itwin/appui-react";
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
import { SvgList } from "@itwin/itwinui-icons-react";
import { ISelectionProvider, Presentation, SelectionChangeEventArgs } from "@itwin/presentation-frontend";

// eslint-disable-next-line @typescript-eslint/naming-convention
function SvgApple(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' {...props}>
      <path d='m14.38732 12.46864a8.67507 8.67507 0 0 1 -.85133 1.54667 7.83909 7.83909 0 0 1 -1.096 1.33933 2.11842 2.11842 0 0 1 -1.40933.62733 3.50824 3.50824 0 0 1 -1.30133-.314 3.7014 3.7014 0 0 0 -1.40133-.31333 3.82728 3.82728 0 0 0 -1.44066.31333 3.84425 3.84425 0 0 1 -1.24467.33067 1.98968 1.98968 0 0 1 -1.44066-.644 8.203 8.203 0 0 1 -1.14667-1.38664 9.61729 9.61729 0 0 1 -1.21266-2.43466 8.99338 8.99338 0 0 1 -.50933-2.90134 5.34287 5.34287 0 0 1 .68865-2.772 4.05969 4.05969 0 0 1 1.44134-1.474 3.84792 3.84792 0 0 1 1.94933-.556 4.55944 4.55944 0 0 1 1.50733.35466 4.79788 4.79788 0 0 0 1.196.35534 7.06478 7.06478 0 0 0 1.326-.41866 4.34039 4.34039 0 0 1 1.802-.32334 3.8146 3.8146 0 0 1 2.99733 1.59533 3.37671 3.37671 0 0 0 -1.768 3.062 3.3911 3.3911 0 0 0 1.09733 2.54467 3.59839 3.59839 0 0 0 1.096.72733q-.132.386-.27933.74133zm-3.05466-12.14864a3.43565 3.43565 0 0 1 -.86533 2.23866 2.93869 2.93869 0 0 1 -2.45 1.22267 2.58687 2.58687 0 0 1 -.018-.30334 3.63848 3.63848 0 0 1 2.03667-3.11132 3.30968 3.30968 0 0 1 1.28-.36667 2.86658 2.86658 0 0 1 .01667.32z' />
    </svg>
  );
}

/**
 * Test UiItemsProvider that provide buttons, widgets, and backstage item to NetworkTracing stage.
 */
export class NetworkTracingUiProvider implements UiItemsProvider {
  public static providerId = "ui-item-provider-test:NetworkTracingUiProvider";
  public readonly id = NetworkTracingUiProvider.providerId;
  public static syncEventIdTraceAvailable = "ui-test:trace-available-changed";
  private _removeListenerFunc?: () => void;

  // Listen for selection changes and when nothing is selection hide the Widget by calling widgetDef.setWidgetState
  private _onPresentationSelectionChanged = async (evt: SelectionChangeEventArgs, selectionProvider: ISelectionProvider) => {
    const widgetDef = UiFramework.frontstages.activeFrontstageDef?.findWidgetDef("ui-item-provider-test:elementDataListWidget");
    if (widgetDef) {
      const selection = selectionProvider.getSelection(evt.imodel, evt.level);
      if (selection.isEmpty) {
        widgetDef?.setWidgetState(WidgetState.Hidden);
      } else {
        if (selection.instanceKeys.size !== 0) {
          widgetDef?.setWidgetState(WidgetState.Open);
        }
      }
    }
  };

  public static register() {
    const provider = new NetworkTracingUiProvider();
    UiItemsManager.register(provider);
    if (UiFramework.uiVersion === "1")
      provider._removeListenerFunc = Presentation.selection.selectionChange.addListener(provider._onPresentationSelectionChanged);
  }

  public static unregister() {
    UiItemsManager.unregister(NetworkTracingUiProvider.providerId);
  }

  // When the provider is unloaded also remove the handler
  public onUnregister = () => {
    this._removeListenerFunc && this._removeListenerFunc();
  };

  /** static method that updates the value in redux store and dispatches a sync event so items are refreshed. */
  public static toggleTraceTool() {
    StateManager.store.dispatch(setIsTraceAvailable(!getTestProviderState().isTraceAvailable));

    // tell the toolbar to reevaluate state of any item with this event Id
    UiFramework.events.dispatchImmediateSyncUiEvent(
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
    section?: StagePanelSection, zoneLocation?: AbstractZoneLocation, _stageAppData?: any): ReadonlyArray<AbstractWidgetProps> {
    const widgets: AbstractWidgetProps[] = [];
    if ((stageId === NetworkTracingFrontstage.stageId || stageId === "ui-test-app:no-widget-frontstage" || stageId === "ViewsFrontstage") &&
      (location === StagePanelLocation.Right && section === StagePanelSection.Start && UiFramework.uiVersion !== "1") ||
      zoneLocation === AbstractZoneLocation.BottomRight) {
      /** This widget when only be displayed when there is an element selected. */
      const widget: AbstractWidgetProps = {
        ...{
          id: "ui-item-provider-test:elementDataListWidget",
          label: "Data",
          defaultState: WidgetState.Hidden,
          isFloatingStateSupported: true,
          hideWithUiWhenFloating: true,
          // eslint-disable-next-line react/display-name
          getWidgetContent: () => {
            return <SelectedElementDataWidgetComponent />;
          },
        }, ...PropsHelper.getAbstractPropsForReactIcon(<SvgApple />),
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
        defaultFloatingSize: { width: 400, height: 600 },
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
    const iconProps = PropsHelper.getAbstractPropsForReactIcon(<SvgApple />);
    return [
      // use 200 to group it with secondary stages in ui-test-app
      BackstageItemUtilities.createStageLauncher(NetworkTracingFrontstage.stageId, 200, 1, label, "from provider", iconProps.icon, { internalData: iconProps.internalData }),
    ];
  }

  public provideStatusBarItems(stageId: string, _stageUsage: string): CommonStatusBarItem[] {
    const statusBarItems: CommonStatusBarItem[] = [];
    if (stageId === NetworkTracingFrontstage.stageId) {
      statusBarItems.push(
        StatusBarItemUtilities.createStatusBarItem("Test:Visibility", StatusBarSection.Center, 50, <Indicator iconSpec={<SvgList />} isLabelVisible={false} label="Searchable Tree" opened={false} dialog={<VisibilityTreeComponent />} />),
      );
    }
    return statusBarItems;
  }
}
