/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { expect } from "chai";
import * as sinon from "sinon";
import { mount, shallow } from "enzyme";

import TestUtils from "../TestUtils";
import { GroupButton, CommandItemDef, GroupItemDef, KeyboardShortcutManager, BaseItemState, SyncUiEventDispatcher } from "../../ui-framework";
import { Direction } from "@bentley/ui-ninezone";

const tool1 = new CommandItemDef({
  commandId: "tool1",
  label: "Tool 1",
  iconSpec: "icon-placeholder",
});

const toolItemEventId = "test-button-state";
const toolItemStateFunc = (state: Readonly<BaseItemState>): BaseItemState => state;

const tool2 = new CommandItemDef({
  commandId: "tool2",
  label: "Tool 2",
  iconSpec: "icon-placeholder",
  applicationData: { key: "value" },
  stateSyncIds: [toolItemEventId],
  stateFunc: toolItemStateFunc,
  betaBadge: true,
});

const groupItemEventId = "test-button-state";
const groupItemStateFunc = (state: Readonly<BaseItemState>): BaseItemState => state;

const group1 = new GroupItemDef({
  groupId: "nested-group",
  label: "Group 1",
  iconSpec: "icon-placeholder",
  items: [tool1, tool2],
  direction: Direction.Bottom,
  itemsInColumn: 7,
  stateSyncIds: [groupItemEventId],
  stateFunc: groupItemStateFunc,
});

