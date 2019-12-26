/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { expect } from "chai";
import * as sinon from "sinon";
import { mount, shallow } from "enzyme";
import { render, cleanup, fireEvent } from "@testing-library/react";

import TestUtils from "../TestUtils";
import {
  AnyWidgetProps,
  WidgetState,
  ToolWidgetDef,
  ToolButton,
  GroupButton,
  ToolWidget,
  CommandItemDef,
  ActionItemButton,
  CoreTools,
  ItemList,
  FrontstageManager,
  GroupItemDef,
  ConditionalItemDef,
  BaseItemState,
  ToolbarDragInteractionContext,
} from "../../ui-framework";
import { Toolbar, Direction } from "@bentley/ui-ninezone";
import { IModelApp, NoRenderApp } from "@bentley/imodeljs-frontend";
import { PluginUiProvider, PluginUiManager, ActionItemInsertSpec, GroupItemInsertSpec, ToolbarItemInsertSpec, ToolbarItemType, ConditionalDisplayType } from "@bentley/ui-abstract";

import { SyncUiEventDispatcher } from "../../ui-framework/syncui/SyncUiEventDispatcher";

let showConditionalTool = true;
// cSpell:ignore toolwidgettest visibilitytoggled
const testEventId = "toolwidgettest.visibilitytoggled";
const toggleToolTitle = "plugin-conditional1";

class TestUiProvider implements PluginUiProvider {
  public readonly id = "TestUiProvider";
  public provideToolbarItems(toolBarId: string): ToolbarItemInsertSpec[] {
    if (toolBarId.includes("ToolWidget-horizontal")) {
      const firstActionSpec: ActionItemInsertSpec = {
        itemType: ToolbarItemType.ActionButton,
        itemId: "plugin-action1",
        execute: (): void => {
          // tslint:disable-next-line: no-console
          console.log("Got Here!");
        },
        icon: "icon-developer",
        label: "plugin-action1",
      };
      const conditionalActionSpec: ActionItemInsertSpec = {
        itemType: ToolbarItemType.ActionButton,
        itemId: "plugin-conditional1",
        condition: {
          type: ConditionalDisplayType.Visibility,
          testFunc: (): boolean => {
            return true === showConditionalTool;
          },
          syncEventIds: [testEventId],
        },
        execute: (): void => {
          showConditionalTool = !showConditionalTool;
          SyncUiEventDispatcher.dispatchImmediateSyncUiEvent(testEventId);
        },
        icon: "icon-developer",
        label: toggleToolTitle,
      };

      const hGroupTool1ActionSpec: ActionItemInsertSpec = {
        itemType: ToolbarItemType.ActionButton,
        itemId: "plugin-group1-entry1",
        execute: (): void => {
          // tslint:disable-next-line: no-console
          console.log("Got Here!");
        },
        icon: "icon-developer",
        label: "plugin-group1-entry1",
      };

      const hGroupTool2ActionSpec: ActionItemInsertSpec = {
        itemType: ToolbarItemType.ActionButton,
        itemId: "plugin-group1-entry2",
        execute: (): void => {
          // tslint:disable-next-line: no-console
          console.log("Got Here!");
        },
        icon: "icon-developer",
        label: "plugin-group1-entry2",
      };

      const horizontalToolbarGroupSpec: GroupItemInsertSpec = {
        itemType: ToolbarItemType.GroupButton,
        itemId: "plugin-group1",
        icon: "icon-developer",
        label: "plugin-group1",
        condition: {
          type: ConditionalDisplayType.EnableState,
          testFunc: (): boolean => {
            return true === showConditionalTool;
          },
          syncEventIds: [testEventId],
        },
        items: [hGroupTool1ActionSpec, hGroupTool2ActionSpec],
      };

      return [conditionalActionSpec, firstActionSpec, horizontalToolbarGroupSpec];
    }

    if (toolBarId.includes("ToolWidget-vertical")) {
      const nestedVerticalActionSpec: ActionItemInsertSpec = {
        itemType: ToolbarItemType.ActionButton,
        parentToolGroupId: "test:GroupByDef",
        itemId: "plugin-vertical-nested-action",
        execute: (): void => {
          // tslint:disable-next-line: no-console
          console.log("Got Here!");
        },
        icon: "icon-developer",
        label: "plugin-vertical-nested-action",
      };

      const groupChild1Spec: ActionItemInsertSpec = {
        itemType: ToolbarItemType.ActionButton,
        itemId: "plugin-vertical-group1-action1",
        execute: (): void => {
          // tslint:disable-next-line: no-console
          console.log("Got Here!");
        },
        icon: "icon-developer",
        label: "plugin-vertical-group1-action1",
      };

      const groupChild2Spec: ActionItemInsertSpec = {
        itemType: ToolbarItemType.ActionButton,
        itemId: "plugin-vertical-group1-action2",
        execute: (): void => {
          // tslint:disable-next-line: no-console
          console.log("Got Here!");
        },
        icon: "icon-developer",
        label: "plugin-vertical-group1-action2",
      };

      const groupActionSpec: GroupItemInsertSpec = {
        itemType: ToolbarItemType.GroupButton,
        itemId: "plugin-vertical-group1",
        icon: "icon-developer",
        label: "plugin-vertical-group1",
        items: [groupChild1Spec, groupChild2Spec],
      };

      return [nestedVerticalActionSpec, groupActionSpec];
    }

    return [];
  }
}

