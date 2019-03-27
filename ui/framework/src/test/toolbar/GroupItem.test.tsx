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
  iconSpec: "icon-placeholder",
});

const tool2 = new CommandItemDef({
  commandId: "tool2",
  iconSpec: "icon-placeholder",
  applicationData: { key: "value" },
});

describe("GroupItem", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  describe("<GroupButton />", () => {

    it("should render", () => {
      mount(
        <GroupButton
          labelKey="UiFramework:tests.label"
          iconSpec="icon-placeholder"
          items={[tool1, tool2]}
          direction={Direction.Bottom}
          itemsInColumn={4}
        />,
      );
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

    it("sync event should trigger stateFunc", () => {
      const testEventId = "test-buttonstate";
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
    });

    it("GroupButton opens & support history", () => {
      const executeSpy = sinon.spy();

      const testSpyTool = new CommandItemDef({
        commandId: "spytool",
        iconSpec: "icon-placeholder",
        labelKey: "SampleApp:buttons.tool1",
        execute: executeSpy,
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
      wrapper.update();
    });

    it("should set focus to home on Esc", () => {
      const wrapper = mount(<GroupButton items={[tool1, tool2]} />);
      const element = wrapper.find(".nz-toolbar-item-item");
      element.simulate("focus");
      element.simulate("keyDown", { key: "Escape", keyCode: 27 });
      expect(KeyboardShortcutManager.isFocusOnHome).to.be.true;
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
