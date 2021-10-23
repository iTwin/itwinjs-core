/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import { ReactWrapper, shallow } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";
import { BadgeType } from "@itwin/appui-abstract";
import { WithOnOutsideClickProps } from "@itwin/core-react";
import { Direction, GroupTool, GroupToolExpander, Item, NestedGroup, WithDragInteractionProps } from "@itwin/appui-layout-react";
import {
  BaseItemState, CommandItemDef, getFirstItem, getFirstItemId, GroupButton, GroupItem, GroupItemDef, KeyboardShortcutManager, SyncUiEventDispatcher,
  ToolbarDragInteractionContext, ToolGroupPanelContext,
} from "../../appui-react";
import * as GroupItemModule from "../../appui-react/toolbar/GroupItem";
import TestUtils, { mount } from "../TestUtils";

const tool1 = new CommandItemDef({
  commandId: "tool1",
  label: "Tool 1",
  iconSpec: "icon-placeholder",
  badgeType: BadgeType.New,
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

  after(() => {
    TestUtils.terminateUiFramework();
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

    it("should not render if not visible", () => {
      mount(
        <GroupButton
          labelKey="UiFramework:tests.label"
          iconSpec="icon-placeholder"
          items={[tool1, tool2]}
          direction={Direction.Bottom}
          itemsInColumn={4}
          isVisible={false}
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
    });

    it("sync event should trigger stateFunc", () => {
      const testEventId = "test-button-state";
      let stateFunctionCalled = false;
      const testStateFunc = (state: Readonly<BaseItemState>): BaseItemState => { stateFunctionCalled = true; return state; };

      mount(
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
      SyncUiEventDispatcher.dispatchImmediateSyncUiEvent(`${testEventId}-noop`);
      expect(stateFunctionCalled).to.eq(false);
    });

    it("sync event should trigger stateFunc in items", () => {
      const testEventId = "test-button-state";

      mount(
        <GroupButton
          labelKey="UiFramework:tests.label"
          iconSpec="icon-placeholder"
          items={[tool1, tool2]}
          direction={Direction.Bottom}
          itemsInColumn={4}
        />,
      );

      SyncUiEventDispatcher.dispatchImmediateSyncUiEvent(testEventId);
    });

    it("should set focus to home on Esc", () => {
      const wrapper = mount(<GroupButton items={[tool1, tool2]} />);
      const element = wrapper.find(".nz-toolbar-item-item");
      element.simulate("focus");
      element.simulate("keyDown", { key: "Escape" });
      expect(KeyboardShortcutManager.isFocusOnHome).to.be.true;
    });
  });

  describe("<GroupItem />", () => {
    describe("dragInteraction", () => {
      describe("overflow", () => {
        it("should close on outside click", () => {
          const groupItemDef = new GroupItemDef({
            items: [tool1],
          });
          groupItemDef.overflow = true;
          groupItemDef.resolveItems();
          const sut = mount(
            <ToolbarDragInteractionContext.Provider value={true}>
              <GroupItem
                groupItemDef={groupItemDef}
              />
            </ToolbarDragInteractionContext.Provider>,
          );

          const groupItem = sut.find(GroupItem) as ReactWrapper<GroupItem["props"], GroupItem["state"], GroupItem>;
          groupItem.setState({ isPressed: true });

          const toolGroup = sut.find("WithOnOutsideClick") as ReactWrapper<WithOnOutsideClickProps>;
          const event = new MouseEvent("");
          sinon.stub(event, "target").get(() => document.createElement("div"));
          toolGroup.prop("onOutsideClick")!(event);

          expect(groupItem.state().isPressed).to.be.false;
        });

        it("should toggle panel on click", () => {
          const groupItemDef = new GroupItemDef({
            items: [tool1],
          });
          groupItemDef.overflow = true;
          groupItemDef.resolveItems();
          const sut = mount(
            <ToolbarDragInteractionContext.Provider value={true}>
              <GroupItem groupItemDef={groupItemDef} />
            </ToolbarDragInteractionContext.Provider>,
          );
          const groupItem = sut.find(GroupItem) as ReactWrapper<GroupItem["props"], GroupItem["state"], GroupItem>;
          const withDragInteraction = sut.find("WithDragInteraction") as ReactWrapper<WithDragInteractionProps>;

          withDragInteraction.prop("onClick")!();
          expect(groupItem.state().isPressed).to.be.true;

          withDragInteraction.prop("onClick")!();
          expect(groupItem.state().isPressed).to.be.false;
        });
      });

      it("should open", () => {
        const groupItemDef = new GroupItemDef({
          items: [tool1, tool2],
        });
        groupItemDef.overflow = true;
        groupItemDef.resolveItems();

        const sut = mount(
          <ToolbarDragInteractionContext.Provider value={true}>
            <GroupItem
              groupItemDef={groupItemDef}
            />
          </ToolbarDragInteractionContext.Provider>,
        );

        const buttonDiv = sut.find("WithDragInteraction") as ReactWrapper<WithDragInteractionProps>;
        buttonDiv.prop("onOpenPanel")!();

        const groupItem = sut.find(GroupItem) as ReactWrapper<GroupItem["props"], GroupItem["state"], GroupItem>;
        expect(groupItem.state().isPressed).to.be.true;
      });

      it("should include a GroupToolExpander when a GroupItemDef is included", () => {
        const wrapper = mount(
          <ToolbarDragInteractionContext.Provider value={true}>
            <GroupButton items={[tool1, tool2, group1]} />
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
        const groupItemDef = new GroupItemDef({
          items: [
            new CommandItemDef({
              execute,
            }),
          ],
        });
        groupItemDef.resolveItems();
        const sut = mount(
          <ToolbarDragInteractionContext.Provider value={true}>
            <GroupItem
              groupItemDef={groupItemDef}
            />
          </ToolbarDragInteractionContext.Provider>,
        );
        const groupItem = sut.find(GroupItem) as ReactWrapper<GroupItem["props"], GroupItem["state"], GroupItem>;
        groupItem.setState({ isPressed: true });

        const withDragInteraction = sut.find("WithDragInteraction") as ReactWrapper<WithDragInteractionProps>;
        withDragInteraction.prop("onClick")!();

        expect(execute.calledOnce).to.true;
      });

      it("should expand group on pointerup", () => {
        const groupItemDef = new GroupItemDef({
          items: [
            new CommandItemDef({}),
            new GroupItemDef({
              groupId: "group-1",
              items: [],
            })],
        });
        groupItemDef.resolveItems();
        const sut = mount(
          <ToolbarDragInteractionContext.Provider value={true}>
            <ToolGroupPanelContext.Provider value={true}>
              <GroupItem
                groupItemDef={groupItemDef}
              />
            </ToolGroupPanelContext.Provider>
          </ToolbarDragInteractionContext.Provider>,
        );
        const groupItem = sut.find(GroupItem) as ReactWrapper<GroupItem["props"], GroupItem["state"], GroupItem>;
        groupItem.setState({ isPressed: true });
        const groupToolExpander = sut.find(GroupToolExpander);
        groupToolExpander.prop("onPointerUp")!();

        expect(groupItem.state().trayId).to.eq("tray-2");
      });

      it("should activate group tool on pointerup", () => {
        const execute = sinon.spy();
        const groupItemDef = new GroupItemDef({
          items: [
            new CommandItemDef({
              execute,
            }),
          ],
        });
        groupItemDef.resolveItems();
        const sut = mount(
          <ToolbarDragInteractionContext.Provider value={true}>
            <ToolGroupPanelContext.Provider value={true}>
              <GroupItem
                groupItemDef={groupItemDef}
              />
            </ToolGroupPanelContext.Provider>
          </ToolbarDragInteractionContext.Provider>,
        );
        const groupItem = sut.find(GroupItem) as ReactWrapper<GroupItem["props"], GroupItem["state"], GroupItem>;
        groupItem.setState({ isPressed: true });
        const groupTool = sut.find(GroupTool);
        groupTool.prop("onPointerUp")!();

        expect(execute.calledOnce).to.true;
      });

      it("should activate nested tool group back arrow on pointerup", () => {
        const groupItemDef = new GroupItemDef({
          items: [
            new GroupItemDef({
              items: [
                new CommandItemDef({}),
              ],
            }),
          ],
        });
        groupItemDef.resolveItems();
        const sut = mount(
          <ToolbarDragInteractionContext.Provider value={true}>
            <ToolGroupPanelContext.Provider value={true}>
              <GroupItem
                groupItemDef={groupItemDef}
              />
            </ToolGroupPanelContext.Provider>
          </ToolbarDragInteractionContext.Provider>,
        );
        const groupItem = sut.find(GroupItem) as ReactWrapper<GroupItem["props"], GroupItem["state"], GroupItem>;
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
        const groupItemDef = new GroupItemDef({
          items: [tool1, tool2, group1],
        });
        groupItemDef.resolveItems();
        const sut = mount(
          <ToolbarDragInteractionContext.Provider value={true}>
            <GroupItem
              groupItemDef={groupItemDef}
            />
          </ToolbarDragInteractionContext.Provider>,
        );

        const groupItem = sut.find(GroupItem) as ReactWrapper<GroupItem["props"], GroupItem["state"], GroupItem>;
        groupItem.setState({ isPressed: true });

        const toolGroup = sut.find("WithOnOutsideClick") as ReactWrapper<WithOnOutsideClickProps>;

        const event = new MouseEvent("");
        sinon.stub(event, "target").get(() => document.createElement("div"));
        toolGroup.prop("onOutsideClick")!(event);

        expect(groupItem.state().isPressed).to.be.false;
      });
    });

    it("should toggle panel on click", () => {
      const groupItemDef = new GroupItemDef({
        items: [tool1],
      });
      groupItemDef.overflow = true;
      groupItemDef.resolveItems();
      const sut = mount<GroupItem>(<GroupItem groupItemDef={groupItemDef} />);
      const item = sut.find(Item);

      item.prop("onClick")!();
      expect(sut.state().isPressed).to.be.true;

      item.prop("onClick")!();
      expect(sut.state().isPressed).to.be.false;
    });

    it("should initialize activeItemId from defaultActiveItemId prop", () => {
      const groupItemDef = new GroupItemDef({
        items: [],
      });
      groupItemDef.defaultActiveItemId = "item1";
      groupItemDef.resolveItems();
      const sut = mount<GroupItem>(<GroupItem
        groupItemDef={groupItemDef}
      />);
      expect(sut.state().activeItemId).to.eq("item1");
    });

    it("should fallback to first item id when defaultActiveItemId is not specified", () => {
      const groupItemDef = new GroupItemDef({
        items: [],
      });
      groupItemDef.resolveItems();
      sinon.stub(GroupItemModule, "getFirstItemId").returns("asd");
      const sut = mount<GroupItem>(<GroupItem
        groupItemDef={groupItemDef}
      />);
      expect(sut.state().activeItemId).to.eq("asd");
    });

    it("should execute group tool on click", () => {
      const execute = sinon.spy();
      const groupItemDef = new GroupItemDef({
        items: [
          new CommandItemDef({
            commandId: "id1",
            execute,
          }),
        ],
      });
      groupItemDef.resolveItems();
      const sut = mount<GroupItem>(<GroupItem
        groupItemDef={groupItemDef}
      />);
      sut.setState({ isPressed: true });
      const groupTool = sut.find(GroupTool);
      groupTool.prop("onClick")!();

      expect(execute.calledOnce).to.true;
      expect(sut.state().activeItemId).to.eq("id1");
    });

    it("should use panelLabel as panel title", () => {
      const groupItemDef = new GroupItemDef({
        items: [
          new CommandItemDef({}),
        ],
        panelLabel: "Panel 1",
      });
      groupItemDef.resolveItems();
      const sut = mount<GroupItem>(<GroupItem
        groupItemDef={groupItemDef}
      />);
      sut.setState({ isPressed: true });

      const tray = sut.state().trays.get("tray-1");
      expect(tray).to.exist;
      expect(tray!.title).to.eq("Panel 1");
    });

    it("should maintain trayId if backTrays is empty", () => {
      const groupItemDef = new GroupItemDef({
        items: [
          new GroupItemDef({
            items: [
              new CommandItemDef({}),
            ],
          }),
        ],
      });
      groupItemDef.resolveItems();
      const sut = mount<GroupItem>(<GroupItem
        groupItemDef={groupItemDef}
      />);
      sut.setState({
        isPressed: true,
        trayId: "tray-2",
        backTrays: ["tray-1"],
      });
      const nestedGroup = sut.find(NestedGroup);
      nestedGroup.prop("onBack")!();
      nestedGroup.prop("onBack")!();

      expect(sut.state().trayId).to.eq("tray-1");
    });

    it("should minimize on outside click", () => {
      const groupItemDef = new GroupItemDef({
        items: [tool1, tool2, group1],
      });
      groupItemDef.resolveItems();
      const sut = mount<GroupItem>(<GroupItem
        groupItemDef={groupItemDef}
      />);
      sut.setState({ isPressed: true });

      const toolGroup = sut.find("WithOnOutsideClick") as ReactWrapper<WithOnOutsideClickProps>;

      const event = new MouseEvent("");
      sinon.stub(event, "target").get(() => document.createElement("div"));
      toolGroup.prop("onOutsideClick")!(event);

      expect(sut.state().isPressed).to.be.false;
    });
  });

  describe("GroupItemDef", () => {
    it("Supports CommandItemDef correctly", () => {
      const groupItemDef = new GroupItemDef({
        groupId: "my-group1",
        labelKey: "SampleApp:buttons.toolGroup",
        panelLabel: "panel-label",
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

    it("setPanelLabel sets panel label correctly", () => {
      const panelLabel = "panel-label";
      const groupItemDef = new GroupItemDef({
        groupId: "my-group1",
        panelLabel,
        iconSpec: "icon-placeholder",
        items: [tool1, tool2],
      });

      expect(groupItemDef.panelLabel).to.eq(panelLabel);

      const newPanelLabel = "New Panel Label";
      groupItemDef.setPanelLabel(newPanelLabel);
      expect(groupItemDef.panelLabel).to.eq(newPanelLabel);
    });

    it("should generate id correctly", () => {
      const groupItemDef = new GroupItemDef({
        iconSpec: "icon-placeholder",
        items: [tool1, tool2],
      });

      expect(groupItemDef.id.substr(0, GroupItemDef.groupIdPrefix.length)).to.eq(GroupItemDef.groupIdPrefix);
    });

  });

  describe("getFirstItem", () => {
    it("should return undefined if no items in group item", () => {
      const groupItemDef = new GroupItemDef({
        items: [],
      });
      const item = getFirstItem(groupItemDef);
      expect(item).to.eq(undefined);
    });

    it("should return undefined if no items in nested group items", () => {
      const groupItemDef = new GroupItemDef({
        items: [new GroupItemDef({
          items: [],
        })],
      });
      const item = getFirstItem(groupItemDef);
      expect(item).to.eq(undefined);
    });
  });

  describe("getFirstItemId ", () => {
    it("should fallback to empty string when no item found", () => {
      const groupItemDef = new GroupItemDef({
        items: [],
      });
      const item = getFirstItemId(groupItemDef);
      expect(item).to.eq("");
    });
  });
});
