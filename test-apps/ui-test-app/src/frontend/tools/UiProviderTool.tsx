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
  AbstractStatusBarItemUtilities, AbstractWidgetProps, BadgeType, CommonStatusBarItem, CommonToolbarItem, ConditionalBooleanValue,
  ConditionalStringValue, StagePanelLocation, StagePanelSection, StageUsage, StatusBarSection, ToolbarItemUtilities, ToolbarOrientation, ToolbarUsage,
  UiItemsManager, UiItemsProvider,
} from "@bentley/ui-abstract";
import { FillCentered } from "@bentley/ui-core";
import {
  ActionCreatorsObject, ActionsUnion, createAction, ReducerRegistryInstance, StateManager, StatusBarItemUtilities, UiFramework, withStatusFieldProps,
} from "@bentley/ui-framework";
import { ShadowField } from "../appui/statusfields/ShadowField";
import { SampleAppIModelApp, SampleAppUiActionId } from "../index";

// Simulate redux state being added via a extension
interface SampleExtensionState {
  extensionUiVisible?: boolean;
}

class SampleExtensionStateManager {
  public static extensionStateManagerLoaded = false;

  private static _initialState: SampleExtensionState = {
    extensionUiVisible: false,
  };

  private static _reducerName = "sampleExtensionState";

  public static SET_EXTENSION_UI_VISIBLE = SampleExtensionStateManager.createActionName("SET_EXTENSION_UI_VISIBLE");

  private static _extensionActions: ActionCreatorsObject = {
    setDialogVisible: (extensionUiVisible: boolean) =>
      createAction(SampleExtensionStateManager.SET_EXTENSION_UI_VISIBLE, extensionUiVisible),
  };

  private static createActionName(name: string) {
    // convert to lower case so it can serve as a sync event when called via UiFramework.dispatchActionToStore
    return `${SampleExtensionStateManager._reducerName}:${name}`.toLowerCase();
  }

  // reducer
  public static extensionReducer(
    state: SampleExtensionState = SampleExtensionStateManager._initialState,
    action: any,
  ): SampleExtensionState {
    type ExtensionActionsUnion = ActionsUnion<typeof SampleExtensionStateManager._extensionActions>;

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    const extensionActionsParam = action as ExtensionActionsUnion;

    switch (extensionActionsParam.type) {
      case SampleExtensionStateManager.SET_EXTENSION_UI_VISIBLE:
        return { ...state, extensionUiVisible: action.payload };
      default:
        return state;
    }
  }

  public static initialize() {
    ReducerRegistryInstance.registerReducer(
      SampleExtensionStateManager._reducerName,
      SampleExtensionStateManager.extensionReducer,
    );
    SampleExtensionStateManager.extensionStateManagerLoaded = true;
  }

  public static get isExtensionUiVisible(): boolean {
    if (StateManager.isInitialized()) {
      return StateManager.store.getState().sampleExtensionState.extensionUiVisible;
    } else {
      return false;
    }
  }

  public static set isExtensionUiVisible(visible: boolean) {
    UiFramework.dispatchActionToStore(SampleExtensionStateManager.SET_EXTENSION_UI_VISIBLE, visible, true);
  }
}

/** test code */
class TestUiProvider implements UiItemsProvider {
  public readonly id = "TestUiProvider";

  public provideToolbarButtonItems(_stageId: string, stageUsage: string, toolbarUsage: ToolbarUsage, toolbarOrientation: ToolbarOrientation): CommonToolbarItem[] {

    if (stageUsage === StageUsage.General && toolbarUsage === ToolbarUsage.ContentManipulation && toolbarOrientation === ToolbarOrientation.Horizontal) {
      const simpleActionSpec = ToolbarItemUtilities.createActionButton("simple-test-action-tool", 200, "icon-developer", "simple-test-action-tool",
        (): void => {
          // eslint-disable-next-line no-console
          console.log("Got Here!");
        });

      const isHiddenCondition = new ConditionalBooleanValue((): boolean => SampleAppIModelApp.getTestProperty() === "HIDE", [SampleAppUiActionId.setTestProperty]);
      const childActionSpec = ToolbarItemUtilities.createActionButton("child-test-action-tool", 210, "icon-developer", "child-test-action-tool",
        (): void => {
          // eslint-disable-next-line no-console
          console.log("Got Here!");
        }, { isHidden: isHiddenCondition });

      const nestedActionSpec = ToolbarItemUtilities.createActionButton("nested-test-action-tool", 220, "icon-developer", "test action tool (nested)",
        (): void => {
          // eslint-disable-next-line no-console
          console.log("Got Here!");
        });
      const groupSpec = ToolbarItemUtilities.createGroupButton("test-tool-group", 230, "icon-developer", "test group", [childActionSpec, simpleActionSpec], { badgeType: BadgeType.TechnicalPreview, parentToolGroupId: "tool-formatting-setting" });

      return [simpleActionSpec, nestedActionSpec, groupSpec];
    }
    return [];
  }

