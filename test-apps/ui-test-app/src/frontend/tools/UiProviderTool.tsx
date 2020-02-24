/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Tools
 */

import * as React from "react";
import { Tool } from "@bentley/imodeljs-frontend";
import {
  BadgeType, StageUsage, CommonStatusBarItem, StatusBarSection,
  UiItemsProvider, UiItemsManager, AbstractStatusBarItemUtilities,
  ToolbarUsage, ToolbarOrientation, CommonToolbarItem, ToolbarItemUtilities,
  AbstractWidgetProps,
  StagePanelLocation, StagePanelSection, ConditionalBooleanValue, ConditionalStringValue,
} from "@bentley/ui-abstract";
import {
  withStatusFieldProps, StatusBarItemUtilities,
  createAction, ActionsUnion, ActionCreatorsObject, ReducerRegistryInstance, StateManager, UiFramework,
} from "@bentley/ui-framework";
import { SampleAppIModelApp, SampleAppUiActionId } from "../index";
import { ShadowField } from "../appui/statusfields/ShadowField";
import { FillCentered } from "@bentley/ui-core";

// Simulate redux state being added via a plugin
interface ISamplePluginState {
  pluginUiVisible?: boolean;
}

class SamplePluginStateManager {
  public static pluginStateManagerLoaded = false;

  private static _initialState: ISamplePluginState = {
    pluginUiVisible: false,
  };

  private static _reducerName = "samplePluginState";

  public static SET_PLUGIN_UI_VISIBLE = SamplePluginStateManager.createActionName("SET_PLUGIN_UI_VISIBLE");

  private static _pluginActions: ActionCreatorsObject = {
    setDialogVisible: (pluginUiVisible: boolean) =>
      createAction(SamplePluginStateManager.SET_PLUGIN_UI_VISIBLE, pluginUiVisible),
  };

  private static createActionName(name: string) {
    // convert to lower case so it can serve as a sync event when called via UiFramework.dispatchActionToStore
    return `${SamplePluginStateManager._reducerName}:${name}`.toLowerCase();
  }

  // reducer
  public static pluginReducer(
    state: ISamplePluginState = SamplePluginStateManager._initialState,
    action: any,
  ): ISamplePluginState {
    type PluginActionsUnion = ActionsUnion<typeof SamplePluginStateManager._pluginActions>;

    const pluginActionsParam = action as PluginActionsUnion;

    switch (pluginActionsParam.type) {
      case SamplePluginStateManager.SET_PLUGIN_UI_VISIBLE:
        return { ...state, pluginUiVisible: action.payload };
      default:
        return state;
    }
  }

  public static initialize() {
    ReducerRegistryInstance.registerReducer(
      SamplePluginStateManager._reducerName,
      SamplePluginStateManager.pluginReducer,
    );
    SamplePluginStateManager.pluginStateManagerLoaded = true;
  }

  public static get isPluginUiVisible(): boolean {
    if (StateManager.isInitialized()) {
      return StateManager.store.getState().samplePluginState.pluginUiVisible;
    } else {
      return false;
    }
  }

  public static set isPluginUiVisible(visible: boolean) {
    UiFramework.dispatchActionToStore(SamplePluginStateManager.SET_PLUGIN_UI_VISIBLE, visible, true);
  }
}

/** alpha test code */
class TestUiProvider implements UiItemsProvider {
  public readonly id = "TestUiProvider";