describe("GroupItem", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  describe("<GroupButton />", () => {

    it("should render", () => {
      const wrapper = mount(
        <GroupButton
          labelKey="UiFramework:tests.label"
          iconSpec="icon-placeholder"
          items={[tool1, tool2]}
          direction={Direction.Bottom}
          itemsInColumn={4}
        />,
      );
      wrapper.unmount();
    });

    it("should not render if not visible", () => {
      const wrapper = mount(
        <GroupButton
          labelKey="UiFramework:tests.label"
          iconSpec="icon-placeholder"
          items={[tool1, tool2]}
          direction={Direction.Bottom}
          itemsInColumn={4}
          isVisible={false}
        />,
      );
      wrapper.unmount();
    });

    it("renders correctly", () => {
      shallow(
        <GroupButton
          labelKey="UiFramework:tests.label"
          iconSpec="icon-placeholder"
          items={[tool1, tool2]}
          direction={Direction.Bottom}
          itemsInColumn={4}
        />,
      ).should.matchSnapshot();
    });

    it("should handle props change", () => {
      const wrapper = mount(
        <GroupButton
          labelKey="UiFramework:tests.label"
          iconSpec="icon-placeholder"
          items={[tool1, tool2]}
          direction={Direction.Bottom}
          itemsInColumn={4}
        />,
      );

      wrapper.setProps({ labelKey: "UiFramework:tests.label2" });
      wrapper.unmount();
    });

    it("sync event should trigger stateFunc", () => {
      const testEventId = "test-button-state";
      let stateFunctionCalled = false;
      const testStateFunc = (state: Readonly<BaseItemState>): BaseItemState => { stateFunctionCalled = true; return state; };

      const wrapper = mount(
        <GroupButton
          labelKey="UiFramework:tests.label"
          iconSpec="icon-placeholder"
          items={[tool1, tool2]}
          direction={Direction.Bottom}
          itemsInColumn={4}
          stateSyncIds={[testEventId]}
          stateFunc={testStateFunc}
        />,
      );

      expect(stateFunctionCalled).to.eq(false);
      SyncUiEventDispatcher.dispatchImmediateSyncUiEvent(testEventId);
      expect(stateFunctionCalled).to.eq(true);

      stateFunctionCalled = false;
      SyncUiEventDispatcher.dispatchImmediateSyncUiEvent(testEventId + "-noop");
      expect(stateFunctionCalled).to.eq(false);

      wrapper.unmount();
    });

    it("sync event should trigger stateFunc in items", () => {
      const testEventId = "test-button-state";

      const wrapper = mount(
        <GroupButton
          labelKey="UiFramework:tests.label"
          iconSpec="icon-placeholder"
          items={[tool1, tool2]}
          direction={Direction.Bottom}
          itemsInColumn={4}
        />,
      );

      SyncUiEventDispatcher.dispatchImmediateSyncUiEvent(testEventId);

      wrapper.unmount();
    });

    it("GroupButton opens", () => {

      const wrapper = mount(
        <GroupButton
          labelKey="SampleApp:buttons.toolGroup"
          iconSpec="icon-placeholder"
          items={[tool1, tool2]}
          direction={Direction.Bottom}
          itemsInColumn={7}
        />,
      );

      const buttonDiv = wrapper.find("button.nz-toolbar-item-item");
      expect(buttonDiv.length).to.eq(1);

      buttonDiv.simulate("click");
      wrapper.update();

      expect(wrapper.find("div.nz-toolbar-item-expandable-group-panel").length).to.eq(1);

      wrapper.unmount();
    });

    it("GroupButton opens & support history", () => {
      const executeSpy = sinon.spy();

      const testSpyTool = new CommandItemDef({
        commandId: "spyTool",
        iconSpec: "icon-placeholder",
        labelKey: "SampleApp:buttons.spyTool",
        execute: executeSpy,
        stateSyncIds: [toolItemEventId],
        stateFunc: toolItemStateFunc,
      });

      const wrapper = mount(
        <GroupButton
          labelKey="SampleApp:buttons.toolGroup"
          iconSpec="icon-placeholder"
          items={[testSpyTool, tool1, tool2]}
          direction={Direction.Bottom}
          itemsInColumn={7}
        />,
      );

      const expandableItem = wrapper.find("div.nz-toolbar-item-expandable-expandable");
      expect(expandableItem.length).to.eq(1);
      expandableItem.simulate("mouseenter");
      expandableItem.simulate("mouseleave");

      const buttonDiv = wrapper.find("button.nz-toolbar-item-item");
      expect(buttonDiv.length).to.eq(1);

      buttonDiv.simulate("click");
      wrapper.update();

      const toolItems = wrapper.find("div.nz-toolbar-item-expandable-group-tool-item");
      expect(toolItems.length).to.eq(3);
      toolItems.at(0).simulate("click");
      expect(executeSpy.calledOnce).to.be.true;
      wrapper.update();

      const historyItem = wrapper.find("div.nz-toolbar-item-expandable-history-item");
      expect(historyItem.length).to.eq(1);
      historyItem.simulate("click");
      expect(executeSpy.calledTwice).to.be.true;

      wrapper.unmount();
    });

    it("GroupButton supports history item with no sync", () => {
      const wrapper = mount(
        <GroupButton
          labelKey="SampleApp:buttons.toolGroup"
          iconSpec="icon-placeholder"
          items={[tool1]}
          direction={Direction.Bottom}
          itemsInColumn={7}
        />,
      );

      const buttonDiv = wrapper.find("button.nz-toolbar-item-item");
      expect(buttonDiv.length).to.eq(1);

      buttonDiv.simulate("click");
      wrapper.update();

      const toolItems = wrapper.find("div.nz-toolbar-item-expandable-group-tool-item");
      expect(toolItems.length).to.eq(1);
      toolItems.at(0).simulate("click");
      wrapper.update();

      const historyItem = wrapper.find("div.nz-toolbar-item-expandable-history-item");
      expect(historyItem.length).to.eq(1);
      historyItem.simulate("click");

      wrapper.unmount();
    });

    it("should set focus to home on Esc", () => {
      const wrapper = mount(<GroupButton items={[tool1, tool2]} />);
      const element = wrapper.find(".nz-toolbar-item-item");
      element.simulate("focus");
      element.simulate("keyDown", { key: "Escape", keyCode: 27 });
      expect(KeyboardShortcutManager.isFocusOnHome).to.be.true;
      wrapper.unmount();
    });

    it("should include a GroupToolExpander when a GroupItemDef is included", () => {
      const wrapper = mount(<GroupButton items={[tool1, tool2, group1]} />);

      const buttonDiv = wrapper.find("button.nz-toolbar-item-item");
      expect(buttonDiv.length).to.eq(1);

      buttonDiv.simulate("click");
      wrapper.update();

      const expanderDiv = wrapper.find("div.nz-toolbar-item-expandable-group-tool-expander");
      expect(expanderDiv.length).to.eq(1);

      expanderDiv.simulate("click");
      wrapper.update();

      const backArrowDiv = wrapper.find("div.nz-toolbar-item-expandable-group-backArrow");
      expect(backArrowDiv.length).to.eq(1);

      backArrowDiv.simulate("click");
      wrapper.update();

      wrapper.unmount();
    });
  });

  describe("GroupItemDef", () => {
    it("Supports CommandItemDef correctly", () => {
      const groupItemDef = new GroupItemDef({
        groupId: "my-group1",
        labelKey: "SampleApp:buttons.toolGroup",
        iconSpec: "icon-placeholder",
        items: [tool1, tool2],
        direction: Direction.Bottom,
        itemsInColumn: 7,
      });

      groupItemDef.resolveItems();

      expect(groupItemDef.itemCount).to.eq(2);
      expect(groupItemDef.getItemById("tool1")).to.not.be.undefined;

      groupItemDef.execute(); // Does nothing

      let reactNode = groupItemDef.toolbarReactNode(1);
      expect(reactNode).to.not.be.undefined;

      reactNode = groupItemDef.toolbarReactNode();
      expect(reactNode).to.not.be.undefined;
    });

  });

});
