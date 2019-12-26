/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tools */

import * as React from "react";
import { Tool } from "@bentley/imodeljs-frontend";
import {
  ActionItemInsertSpec, GroupItemInsertSpec,
  ToolbarItemInsertSpec, ToolbarItemType, BadgeType, ConditionalDisplayType,
  StageUsage, CommonStatusBarItem, StatusBarSection,
  PluginUiProvider, PluginUiManager, AbstractStatusBarItemUtilities,
} from "@bentley/ui-abstract";
import { UiFramework, withStatusFieldProps, StatusBarItemUtilities } from "@bentley/ui-framework";
import { SampleAppIModelApp, SampleAppUiActionId } from "../index";
import { ShadowField } from "../appui/statusfields/ShadowField";

/** alpha test code */
class TestUiProvider implements PluginUiProvider {
  public readonly id = "TestUiProvider";
  public provideToolbarItems(toolBarId: string): ToolbarItemInsertSpec[] {
    // tslint:disable-next-line: no-console
    // console.log(`Requesting tools for toolbar ${toolBarId}`);

    if ("[ViewsFrontstage]ToolWidget-horizontal" === toolBarId) {
      const simpleActionSpec: ActionItemInsertSpec = {
        itemType: ToolbarItemType.ActionButton,
        itemId: "simple-test-action-tool",
        execute: (): void => {
          // tslint:disable-next-line: no-console
          console.log("Got Here!");
        },
        icon: "icon-developer",
        label: "simple-test-action-tool",
      };

      const childActionSpec: ActionItemInsertSpec = {
        itemType: ToolbarItemType.ActionButton,
        itemId: "child-test-action-tool",
        condition: {
          type: ConditionalDisplayType.Visibility,
          testFunc: (): boolean => SampleAppIModelApp.getTestProperty() !== "HIDE",
          syncEventIds: [SampleAppUiActionId.setTestProperty],
        },
        execute: (): void => {
          // tslint:disable-next-line: no-console
          console.log("Got Here!");
        },
        icon: "icon-developer",
        label: "child-test-action-tool",
      };

      const nestedActionSpec: ActionItemInsertSpec = {
        itemType: ToolbarItemType.ActionButton,
        parentToolGroupId: "tool-formatting-setting",
        itemId: "nested-test-action-tool",
        execute: (): void => {
          // tslint:disable-next-line: no-console
          console.log("Got Here!");
        },
        icon: "icon-developer",
        label: "test action tool (nested)",
      };

      const groupSpec: GroupItemInsertSpec = {
        itemType: ToolbarItemType.GroupButton,
        itemId: "test-tool-group",
        badge: BadgeType.TechnicalPreview,
        icon: "icon-developer",
        label: "test group",
        items: [childActionSpec, simpleActionSpec],
      };

      return [simpleActionSpec, nestedActionSpec, groupSpec];

    } else if ("[ViewsFrontstage]NavigationWidget-horizontal" === toolBarId) {
      const navHorizontalSpec: ActionItemInsertSpec = {
        itemType: ToolbarItemType.ActionButton,
        itemId: "nav1-test-action-tool",
        execute: (): void => {
          // tslint:disable-next-line: no-console
          console.log("Got Here!");
        },
        icon: "icon-developer",
        label: "test action tool (navH)",
      };
      return [navHorizontalSpec];
    } else if ("[ViewsFrontstage]NavigationWidget-vertical" === toolBarId) {
      const navVerticalSpec: ActionItemInsertSpec = {
        itemType: ToolbarItemType.ActionButton,
        itemId: "nav2-test-action-tool",
        execute: (): void => {
          // tslint:disable-next-line: no-console
          console.log("Got Here!");
        },
        icon: "icon-developer",
        label: "test action tool (navV)",
      };
      return [navVerticalSpec];
    }

    return [];
  }

  public static statusBarItemIsVisible = true;

  public provideStatusbarItems(_stageId: string, stageUsage: StageUsage): CommonStatusBarItem[] {
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

      statusBarItems.push(
        AbstractStatusBarItemUtilities.createLabelItem("PluginTest:StatusBarLabel1", StatusBarSection.Center, 100, "icon-hand-2", "Hello"));

      statusBarItems.push(
        AbstractStatusBarItemUtilities.createActionItem("PluginTest:StatusBarItem2", StatusBarSection.Center, 110, "icon-visibility-hide-2", "toggle items",
          () => {
            TestUiProvider.statusBarItemIsVisible = !TestUiProvider.statusBarItemIsVisible;
            UiFramework.pluginStatusBarItemsManager.setIsVisible("PluginTest:StatusBarItem1", TestUiProvider.statusBarItemIsVisible);
            UiFramework.pluginStatusBarItemsManager.setLabel("PluginTest:StatusBarLabel1", TestUiProvider.statusBarItemIsVisible ? "Hello" : "Goodbye");
          }));

      // add entry that supplies react component
      statusBarItems.push(StatusBarItemUtilities.createStatusBarItem("ShadowToggle", StatusBarSection.Right, 5, <ShadowToggle />));
    }
    return statusBarItems;
  }
}

/** An Immediate Tool that toggles the test ui provider defined above. */
export class UiProviderTool extends Tool {
  public static testPluginLoaded = "";

  public static toolId = "TestUiProvider";
  public run(_args: any[]): boolean {
    if (UiProviderTool.testPluginLoaded.length > 0) {
      PluginUiManager.unregister(UiProviderTool.testPluginLoaded);
      UiProviderTool.testPluginLoaded = "";
    } else {
      const testUiProvider = new TestUiProvider();
      PluginUiManager.register(testUiProvider);
      UiProviderTool.testPluginLoaded = testUiProvider.id;
    }
    return true;
  }
}

// used to test loading Plugin that provides  Ui items at startup
const testPluginLoadedAtStartup = false;
if (testPluginLoadedAtStartup) {
  const uiProvider = new TestUiProvider();
  PluginUiManager.register(uiProvider);
  UiProviderTool.testPluginLoaded = uiProvider.id;
}