  public provideToolbarButtonItems(_stageId: string, stageUsage: StageUsage, toolbarUsage: ToolbarUsage, toolbarOrientation: ToolbarOrientation): CommonToolbarItem[] {

    if (stageUsage === StageUsage.General && toolbarUsage === ToolbarUsage.ContentManipulation && toolbarOrientation === ToolbarOrientation.Horizontal) {
      const simpleActionSpec = ToolbarItemUtilities.createActionButton("simple-test-action-tool", 200, "icon-developer", "simple-test-action-tool",
        (): void => {
          // tslint:disable-next-line: no-console
          console.log("Got Here!");
        });

      const isHiddenCondition = new ConditionalBooleanValue((): boolean => SampleAppIModelApp.getTestProperty() === "HIDE", [SampleAppUiActionId.setTestProperty]);
      const childActionSpec = ToolbarItemUtilities.createActionButton("child-test-action-tool", 210, "icon-developer", "child-test-action-tool",
        (): void => {
          // tslint:disable-next-line: no-console
          console.log("Got Here!");
        }, { isHidden: isHiddenCondition });

      const nestedActionSpec = ToolbarItemUtilities.createActionButton("nested-test-action-tool", 220, "icon-developer", "test action tool (nested)",
        (): void => {
          // tslint:disable-next-line: no-console
          console.log("Got Here!");
        });
      const groupSpec = ToolbarItemUtilities.createGroupButton("test-tool-group", 230, "icon-developer", "test group", [childActionSpec, simpleActionSpec], { badgeType: BadgeType.TechnicalPreview, parentToolGroupId: "tool-formatting-setting" });

      return [simpleActionSpec, nestedActionSpec, groupSpec];
    }
    return [];
  }

  //  public provideToolbarItems(toolBarId: string): ToolbarItemInsertSpec[] {
  //    // tslint:disable-next-line: no-console
  //    // console.log(`Requesting tools for toolbar ${toolBarId}`);
  //
  //    if ("[ViewsFrontstage]ToolWidget-horizontal" === toolBarId) {
  //      const simpleActionSpec: ActionItemInsertSpec = {
  //        itemType: ToolbarItemType.ActionButton,
  //        itemId: "simple-test-action-tool",
  //        execute: (): void => {
  //          // tslint:disable-next-line: no-console
  //          console.log("Got Here!");
  //        },
  //        icon: "icon-developer",
  //        label: "simple-test-action-tool",
  //      };
  //
  //      const childActionSpec: ActionItemInsertSpec = {
  //        itemType: ToolbarItemType.ActionButton,
  //        itemId: "child-test-action-tool",
  //        condition: {
  //          type: ConditionalDisplayType.Visibility,
  //          testFunc: (): boolean => SampleAppIModelApp.getTestProperty() !== "HIDE",
  //          syncEventIds: [SampleAppUiActionId.setTestProperty],
  //        },
  //        execute: (): void => {
  //          // tslint:disable-next-line: no-console
  //          console.log("Got Here!");
  //        },
  //        icon: "icon-developer",
  //        label: "child-test-action-tool",
  //      };
  //
  //      const nestedActionSpec: ActionItemInsertSpec = {
  //        itemType: ToolbarItemType.ActionButton,
  //        parentToolGroupId: "tool-formatting-setting",
  //        itemId: "nested-test-action-tool",
  //        execute: (): void => {
  //          // tslint:disable-next-line: no-console
  //          console.log("Got Here!");
  //        },
  //        icon: "icon-developer",
  //        label: "test action tool (nested)",
  //      };
  //
  //      const groupSpec: GroupItemInsertSpec = {
  //        itemType: ToolbarItemType.GroupButton,
  //        itemId: "test-tool-group",
  //        badgeType: BadgeType.TechnicalPreview,
  //        icon: "icon-developer",
  //        label: "test group",
  //        items: [childActionSpec, simpleActionSpec],
  //      };
  //
  //      return [simpleActionSpec, nestedActionSpec, groupSpec];
  //
  //    } else if ("[ViewsFrontstage]NavigationWidget-horizontal" === toolBarId) {
  //      const navHorizontalSpec: ActionItemInsertSpec = {
  //        itemType: ToolbarItemType.ActionButton,
  //        itemId: "nav1-test-action-tool",
  //        execute: (): void => {
  //          // tslint:disable-next-line: no-console
  //          console.log("Got Here!");
  //        },
  //        icon: "icon-developer",
  //        label: "test action tool (navH)",
  //      };
  //      return [navHorizontalSpec];
  //    } else if ("[ViewsFrontstage]NavigationWidget-vertical" === toolBarId) {
  //      const navVerticalSpec: ActionItemInsertSpec = {
  //        itemType: ToolbarItemType.ActionButton,
  //        itemId: "nav2-test-action-tool",
  //        execute: (): void => {
  //          // tslint:disable-next-line: no-console
  //          console.log("Got Here!");
  //        },
  //        icon: "icon-developer",
  //        label: "test action tool (navV)",
  //      };
  //      return [navVerticalSpec];
  //    }
  //
  //    return [];
  //  }