const testCallback = sinon.stub();

const backstageToggleCommand =
  new CommandItemDef({
    commandId: "SampleApp.BackstageToggle",
    iconSpec: "icon-home",
    execute: testCallback,
  });

describe("ToolWidget", () => {

  describe("Not Plugin-compatible", () => {
    let horizontalToolbar: React.ReactNode;
    let verticalToolbar: React.ReactNode;

    before(async () => {
      await TestUtils.initializeUiFramework();
      NoRenderApp.startup();

      // Set in the before() after UiFramework.i18n is initialized
      horizontalToolbar =
        <Toolbar
          expandsTo={Direction.Bottom}
          items={
            <>
              <ActionItemButton actionItem={CoreTools.selectElementCommand} />
              <ToolButton toolId="tool1a" iconSpec="icon-placeholder" labelKey="SampleApp:buttons.tool1" />
              <ToolButton toolId="tool2a" iconSpec="icon-placeholder" labelKey="SampleApp:buttons.tool2" />
              <GroupButton
                iconSpec="icon-placeholder"
                items={[tool1, tool2]}
                direction={Direction.Bottom}
                itemsInColumn={7}
              />
            </>
          }
        />;

      verticalToolbar =
        <Toolbar
          expandsTo={Direction.Right}
          items={
            <>
              <ToolButton toolId="tool1b" iconSpec="icon-placeholder" labelKey="SampleApp:buttons.tool1" />
              <ToolButton toolId="tool2b" iconSpec="icon-placeholder" labelKey="SampleApp:buttons.tool2" />
              <ToolButton toolId="tool1c" iconSpec="icon-placeholder" labelKey="SampleApp:buttons.tool1" isEnabled={false} />
              <ToolButton toolId="tool2c" iconSpec="icon-placeholder" labelKey="SampleApp:buttons.tool2" isVisible={false} />
              <GroupButton
                iconSpec="icon-placeholder"
                items={[tool1, tool2]}
              />
            </>
          }
        />;

    });

    after(async () => {
      TestUtils.terminateUiFramework();
      IModelApp.shutdown();
    });

    const tool1 = new CommandItemDef({
      commandId: "cmd:tool1",
      iconSpec: "icon-placeholder",
    });

    const tool2 = new CommandItemDef({
      commandId: "cmd:tool2",
      iconSpec: "icon-placeholder",
      applicationData: { key: "value" },
    });

    const widgetProps: AnyWidgetProps = {
      classId: "ToolWidget",
      defaultState: WidgetState.Open,
      isFreeform: true,
      iconSpec: "icon-home",
      appButton: backstageToggleCommand,
      horizontalDirection: Direction.Top,
      verticalDirection: Direction.Left,
    };

    it("ToolWidgetDef from WidgetProps", () => {

      const widgetDef = new ToolWidgetDef(widgetProps);
      expect(widgetDef).to.be.instanceof(ToolWidgetDef);

      const toolWidgetDef = widgetDef as ToolWidgetDef;
      backstageToggleCommand.execute();
      expect(testCallback.calledOnce).to.be.true;

      const reactElement = toolWidgetDef.reactElement;
      expect(reactElement).to.not.be.undefined;

      const reactNode = toolWidgetDef.renderCornerItem();
      expect(reactNode).to.not.be.undefined;
    });

    it("ToolWidget should render", () => {
      const wrapper = mount(
        <ToolWidget
          appButton={backstageToggleCommand}
          horizontalToolbar={horizontalToolbar}
          verticalToolbar={verticalToolbar}
        />,
      );
      wrapper.unmount();
    });

    it("ToolWidget should render correctly", () => {
      shallow(
        <ToolWidget
          id="toolWidget"
          appButton={backstageToggleCommand}
          horizontalToolbar={horizontalToolbar}
          verticalToolbar={verticalToolbar}
        />,
      ).should.matchSnapshot();
    });

    it("ToolWidget should support update", () => {
      const wrapper = mount(
        <ToolWidget
          button={<button />}
          horizontalToolbar={horizontalToolbar}
          verticalToolbar={verticalToolbar}
        />,
      );
      expect(wrapper.find(ToolButton).length).to.eq(6);

      wrapper.setProps({ verticalToolbar: undefined });
      wrapper.update();
      expect(wrapper.find(ToolButton).length).to.eq(2);

      wrapper.unmount();
    });

    it("ToolWidget should tool activated", () => {
      const wrapper = mount(
        <ToolWidget
          button={<button />}
          horizontalToolbar={horizontalToolbar}
          verticalToolbar={verticalToolbar}
        />,
      );

      FrontstageManager.onToolActivatedEvent.emit({ toolId: "tool1" });
      wrapper.update();

      wrapper.unmount();
    });
  });

  describe("Test Plugin items", () => {

    before(async () => {
      await TestUtils.initializeUiFramework();
      NoRenderApp.startup();
    });

    after(() => {
      TestUtils.terminateUiFramework();
      IModelApp.shutdown();
    });

    afterEach(cleanup);

    // NOTE: none of the following attempts to get the ToolWidget to size itself is working.
    const parentDivStyle: React.CSSProperties = {
      position: `relative`,
      left: `0`,
      top: `0`,
      width: `100%`,
      height: `100%`,
      overflow: `hidden`,
    };

    const toolWidgetDivStyle: React.CSSProperties = {
      height: `800px`,
      left: `0px`,
      top: `0px`,
      width: `1000px`,
      position: `absolute`,
    };

    it("Render Plugin items to Dom", async () => {
      const group1 = new GroupItemDef({
        groupId: "test:GroupByDef",
        label: "Tool Group (from def)",
        iconSpec: "icon-placeholder",
        items: [CoreTools.walkViewCommand, CoreTools.windowAreaCommand],
        itemsInColumn: 4,
      });

      const testItemEventId = "test-conditional-event";
      const testItemStateFunc = (currentState: Readonly<BaseItemState>): BaseItemState => {
        const returnState: BaseItemState = { ...currentState };
        returnState.isEnabled = true;
        returnState.isVisible = true;
        return returnState;
      };

      const testH1Def = new CommandItemDef({
        commandId: "test-h1-tool",
        execute: (): void => { },
        iconSpec: "icon-developer",
        label: "test-h1-tool",
      });

      const testV1Def = new CommandItemDef({
        commandId: "test-v1-tool",
        execute: (): void => { },
        iconSpec: "icon-developer",
        label: "test-v1-tool",
      });

      const testC1Def = new CommandItemDef({
        commandId: "test-c1-tool",
        execute: (): void => { },
        iconSpec: "icon-developer",
        label: "test-c1-tool",
      });

      const conditionItemDef = new ConditionalItemDef({
        items: [testC1Def],
        stateSyncIds: [testItemEventId],
        stateFunc: testItemStateFunc,
      });

      const hItemList = new ItemList([testH1Def, conditionItemDef]);
      const vItemList = new ItemList([testV1Def, group1]);

      showConditionalTool = true;

      const component = render(
        <div style={parentDivStyle}>
          <div style={toolWidgetDivStyle} className="nz-zones-zone">
            <ToolbarDragInteractionContext.Provider value={true}>
              <ToolWidget
                appButton={backstageToggleCommand}
                horizontalItems={hItemList}
                verticalItems={vItemList}
              />
            </ToolbarDragInteractionContext.Provider>
          </div>
        </div>,
      );

      expect(component).not.to.be.null;
      // tslint:disable-next-line: no-console

      const testUiProvider = new TestUiProvider();
      PluginUiManager.register(testUiProvider);
      await TestUtils.flushAsyncOperations();

      expect(showConditionalTool).to.be.true;
      let toggleButton = component.queryByTitle(toggleToolTitle) as HTMLButtonElement;
      expect(toggleButton).not.to.be.null;

      fireEvent.click(toggleButton);
      expect(showConditionalTool).to.be.false;
      toggleButton = component.queryByTitle(toggleToolTitle) as HTMLButtonElement;
      expect(toggleButton).to.be.null;

      // component.debug();
      const insertedItem = component.queryAllByTitle("plugin-vertical-group1-action1");
      expect(insertedItem.length).to.eq(1);
      PluginUiManager.unregister(testUiProvider.id);
    });
  });
});
