/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { ReactWrapper, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { ActionButton, BadgeType, ToolbarItemUtilities } from "@itwin/appui-abstract";
import { WithOnOutsideClickProps } from "@itwin/core-react";
import { GroupColumn, GroupTool, GroupToolExpander, Item, NestedGroup, WithDragInteractionProps } from "@itwin/appui-layout-react";
import { GroupButtonItem, KeyboardShortcutManager, ToolbarDragInteractionContext, ToolbarGroupItem, ToolGroupPanelContext } from "../../appui-react";
import TestUtils, { mount } from "../TestUtils";

const tool1 = ToolbarItemUtilities.createActionButton("childButton1", 10, "icon-button", "label", () => { }, { badgeType: BadgeType.New });
const tool2 = ToolbarItemUtilities.createActionButton("childButton2", 20, "icon-button", "label", () => { });
const group1 = ToolbarItemUtilities.createGroupButton("groupButton", 10, "icon-button", "label", [tool1, tool2]);

const tool3 = ToolbarItemUtilities.createActionButton("childButton2", 20, "icon-button", "label", () => { });
const tool4 = ToolbarItemUtilities.createActionButton("childButton2", 20, "icon-button", "label", () => { });
const group2 = ToolbarItemUtilities.createGroupButton("groupButton", 10, "icon-button", "label", [group1, tool3, tool4]);

describe("GroupButtonItem", () => {
  before(async () => {
    await TestUtils.initializeUiFramework();
  });

  after(() => {
    TestUtils.terminateUiFramework();
  });

  describe("<GroupButtonItem />", () => {
    it("should render", () => {
      mount(
        <GroupButtonItem item={group1} />,
      );
    });

    it("renders correctly", () => {
      shallow(
        <GroupButtonItem item={group1} />,
      ).should.matchSnapshot();
    });

    it("should not render if not visible", () => {
      const hiddenTool = ToolbarItemUtilities.createActionButton("childButton1", 10, "icon-button", "label", () => { }, { isHidden: true });
      const hiddenGroup = ToolbarItemUtilities.createGroupButton("groupButton", 10, "icon-button", "label", [hiddenTool], { isHidden: true });
      mount(
        <GroupButtonItem item={hiddenGroup} />,
      ).should.matchSnapshot();
    });

    it("should handle props change", () => {
      const wrapper = mount(
        <GroupButtonItem item={group1} />,
      );

      wrapper.setProps({ item: group2 });
    });

    it("should set focus to home on Esc", () => {
      const wrapper = mount(<GroupButtonItem item={group1} />);
      const element = wrapper.find(".nz-toolbar-item-item");
      element.simulate("focus");
      element.simulate("keyDown", { key: "Escape" });
      expect(KeyboardShortcutManager.isFocusOnHome).to.be.true;
    });
  });

  describe("<GroupButtonItem />", () => {
    describe("dragInteraction", () => {
      describe("open with dragInteraction", () => {
        it("should close on outside click", () => {
          const sut = mount(
            <ToolbarDragInteractionContext.Provider value={false}>
              <ToolbarGroupItem
                groupItem={group1} key={group1.id}
              />
            </ToolbarDragInteractionContext.Provider>,
          );

          const groupItem = sut.find(ToolbarGroupItem) as ReactWrapper<ToolbarGroupItem["props"], ToolbarGroupItem["state"], ToolbarGroupItem>;
          groupItem.setState({ isPressed: true });

          const toolGroup = sut.find("WithOnOutsideClick") as ReactWrapper<WithOnOutsideClickProps>;
          const event = new MouseEvent("");
          sinon.stub(event, "target").get(() => document.createElement("div"));
          toolGroup.prop("onOutsideClick")!(event);

          expect(groupItem.state().isPressed).to.be.false;
        });

        it("should toggle panel when onOpenPanel executed", () => {
          const sut = mount(
            <ToolbarDragInteractionContext.Provider value={true}>
              <ToolbarGroupItem
                groupItem={group1} key={group1.id} />
            </ToolbarDragInteractionContext.Provider>,
          );
          const groupItem = sut.find(ToolbarGroupItem) as ReactWrapper<ToolbarGroupItem["props"], ToolbarGroupItem["state"], ToolbarGroupItem>;
          const buttonDiv = sut.find("WithDragInteraction") as ReactWrapper<WithDragInteractionProps>;
          expect(buttonDiv.length).to.eq(1);
          buttonDiv.prop("onOpenPanel")!();
          sut.update();

          expect(groupItem.state().isPressed).to.be.true;
        });

        const createToolArray = (numTools: number) => {
          const toolArray: ActionButton[] = [];
          for (let i = 0; i < numTools; i++)
            toolArray.push(ToolbarItemUtilities.createActionButton(`button-${i}`, 20, "icon-button", "label", () => { }));
          return toolArray;
        };

        it("should toggle panel when onOpenPanel executed 24 items", () => {
          const group2Col = ToolbarItemUtilities.createGroupButton("groupButton", 10, "icon-button", "label", createToolArray(24));

          const sut = mount(
            <ToolbarDragInteractionContext.Provider value={true}>
              <ToolbarGroupItem
                groupItem={group2Col} key={group2Col.id} />
            </ToolbarDragInteractionContext.Provider>,
          );
          const groupItem = sut.find(ToolbarGroupItem) as ReactWrapper<ToolbarGroupItem["props"], ToolbarGroupItem["state"], ToolbarGroupItem>;
          const buttonDiv = sut.find("WithDragInteraction") as ReactWrapper<WithDragInteractionProps>;
          expect(buttonDiv.length).to.eq(1);
          buttonDiv.prop("onOpenPanel")!();
          sut.update();

          expect(groupItem.state().isPressed).to.be.true;
          expect(sut.find(GroupColumn).length).to.eq(2);
        });

        it("should toggle panel when onOpenPanel executed 36 items", () => {
          const group3Col = ToolbarItemUtilities.createGroupButton("groupButton", 10, "icon-button", "label", createToolArray(36));

          const sut = mount(
            <ToolbarDragInteractionContext.Provider value={true}>
              <ToolbarGroupItem
                groupItem={group3Col} key={group3Col.id} />
            </ToolbarDragInteractionContext.Provider>,
          );
          const groupItem = sut.find(ToolbarGroupItem) as ReactWrapper<ToolbarGroupItem["props"], ToolbarGroupItem["state"], ToolbarGroupItem>;
          const buttonDiv = sut.find("WithDragInteraction") as ReactWrapper<WithDragInteractionProps>;
          expect(buttonDiv.length).to.eq(1);
          buttonDiv.prop("onOpenPanel")!();
          sut.update();

          expect(groupItem.state().isPressed).to.be.true;
          expect(sut.find(GroupColumn).length).to.eq(3);
        });

        it("should toggle panel when onOpenPanel executed 48 items", () => {
          const group4Col = ToolbarItemUtilities.createGroupButton("groupButton", 10, "icon-button", "label", createToolArray(48));

          const sut = mount(
            <ToolbarDragInteractionContext.Provider value={true}>
              <ToolbarGroupItem
                groupItem={group4Col} key={group4Col.id} />
            </ToolbarDragInteractionContext.Provider>,
          );
          const groupItem = sut.find(ToolbarGroupItem) as ReactWrapper<ToolbarGroupItem["props"], ToolbarGroupItem["state"], ToolbarGroupItem>;
          const buttonDiv = sut.find("WithDragInteraction") as ReactWrapper<WithDragInteractionProps>;
          expect(buttonDiv.length).to.eq(1);
          buttonDiv.prop("onOpenPanel")!();
          sut.update();

          expect(groupItem.state().isPressed).to.be.true;
          expect(sut.find(GroupColumn).length).to.eq(4);
        });

        it("should include a GroupToolExpander when a GroupItem is included", () => {
          const wrapper = mount(
            <ToolbarDragInteractionContext.Provider value={true}>
              <GroupButtonItem item={group2} />
            </ToolbarDragInteractionContext.Provider>,
          );

          const buttonDiv = wrapper.find("WithDragInteraction") as ReactWrapper<WithDragInteractionProps>;
          expect(buttonDiv.length).to.eq(1);

          buttonDiv.prop("onOpenPanel")!();
          wrapper.update();

          const expanderDiv = wrapper.find("div.nz-toolbar-item-expandable-group-tool-expander");
          expect(expanderDiv.length).to.eq(1);

          expanderDiv.simulate("click");
          wrapper.update();

          const backArrowDiv = wrapper.find("div.nz-toolbar-item-expandable-group-backArrow");
          expect(backArrowDiv.length).to.eq(1);

          backArrowDiv.simulate("click");
          wrapper.update();
        });

        it("should execute active item on click", () => {
          const execute = sinon.spy();

          const actionTool = ToolbarItemUtilities.createActionButton("childButton1", 10, "icon-button", "label", execute);
          const group = ToolbarItemUtilities.createGroupButton("groupButton", 10, "icon-button", "label", [actionTool]);

          const sut = mount(
            <ToolbarDragInteractionContext.Provider value={true}>
              <ToolbarGroupItem
                groupItem={group}
              />
            </ToolbarDragInteractionContext.Provider>,
          );
          const groupItem = sut.find(ToolbarGroupItem) as ReactWrapper<ToolbarGroupItem["props"], ToolbarGroupItem["state"], ToolbarGroupItem>;
          groupItem.setState({ isPressed: true });

          const withDragInteraction = sut.find("WithDragInteraction") as ReactWrapper<WithDragInteractionProps>;
          withDragInteraction.prop("onClick")!();

          expect(execute.calledOnce).to.true;
        });

        it("should expand group on pointerup", () => {
          const actionTool = ToolbarItemUtilities.createActionButton("action-1", 10, "icon-button", "label", () => { });
          const childActionTool = ToolbarItemUtilities.createActionButton("child-action-1", 10, "icon-button", "label", () => { });
          const childGroup = ToolbarItemUtilities.createGroupButton("group-1", 10, "icon-button", "label", [childActionTool]);
          const group = ToolbarItemUtilities.createGroupButton("groupButton", 10, "icon-button", "label", [actionTool, childGroup]);

          const sut = mount(
            <ToolbarDragInteractionContext.Provider value={true}>
              <ToolGroupPanelContext.Provider value={true}>
                <ToolbarGroupItem
                  groupItem={group}
                />
              </ToolGroupPanelContext.Provider>
            </ToolbarDragInteractionContext.Provider>,
          );
          const groupItem = sut.find(ToolbarGroupItem) as ReactWrapper<ToolbarGroupItem["props"], ToolbarGroupItem["state"], ToolbarGroupItem>;
          groupItem.setState({ isPressed: true });
          const groupToolExpander = sut.find(GroupToolExpander);
          groupToolExpander.prop("onPointerUp")!();

          expect(groupItem.state().trayId).to.eq("tray-2");
        });

        it("should activate group tool on pointerup", () => {
          const execute = sinon.spy();
          const actionTool = ToolbarItemUtilities.createActionButton("action-1", 10, "icon-button", "label", execute);
          const group = ToolbarItemUtilities.createGroupButton("groupButton", 10, "icon-button", "label", [actionTool]);
          const sut = mount(
            <ToolbarDragInteractionContext.Provider value={true}>
              <ToolGroupPanelContext.Provider value={true}>
                <ToolbarGroupItem
                  groupItem={group}
                />
              </ToolGroupPanelContext.Provider>
            </ToolbarDragInteractionContext.Provider>,
          );
          const groupItem = sut.find(ToolbarGroupItem) as ReactWrapper<ToolbarGroupItem["props"], ToolbarGroupItem["state"], ToolbarGroupItem>;
          groupItem.setState({ isPressed: true });
          const groupTool = sut.find(GroupTool);
          groupTool.prop("onPointerUp")!();

          expect(execute.calledOnce).to.true;
        });

        it("should call onItemExecuted on pointerup", () => {
          const onItemExecuted = sinon.spy();
          const actionTool = ToolbarItemUtilities.createActionButton("action-1", 10, "icon-button", "label", () => { });
          const group = ToolbarItemUtilities.createGroupButton("groupButton", 10, "icon-button", "label", [actionTool]);
          const sut = mount(
            <ToolbarDragInteractionContext.Provider value={true}>
              <ToolGroupPanelContext.Provider value={true}>
                <ToolbarGroupItem
                  groupItem={group} onItemExecuted={onItemExecuted}
                />
              </ToolGroupPanelContext.Provider>
            </ToolbarDragInteractionContext.Provider>,
          );
          const groupItem = sut.find(ToolbarGroupItem) as ReactWrapper<ToolbarGroupItem["props"], ToolbarGroupItem["state"], ToolbarGroupItem>;
          groupItem.setState({ isPressed: true });
          const groupTool = sut.find(GroupTool);
          groupTool.prop("onPointerUp")!();

          expect(onItemExecuted.calledOnce).to.true;
        });

        it("should activate nested tool group back arrow on pointerup", () => {
          const actionTool = ToolbarItemUtilities.createActionButton("action-1", 10, "icon-button", "label", () => { });
          const childActionTool = ToolbarItemUtilities.createActionButton("child-action-1", 10, "icon-button", "label", () => { });
          const childGroup = ToolbarItemUtilities.createGroupButton("group-1", 10, "icon-button", "label", [childActionTool]);
          const group = ToolbarItemUtilities.createGroupButton("groupButton", 10, "icon-button", "label", [actionTool, childGroup]);

          const sut = mount(
            <ToolbarDragInteractionContext.Provider value={true}>
              <ToolGroupPanelContext.Provider value={true}>
                <ToolbarGroupItem
                  groupItem={group}
                />
              </ToolGroupPanelContext.Provider>
            </ToolbarDragInteractionContext.Provider>,
          );
          const groupItem = sut.find(ToolbarGroupItem) as ReactWrapper<ToolbarGroupItem["props"], ToolbarGroupItem["state"], ToolbarGroupItem>;
          groupItem.setState({
            isPressed: true,
            trayId: "tray-2",
            backTrays: ["tray-1"],
          });
          const nestedGroup = sut.find(NestedGroup);
          nestedGroup.prop("onBackPointerUp")!();

          expect(groupItem.state().trayId).to.eq("tray-1");
        });

        it("should minimize on outside click", () => {
          const sut = mount(
            <ToolbarDragInteractionContext.Provider value={true}>
              <ToolbarGroupItem
                groupItem={group2}
              />
            </ToolbarDragInteractionContext.Provider>,
          );
          const groupItem = sut.find(ToolbarGroupItem) as ReactWrapper<ToolbarGroupItem["props"], ToolbarGroupItem["state"], ToolbarGroupItem>;
          groupItem.setState({ isPressed: true });
          const toolGroup = sut.find("WithOnOutsideClick") as ReactWrapper<WithOnOutsideClickProps>;
          const event = new MouseEvent("");
          sinon.stub(event, "target").get(() => document.createElement("div"));
          toolGroup.prop("onOutsideClick")!(event);
          expect(groupItem.state().isPressed).to.be.false;
        });
      });

      it("should toggle panel on click", () => {
        const sut = mount<ToolbarGroupItem>(<ToolbarGroupItem groupItem={group1} />);
        const item = sut.find(Item);

        item.prop("onClick")!();
        expect(sut.state().isPressed).to.be.true;

        item.prop("onClick")!();
        expect(sut.state().isPressed).to.be.false;
      });
    });
  });
});
