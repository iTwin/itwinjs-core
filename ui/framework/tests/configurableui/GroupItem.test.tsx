/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import * as React from "react";
import { expect } from "chai";
import * as sinon from "sinon";
import { mount, shallow } from "enzyme";

import TestUtils from "../TestUtils";
import { GroupButton, ConfigurableUiManager, ItemPropsList, ToolItemDef, GroupItemDef } from "../../src";
import Direction from "@bentley/ui-ninezone/lib/utilities/Direction";

describe("GroupItem", () => {

  before(async () => {
    await TestUtils.initializeUiFramework();

    const commonItemsList: ItemPropsList = {
      items: [
        {
          toolId: "item1",
          iconClass: "icon-placeholder",
          labelKey: "SampleApp:buttons.item1",
        },
        {
          toolId: "item2",
          iconClass: "icon-placeholder",
          labelKey: "SampleApp:buttons.item2",
        },
        {
          toolId: "item3",
          iconClass: "icon-placeholder",
          labelKey: "SampleApp:buttons.item3",
        },
        {
          toolId: "item4",
          iconClass: "icon-placeholder",
          labelKey: "SampleApp:buttons.item4",
        },
      ],
    };
    ConfigurableUiManager.loadCommonItems(commonItemsList);

  });

  describe("<GroupButton />", () => {
    it("should render", () => {
      mount(
        <GroupButton
          labelKey="UiFramework:tests.label"
          iconClass="icon-placeholder"
          items={["item1", "item2", "item3", "item4"]}
          direction={Direction.Bottom}
          itemsInColumn={4}
        />,
      );
    });

    it("renders correctly", () => {
      shallow(
        <GroupButton
          labelKey="UiFramework:tests.label"
          iconClass="icon-placeholder"
          items={["item1", "item2", "item3", "item4"]}
          direction={Direction.Bottom}
          itemsInColumn={4}
        />,
      ).should.matchSnapshot();
    });

    it("GroupButton opens", () => {

      const wrapper = mount(
        <GroupButton
          labelKey="SampleApp:buttons.toolGroup"
          iconClass="icon-placeholder"
          items={["item1", "item2", "item3", "item4"]}
          direction={Direction.Bottom}
          itemsInColumn={7}
        />,
      );

      const buttonDiv = wrapper.find("div.nz-toolbar-item-item");
      expect(buttonDiv.length).to.eq(1);

      buttonDiv.simulate("click");
      wrapper.update();

      expect(wrapper.find("div.nz-toolbar-item-expandable-group-panel").length).to.eq(1);
    });

    it("GroupButton opens & support history", () => {
      const executeSpy = sinon.spy();

      const myToolItem1 = new ToolItemDef({
        toolId: "tool1",
        iconClass: "icon-placeholder",
        labelKey: "SampleApp:buttons.tool1",
        execute: executeSpy,
      });

      const wrapper = mount(
        <GroupButton
          labelKey="SampleApp:buttons.toolGroup"
          iconClass="icon-placeholder"
          items={[myToolItem1, "item2", "item3", "item4"]}
          direction={Direction.Bottom}
          itemsInColumn={7}
        />,
      );

      const buttonDiv = wrapper.find("div.nz-toolbar-item-item");
      expect(buttonDiv.length).to.eq(1);

      buttonDiv.simulate("click");
      wrapper.update();

      const toolItems = wrapper.find("div.nz-toolbar-item-expandable-group-tool-item");
      expect(toolItems.length).to.eq(4);
      toolItems.at(0).simulate("click");
      expect(executeSpy.calledOnce).to.be.true;
      wrapper.update();

      const historyItem = wrapper.find("div.nz-toolbar-item-expandable-history-item");
      expect(historyItem.length).to.eq(1);
      historyItem.simulate("click");
      wrapper.update();
    });
  });

  describe("GroupItemDef", () => {
    it("Supports ToolItemDef correctly", () => {
      const myToolItem1 = new ToolItemDef({
        toolId: "tool1",
        iconClass: "icon-placeholder",
        labelKey: "SampleApp:buttons.tool1",
        applicationData: { key: "value" },
      });

      const groupItemDef = new GroupItemDef({
        groupId: "my-group1",
        labelKey: "SampleApp:buttons.toolGroup",
        iconClass: "icon-placeholder",
        items: [myToolItem1, "item2", "item3", "item4"],
        direction: Direction.Bottom,
        itemsInColumn: 7,
      });

      groupItemDef.resolveItems();

      expect(groupItemDef.itemCount).to.eq(4);
      expect(groupItemDef.getItemById("tool1")).to.not.be.undefined;

      groupItemDef.execute(); // Does nothing

      let reactNode = groupItemDef.toolbarReactNode(1);
      expect(reactNode).to.not.be.undefined;

      reactNode = groupItemDef.toolbarReactNode();
      expect(reactNode).to.not.be.undefined;
    });

  });

});