  public provideStatusBarItems(_stageId: string, stageUsage: string): CommonStatusBarItem[] {
    const statusBarItems: CommonStatusBarItem[] = [];
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const ShadowToggle = withStatusFieldProps(ShadowField);

    if (stageUsage === StageUsage.General) {
      statusBarItems.push(
        AbstractStatusBarItemUtilities.createActionItem("ExtensionTest:StatusBarItem1", StatusBarSection.Center, 100, "icon-developer", "test status bar from extension",
          () => {
            // eslint-disable-next-line no-console
            console.log("Got Here!");
          }));

      const isHidden = new ConditionalBooleanValue(() => !SampleExtensionStateManager.isExtensionUiVisible, [SampleExtensionStateManager.SET_EXTENSION_UI_VISIBLE]);
      const statusBarItem = AbstractStatusBarItemUtilities.createLabelItem("ExtensionTest:StatusBarLabel1", StatusBarSection.Center, 100, "icon-hand-2", "Hello", undefined, { isHidden });
      statusBarItems.push(statusBarItem);

      const labelCondition = new ConditionalStringValue(() => SampleExtensionStateManager.isExtensionUiVisible ? "Click to Hide" : "Click to Show", [SampleExtensionStateManager.SET_EXTENSION_UI_VISIBLE]);
      const iconCondition = new ConditionalStringValue(() => SampleExtensionStateManager.isExtensionUiVisible ? "icon-visibility-hide-2" : "icon-visibility", [SampleExtensionStateManager.SET_EXTENSION_UI_VISIBLE]);

      statusBarItems.push(
        AbstractStatusBarItemUtilities.createActionItem("ExtensionTest:StatusBarItem2", StatusBarSection.Center, 110, iconCondition, labelCondition,
          () => {
            SampleExtensionStateManager.isExtensionUiVisible = !SampleExtensionStateManager.isExtensionUiVisible;
          }));

      // add entry that supplies react component
      statusBarItems.push(StatusBarItemUtilities.createStatusBarItem("ShadowToggle", StatusBarSection.Right, 5, <ShadowToggle />));
    }
    return statusBarItems;
  }

  public provideWidgets(stageId: string, _stageUsage: string, location: StagePanelLocation, section?: StagePanelSection | undefined): ReadonlyArray<AbstractWidgetProps> {
    const widgets: AbstractWidgetProps[] = [];
    const allowedStages = ["ViewsFrontstage", "Ui2"];
    // Section parameter is ignored. The widget will be added once to the top section of a right panel.
    if (allowedStages.includes(stageId) && location === StagePanelLocation.Right) {
      widgets.push({
        id: "addonWidget",
        getWidgetContent: () => <FillCentered>Addon Widget in panel</FillCentered>, // eslint-disable-line react/display-name
      });
    }
    if (allowedStages.includes(stageId) && location === StagePanelLocation.Right && section === StagePanelSection.Middle) {
      widgets.push({
        id: "addonWidgetMiddle",
        getWidgetContent: () => <FillCentered>Addon Widget in middle section</FillCentered>, // eslint-disable-line react/display-name
      });
    }
    return widgets;
  }
}

/** An Immediate Tool that toggles the test ui provider defined above. */
export class UiProviderTool extends Tool {
  public static testExtensionLoaded = "";

  public static toolId = "TestUiProvider";
  public run(_args: any[]): boolean {
    // load state before ui provide so state is available when rendering on load occurs.
    if (!SampleExtensionStateManager.extensionStateManagerLoaded)
      SampleExtensionStateManager.initialize();

    if (UiProviderTool.testExtensionLoaded.length > 0) {
      UiItemsManager.unregister(UiProviderTool.testExtensionLoaded);
      UiProviderTool.testExtensionLoaded = "";
    } else {
      const testUiProvider = new TestUiProvider();
      UiItemsManager.register(testUiProvider);
      UiProviderTool.testExtensionLoaded = testUiProvider.id;
    }

    return true;
  }
}