  public provideStatusBarItems(_stageId: string, stageUsage: string): CommonStatusBarItem[] {
    const statusBarItems: CommonStatusBarItem[] = [];
    // tslint:disable-next-line: variable-name
    const ShadowToggle = withStatusFieldProps(ShadowField);

    if (stageUsage === StageUsage.General) {
      statusBarItems.push(
        AbstractStatusBarItemUtilities.createActionItem("PluginTest:StatusBarItem1", StatusBarSection.Center, 100, "icon-developer", "test status bar from plugin",
          () => {
            // tslint:disable-next-line: no-console
            console.log("Got Here!");
          }));

      const isHidden = new ConditionalBooleanValue(() => !SamplePluginStateManager.isPluginUiVisible, [SamplePluginStateManager.SET_PLUGIN_UI_VISIBLE]);
      const statusBarItem = AbstractStatusBarItemUtilities.createLabelItem("PluginTest:StatusBarLabel1", StatusBarSection.Center, 100, "icon-hand-2", "Hello", undefined, { isHidden });
      statusBarItems.push(statusBarItem);

      const labelCondition = new ConditionalStringValue(() => SamplePluginStateManager.isPluginUiVisible ? "Click to Hide" : "Click to Show", [SamplePluginStateManager.SET_PLUGIN_UI_VISIBLE]);
      const iconCondition = new ConditionalStringValue(() => SamplePluginStateManager.isPluginUiVisible ? "icon-visibility-hide-2" : "icon-visibility", [SamplePluginStateManager.SET_PLUGIN_UI_VISIBLE]);

      statusBarItems.push(
        AbstractStatusBarItemUtilities.createActionItem("PluginTest:StatusBarItem2", StatusBarSection.Center, 110, iconCondition, labelCondition,
          () => {
            SamplePluginStateManager.isPluginUiVisible = !SamplePluginStateManager.isPluginUiVisible;
          }));

      // add entry that supplies react component
      statusBarItems.push(StatusBarItemUtilities.createStatusBarItem("ShadowToggle", StatusBarSection.Right, 5, <ShadowToggle />));
    }
    return statusBarItems;
  }

  public provideWidgets(stageId: string, _stageUsage: string, location: StagePanelLocation, _section?: StagePanelSection | undefined): ReadonlyArray<AbstractWidgetProps> {
    const widgets: AbstractWidgetProps[] = [];
    if (stageId === "ViewsFrontstage" && location === StagePanelLocation.Right) {
      widgets.push({
        id: "addonWidget",
        getWidgetContent: () => <FillCentered>Addon Widget in panel</FillCentered>,
      });
    }
    return widgets;
  }
}

/** An Immediate Tool that toggles the test ui provider defined above. */
export class UiProviderTool extends Tool {
  public static testPluginLoaded = "";

  public static toolId = "TestUiProvider";
  public run(_args: any[]): boolean {
    // load state before ui provide so state is available when rendering on load occurs.
    if (!SamplePluginStateManager.pluginStateManagerLoaded)
      SamplePluginStateManager.initialize();

    if (UiProviderTool.testPluginLoaded.length > 0) {
      UiItemsManager.unregister(UiProviderTool.testPluginLoaded);
      UiProviderTool.testPluginLoaded = "";
    } else {
      const testUiProvider = new TestUiProvider();
      UiItemsManager.register(testUiProvider);
      UiProviderTool.testPluginLoaded = testUiProvider.id;
    }

    return true;
  }
}

// // used to test loading Plugin that provides  Ui items at startup
// const testPluginLoadedAtStartup = false;
// if (testPluginLoadedAtStartup) {
//   const uiProvider = new TestUiProvider();
//   UiItemsManager.register(uiProvider);
//   UiProviderTool.testPluginLoaded = uiProvider.id;
// }
