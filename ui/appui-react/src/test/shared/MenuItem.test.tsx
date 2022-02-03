/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { expect } from "chai";
import * as React from "react";
import * as sinon from "sinon";
import { BadgeType } from "@itwin/appui-abstract";
import { ContextMenuItem, ContextSubMenu } from "@itwin/core-react";
import { render } from "@testing-library/react";
import type { MenuItemProps } from "../../appui-react/shared/MenuItem";
import { MenuItem, MenuItemHelpers } from "../../appui-react/shared/MenuItem";
import TestUtils, { mount } from "../TestUtils";

describe("MenuItem", () => {

  const createBubbledEvent = (type: string, props = {}) => {
    return TestUtils.createBubbledEvent(type, props);
  };

  it("should create a valid MenuItem", () => {
    const menuItem = new MenuItem({
      id: "test", item: { label: "test label", icon: "icon-placeholder", execute: () => { } },
    });

    expect(menuItem.id).to.eq("test");
    expect(menuItem.label).to.eq("test label");
    expect(menuItem.iconSpec).to.eq("icon-placeholder");
    expect(menuItem.actionItem).to.not.be.undefined;
    expect(menuItem.submenu.length).to.eq(0);
  });

  it("should handle label & icon correctly", () => {
    const menuItem = new MenuItem({
      id: "test", label: "test label", icon: "icon-placeholder", iconRight: "icon-checkmark", item: { label: "wrong label", icon: "wrong icon", execute: () => { } },
    });

    expect(menuItem.id).to.eq("test");
    expect(menuItem.label).to.eq("test label");
    expect(menuItem.iconSpec).to.eq("icon-placeholder");
    expect(menuItem.iconRightSpec).to.eq("icon-checkmark");
  });

  it("should create a valid submenu", () => {
    const menuItem = new MenuItem({
      id: "test", label: "test label", icon: "icon-placeholder",
      submenu: [
        { id: "0", item: { label: "Mode 1", icon: "icon-placeholder", execute: () => { } } },
        { id: "1", item: { label: "Mode 2", icon: "icon-placeholder", execute: () => { } } },
      ],
    });

    expect(menuItem.id).to.eq("test");
    expect(menuItem.label).to.eq("test label");
    expect(menuItem.iconSpec).to.eq("icon-placeholder");
    expect(menuItem.submenu.length).to.eq(2);
  });

  it("should throw an exception with item or submenu", () => {
    expect(() => {
      new MenuItem({
        id: "test",
      });
    }).to.throw(Error);
  });

  it("createMenuItems should create a valid MenuItem", () => {
    const menuItemProps: MenuItemProps[] = [
      {
        id: "test", item: { label: "test label", icon: "icon-placeholder", execute: () => { } },
      },
    ];

    const menuItems = MenuItemHelpers.createMenuItems(menuItemProps);

    expect(menuItems.length).to.eq(1);

    const menuItem = menuItems[0];
    expect(menuItem.id).to.eq("test");
    expect(menuItem.label).to.eq("test label");
    expect(menuItem.iconSpec).to.eq("icon-placeholder");
    expect(menuItem.actionItem).to.not.be.undefined;
    expect(menuItem.submenu.length).to.eq(0);
  });

  it("createMenuItems should create a valid submenu", () => {
    const menuItemProps: MenuItemProps[] = [
      {
        id: "test", label: "test label", icon: "icon-placeholder",
        submenu: [
          { id: "0", item: { label: "Mode 1", icon: "icon-placeholder", execute: () => { } } },
          { id: "1", item: { label: "Mode 2", icon: "icon-placeholder", execute: () => { } } },
        ],
      },
    ];

    const menuItems = MenuItemHelpers.createMenuItems(menuItemProps);

    expect(menuItems.length).to.eq(1);

    const menuItem = menuItems[0];
    expect(menuItem.id).to.eq("test");
    expect(menuItem.label).to.eq("test label");
    expect(menuItem.iconSpec).to.eq("icon-placeholder");
    expect(menuItem.submenu.length).to.eq(2);
  });

  it("createMenuItemNodes should create a valid MenuItem", () => {
    const menuItemProps: MenuItemProps[] = [
      {
        id: "test", badgeType: BadgeType.New, isDisabled: true, item: { label: "test label", icon: "icon-placeholder", execute: () => { } }, iconRight: "icon-checkmark",
      },
    ];

    const menuItems = MenuItemHelpers.createMenuItems(menuItemProps);
    expect(menuItems.length).to.eq(1);

    const menuItemNodes = MenuItemHelpers.createMenuItemNodes(menuItems);
    expect(menuItemNodes.length).to.eq(1);

    const wrapper = mount(<div>{menuItemNodes}</div>);
    expect(wrapper.find(ContextMenuItem).length).to.eq(1);
    expect(wrapper.find(".core-badge").length).to.eq(1);
    expect(wrapper.find(".icon-placeholder").length).to.eq(1);
    expect(wrapper.find(".icon-checkmark").length).to.eq(1);
  });

  it("createMenuItemNodes should create a disabled MenuItem", () => {
    const menuItemProps: MenuItemProps[] = [
      {
        id: "test", badgeType: BadgeType.New, item: { label: "test label", isDisabled: true, icon: "icon-placeholder", execute: () => { } }, iconRight: "icon-checkmark",
      },
    ];

    const menuItems = MenuItemHelpers.createMenuItems(menuItemProps);
    expect(menuItems.length).to.eq(1);

    const menuItemNodes = MenuItemHelpers.createMenuItemNodes(menuItems);
    expect(menuItemNodes.length).to.eq(1);

    const wrapper = mount(<div>{menuItemNodes}</div>);
    const contextMenuItems = wrapper.find(ContextMenuItem);
    contextMenuItems.forEach((contextMenuItem): void => {
      expect(contextMenuItem.props().disabled).to.equal(true);
    });
  });

  it("onSelect handled correctly on click", async () => {
    const handleSelect = sinon.fake();
    const handleSelect2 = sinon.fake();

    const menuItemProps: MenuItemProps[] = [
      {
        id: "test", item: { label: "test label", icon: "icon-placeholder", badgeType: BadgeType.New, execute: handleSelect },
      },
    ];

    const menuItems = MenuItemHelpers.createMenuItems(menuItemProps, handleSelect2);
    expect(menuItems.length).to.eq(1);

    const menuItemNodes = MenuItemHelpers.createMenuItemNodes(menuItems);
    expect(menuItemNodes.length).to.eq(1);

    const component = render(<div>{menuItemNodes}</div>);
    const item = component.getByTestId("core-context-menu-item");
    item.dispatchEvent(createBubbledEvent("click"));

    await TestUtils.flushAsyncOperations();
    handleSelect.should.have.been.calledOnce;
    handleSelect2.should.have.been.calledOnce;
    expect(component.container.querySelector(".core-badge")).not.to.be.null;
  });

  it("createMenuItemNodes should create a valid submenu", () => {
    const menuItemProps: MenuItemProps[] = [
      {
        id: "test", label: "test label", icon: "icon-placeholder",
        submenu: [
          { id: "0", item: { label: "Mode 1", icon: "icon-placeholder", execute: () => { } } },
          { id: "1", item: { label: "Mode 2", icon: "icon-placeholder", execute: () => { } } },
        ],
      },
    ];

    const menuItems = MenuItemHelpers.createMenuItems(menuItemProps);
    expect(menuItems.length).to.eq(1);

    const menuItemNodes = MenuItemHelpers.createMenuItemNodes(menuItems);
    expect(menuItemNodes.length).to.eq(1);

    const wrapper = mount(<div>{menuItemNodes}</div>);
    expect(wrapper.find(ContextSubMenu).length).to.eq(1);
  });

});
