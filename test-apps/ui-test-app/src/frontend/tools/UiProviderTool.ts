/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module Tools */

import {
  Tool, PluginUiProvider, PluginUiManager, UiItemNode, ActionItemInsertSpec, GroupItemInsertSpec,
  ToolbarItemInsertSpec, ToolbarItemType, BadgeType, ConditionalDisplayType,
} from "@bentley/imodeljs-frontend";
import { SampleAppIModelApp, SampleAppUiActionId } from "../index";

/** alpha test code */
class TestUiProvider implements PluginUiProvider {
  public readonly id = "TestUiProvider";
  public provideToolbarItems(toolBarId: string, _itemIds: UiItemNode): ToolbarItemInsertSpec[] {
    // tslint:disable-next-line: no-console
    // console.log(`Requesting tools for toolbar ${toolBarId}`);

    if ("[ViewsFrontstage]ToolWidget-horizontal" === toolBarId) {
      const firstActionSpec: ActionItemInsertSpec = {
        itemType: ToolbarItemType.ActionButton,
        insertBefore: true,
        itemId: "first-test-action-tool",
        execute: (): void => {
          // tslint:disable-next-line: no-console
          console.log("Got Here!");
        },
        icon: "icon-developer",
        label: "test action tool (first)",
      };

      const middleActionSpec: ActionItemInsertSpec = {
        itemType: ToolbarItemType.ActionButton,
        insertBefore: true,
        relativeToolIdPath: "Tool1",
        itemId: "middle-test-action-tool",
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
        label: "test action tool (middle)",
      };

      const nestedActionSpec: ActionItemInsertSpec = {
        itemType: ToolbarItemType.ActionButton,
        insertBefore: false,
        relativeToolIdPath: "Conditional-formatting\\tool-formatting-setting\\toggleLengthFormat",
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
        insertBefore: false,
        icon: "icon-developer",
        label: "test group",
        items: [firstActionSpec, nestedActionSpec],
      };

      return [firstActionSpec, middleActionSpec, nestedActionSpec, groupSpec];

    } else if ("[ViewsFrontstage]NavigationWidget-horizontal" === toolBarId) {
      const navHorizontalSpec: ActionItemInsertSpec = {
        itemType: ToolbarItemType.ActionButton,
        insertBefore: true,
        relativeToolIdPath: "View.Pan",
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
        insertBefore: false,
        relativeToolIdPath: "View.Fly",
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
}

/** An Immediate Tool that toggles the test ui provider defined above. */
export class UiProviderTool extends Tool {
  private static _testPluginLoaded = "";

  public static toolId = "TestUiProvider";
  public run(_args: any[]): boolean {
    if (UiProviderTool._testPluginLoaded.length > 0) {
      PluginUiManager.unregister(UiProviderTool._testPluginLoaded);
      UiProviderTool._testPluginLoaded = "";
    } else {
      const uiProvider = new TestUiProvider();
      PluginUiManager.register(uiProvider);
      UiProviderTool._testPluginLoaded = uiProvider.id;
    }
    return true;
  }
}
