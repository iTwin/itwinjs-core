/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { expect } from "chai";
import * as sinon from "sinon";
import { mount, shallow } from "enzyme";
import TestUtils from "../TestUtils";
import {
  AnyWidgetProps,
  WidgetState,
  WidgetDefFactory,
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
} from "../../ui-framework";
import { Toolbar, Direction } from "@bentley/ui-ninezone";
import {
  PluginUiProvider, PluginUiManager, UiItemNode, ActionItemInsertSpec,
  GroupItemInsertSpec, ToolbarItemInsertSpec, ToolbarItemType,
} from "@bentley/imodeljs-frontend";

class TestUiProvider implements PluginUiProvider {
  public readonly id = "TestUiProvider";
  public provideToolbarItems(toolBarId: string, _itemIds: UiItemNode): ToolbarItemInsertSpec[] {
    if (toolBarId === "[TestFrontstage]ToolWidget-horizontal") {
      const firstActionSpec: ActionItemInsertSpec = {
        itemType: ToolbarItemType.ActionButton,
        relativeToolIdPath: "Select",
        insertBefore: true,
        itemId: "h1-test-action-tool",
        execute: (): void => {
          // tslint:disable-next-line: no-console
          console.log("Got Here!");
        },
        icon: "icon-developer",
        label: "test action tool (relative)",
      };
      return [firstActionSpec];
    }
    if (toolBarId === "[TestFrontstage]ToolWidget-vertical") {
      const firstActionSpec: ActionItemInsertSpec = {
        itemType: ToolbarItemType.ActionButton,
        relativeToolIdPath: "testGroup\\View.Fit",
        insertBefore: false,
        itemId: "v1-test-action-tool",
        execute: (): void => {
          // tslint:disable-next-line: no-console
          console.log("Got Here!");
        },
        icon: "icon-developer",
        label: "test action tool (relative)",
      };

      const lastActionSpec: ActionItemInsertSpec = {
        itemType: ToolbarItemType.ActionButton,
        insertBefore: false,
        itemId: "v2-test-action-tool",
        execute: (): void => {
          // tslint:disable-next-line: no-console
          console.log("Got Here!");
        },
        icon: "icon-developer",
        label: "test action tool (last)",
      };

      const groupActionSpec: GroupItemInsertSpec = {
        itemType: ToolbarItemType.GroupButton,
        insertBefore: false,
        itemId: "v2-test-group-button",
        icon: "icon-developer",
        label: "test group",
        items: [lastActionSpec, firstActionSpec],
      };

      return [firstActionSpec, groupActionSpec];
    }

    return [];
  }
}

describe("ToolWidget", () => {

  const testCallback = sinon.stub();

  let horizontalToolbar: React.ReactNode;
  let verticalToolbar: React.ReactNode;

  before(async () => {
    await TestUtils.initializeUiFramework();

    // Set in the before() after UiFramework.i18n is initialized
    horizontalToolbar =
      <Toolbar
        expandsTo={Direction.Bottom}
        items={
          <>
            <ActionItemButton actionItem={CoreTools.selectElementCommand} />
            <ToolButton toolId="tool1" iconSpec="icon-placeholder" labelKey="SampleApp:buttons.tool1" />
            <ToolButton toolId="tool2" iconSpec="icon-placeholder" labelKey="SampleApp:buttons.tool2" />
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
            <ToolButton toolId="tool1" iconSpec="icon-placeholder" labelKey="SampleApp:buttons.tool1" />
            <ToolButton toolId="tool2" iconSpec="icon-placeholder" labelKey="SampleApp:buttons.tool2" />
            <ToolButton toolId="tool1" iconSpec="icon-placeholder" labelKey="SampleApp:buttons.tool1" isEnabled={false} />
            <ToolButton toolId="tool2" iconSpec="icon-placeholder" labelKey="SampleApp:buttons.tool2" isVisible={false} />
            <GroupButton
              iconSpec="icon-placeholder"
              items={[tool1, tool2]}
            />
          </>
        }
      />;

  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  const backstageToggleCommand =
    new CommandItemDef({
      commandId: "SampleApp.BackstageToggle",
      iconSpec: "icon-home",
      execute: testCallback,
    });

  const tool1 = new CommandItemDef({
    commandId: "tool1",
    iconSpec: "icon-placeholder",
  });

  const tool2 = new CommandItemDef({
    commandId: "tool2",
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

    const widgetDef = WidgetDefFactory.create(widgetProps);
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

  it("ToolWidget should render with an item list", () => {
    const group1 = new GroupItemDef({
      groupId: "testGroup",
      label: "Tool Group",
      iconSpec: "icon-placeholder",
      items: [CoreTools.selectElementCommand, CoreTools.fitViewCommand],
      itemsInColumn: 4,
    });

    const hItemList = new ItemList([CoreTools.selectElementCommand]);
    const vItemList = new ItemList([CoreTools.fitViewCommand, group1]);

    const testUiProvider = new TestUiProvider();
    PluginUiManager.register(testUiProvider);

    const wrapper = mount(
      <ToolWidget
        appButton={backstageToggleCommand}
        horizontalItems={hItemList}
        verticalItems={vItemList}
      />,
    );
    wrapper.unmount();
    PluginUiManager.unregister(testUiProvider.id);
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
